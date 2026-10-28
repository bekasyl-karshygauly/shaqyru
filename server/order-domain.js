import crypto from 'node:crypto';
import {clean,PRICE,TIER} from './validate.js';
export const problem=(status,message)=>Object.assign(new Error(message),{status,expose:true});
export const contentHash=data=>crypto.createHash('sha256').update(JSON.stringify(clean(data))).digest('hex');
export const servicesHash=services=>crypto.createHash('sha256').update(JSON.stringify(services||[])).digest('hex');
export function logOrder(order,actor,action,details={}){return {...order,history:[...(order.history||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor,action,...details}]}}
export function orderView(i){
  const o=i?.data?._order;if(!o)return null;
  return {status:o.status,submittedAt:o.submittedAt,publishedAt:o.publishedAt||null,contact:o.contact,note:o.note,price:o.price,services:o.services||[],needsAgreement:!!o.needsAgreement,quote:o.quote||null,approval:o.approval?{at:o.approval.at,price:o.approval.price,names:o.approval.snapshot.names,dsg:o.approval.snapshot.dsg,current:!o.needsAgreement&&o.approval.hash===contentHash(i.data)&&(!o.approval.servicesHash||o.approval.servicesHash===servicesHash(o.services))&&(!o.quote||o.approval.quoteId===o.quote.id)}:null,revisions:o.revisions||[],history:o.history||[],archivedAt:o.archivedAt||null,rsvpAlerts:!!o.rsvpAlerts,rejectionReason:o.status==='rejected'?o.rejectionReason||'':'',notifications:{whatsapp:o.notifications?.whatsapp?.enabled===true?{enabled:true,phone:o.notifications.whatsapp.phone,consentedAt:o.notifications.whatsapp.consentedAt,consentVersion:o.notifications.whatsapp.consentVersion}:{enabled:false}}};
}
export function orderEstimate(data,services){const base=PRICE[TIER[clean(data).dsg]];return {base,total:base+services.reduce((n,s)=>n+(s.price||0),0),needsQuote:services.some(s=>s.price===null)}}
export function checkPublication(i){
  const o=i.data._order;
  if(o.status==='rejected')throw problem(409,'Заявка отклонена. Сначала верните её в работу.');
  if(o.archivedAt)throw problem(409,'Сначала восстановите заказ из архива.');
  if(o.revisions?.some(r=>!r.doneAt))throw problem(409,'Отметьте выполненными все правки перед публикацией.');
  if(o.needsAgreement)throw problem(409,'Условия заказа изменились. Предложите итоговую стоимость и дождитесь нового подтверждения.');
  if(o.estimate?.needsQuote&&!o.quote)throw problem(409,'Предложите клиенту итоговую стоимость услуг и дождитесь подтверждения.');
  if(o.quote&&(!o.approval||o.approval.quoteId!==o.quote.id||o.approval.hash!==contentHash(i.data)))throw problem(409,'Клиент должен подтвердить стоимость и текущий вариант приглашения.');
}
