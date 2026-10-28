import crypto from 'node:crypto';
import {clean} from './validate.js';
import {assertVersion,updateInvitation} from './invitation-store.js';
import {contentHash,servicesHash,logOrder,orderView,checkPublication,problem} from './order-domain.js';
import {ORDER_STATUSES} from './public/order-model.js';

export function mountOrderWorkflow(app,{sb,inv,own,admin,h,limit,clientNotifications}){
  async function ownerOrder(req,res){const i=await own(req,res);if(!i)return null;if(!i.data._order)throw problem(404,'Сначала отправьте заявку.');return i}
  async function adminOrder(req,res){if(!admin(req,res))return null;const i=await inv(req.params.id);if(!i?.data._order)throw problem(404,'Заявка не найдена');return i}
  async function save(i,order,res){const data={...i.data,_order:order},version=await updateInvitation(sb,i,data);clientNotifications?.kick();res.json({order:orderView({data}),version})}
  app.get('/api/services',h(async(req,res)=>res.json(await sb('/shq_services?enabled=eq.true&select=id,name_ru,name_kz,price,enabled,version&order=position.asc,id.asc'))));
  app.get('/api/admin/services',h(async(req,res)=>{if(!admin(req,res))return;res.json(await sb('/shq_services?select=*&order=position.asc,id.asc'))}));
  app.put('/api/admin/services/:service',limit('service-edit',30,60000),h(async(req,res)=>{
    if(!admin(req,res))return;const b=req.body||{};
    if(!['urgent','text','photo'].includes(req.params.service)||!(b.price===null||Number.isInteger(b.price)&&b.price>=0&&b.price<=1e7)||typeof b.enabled!=='boolean'||!String(b.version||'').match(/^[a-f0-9-]{36}$/))throw problem(400,'Укажите корректную цену и версию услуги.');
    const rows=await sb('/shq_services?id=eq.'+req.params.service+'&version=eq.'+b.version,{method:'PATCH',body:{price:b.price,enabled:b.enabled,version:crypto.randomUUID()},prefer:'return=representation'});
    if(rows.length!==1)throw problem(409,'Услуга изменилась. Обновите список и повторите.');res.json(rows[0]);
  }));
  app.post('/api/admin/orders/:id/workflow',h(async(req,res)=>{
    const i=await adminOrder(req,res);if(!i)return;assertVersion(i,req.body?.version);const b=req.body||{};let o={...i.data._order};
    if(b.status!==undefined){if(!Object.hasOwn(ORDER_STATUSES,b.status)||b.status==='published'||o.publishedAt)throw problem(400,'Опубликованный заказ нельзя вернуть в работу; используйте архив.');if(b.status==='ready')checkPublication(i);const rejectionReason=b.status==='rejected'?String(b.rejectionReason||'').trim().slice(0,500):null;if(b.status==='rejected'&&!rejectionReason)throw problem(400,'Укажите причину отказа для клиента.');o=logOrder({...o,status:b.status,rejectionReason},'admin','status',{status:b.status,...(rejectionReason?{text:rejectionReason}:{})})}
    if(b.archived!==undefined){if(typeof b.archived!=='boolean')throw problem(400,'Некорректное состояние архива');o=logOrder({...o,archivedAt:b.archived?new Date().toISOString():null},'admin',b.archived?'archived':'restored')}
    if(b.rsvpAlerts!==undefined){if(typeof b.rsvpAlerts!=='boolean')throw problem(400,'Некорректная настройка уведомлений');o=logOrder({...o,rsvpAlerts:b.rsvpAlerts},'admin','rsvpAlerts',{enabled:b.rsvpAlerts})}
    await save(i,o,res);
  }));
  app.post('/api/admin/orders/:id/quote',h(async(req,res)=>{
    const i=await adminOrder(req,res);if(!i)return;assertVersion(i,req.body?.version);const b=req.body||{};
    if(!Number.isInteger(b.amount)||b.amount<0||b.amount>1e7)throw problem(400,'Стоимость должна быть целым числом от 0 до 10 000 000 ₸.');
    if(i.data._order.publishedAt)throw problem(409,'Стоимость опубликованного заказа уже согласована.');
    const quote={id:crypto.randomUUID(),amount:b.amount,note:String(b.note||'').trim().slice(0,500),offeredAt:new Date().toISOString()};
    await save(i,logOrder({...i.data._order,quote,status:'discussion'},'admin','quote',{amount:b.amount,note:quote.note}),res);
  }));
  app.post('/api/inv/:id/order/accept',h(async(req,res)=>{
    const i=await ownerOrder(req,res);if(!i)return;assertVersion(i,req.body?.version);const o=i.data._order;
    if(o.status==='rejected')throw problem(409,'Заявка отклонена. Сначала обновите заявку для повторного рассмотрения.');
    if(!o.quote||req.body?.quoteId!==o.quote.id)throw problem(409,'Стоимость изменилась. Обновите заявку.');
    if(o.archivedAt)throw problem(409,'Заказ находится в архиве. Свяжитесь с организатором.');
    const approval={quoteId:o.quote.id,at:new Date().toISOString(),price:o.quote.amount,hash:contentHash(i.data),servicesHash:servicesHash(o.services),snapshot:clean(i.data)};
    await save(i,logOrder({...o,price:o.quote.amount,approval,needsAgreement:false,quote:{...o.quote,acceptedAt:approval.at},status:o.publishedAt?'published':o.revisions?.some(r=>!r.doneAt)?'changes':'ready'},'client','accepted',{amount:approval.price,names:approval.snapshot.names,dsg:approval.snapshot.dsg}),res);
  }));
  for(const [route,getter]of [['/api/admin/orders/:id/agreement',adminOrder],['/api/inv/:id/order/agreement',ownerOrder]])app.get(route,h(async(req,res)=>{const i=await getter(req,res);if(!i)return;const a=i.data._order.approval;if(!a)throw problem(404,'Подтверждённого варианта ещё нет.');res.json({data:clean(a.snapshot),at:a.at,price:a.price})}));
  app.post('/api/inv/:id/order/revisions',limit('revision-add',30,3600000),h(async(req,res)=>{
    const i=await ownerOrder(req,res);if(!i)return;assertVersion(i,req.body?.version);const text=String(req.body?.text||'').trim();
    if(!text||text.length>1000)throw problem(400,'Опишите правку: до 1000 символов.');
    const o=i.data._order;if(o.status==='rejected')throw problem(409,'Заявка отклонена. Сначала обновите заявку для повторного рассмотрения.');if(o.archivedAt)throw problem(409,'Заказ в архиве. Свяжитесь с организатором.');if((o.revisions||[]).length>=100)throw problem(400,'Достигнут предел правок в заказе. Обсудите изменения с организатором.');
    const item={id:crypto.randomUUID(),text,createdAt:new Date().toISOString(),doneAt:null};
    await save(i,logOrder({...o,status:o.publishedAt?'published':'changes',revisions:[...(o.revisions||[]),item]},'client','revision',{text}),res);
  }));
  app.post('/api/admin/orders/:id/revisions/:revision',h(async(req,res)=>{
    const i=await adminOrder(req,res);if(!i)return;assertVersion(i,req.body?.version);const o=i.data._order;
    if(typeof req.body?.done!=='boolean'||!o.revisions?.some(r=>r.id===req.params.revision))throw problem(400,'Правка не найдена.');
    const revisions=o.revisions.map(r=>r.id===req.params.revision?{...r,doneAt:req.body.done?new Date().toISOString():null}:r);
    await save(i,logOrder({...o,revisions},'admin','revisionDone',{revision:req.params.revision,text:o.revisions.find(r=>r.id===req.params.revision).text,done:req.body.done}),res);
  }));
  app.get('/api/admin/statistics',h(async(req,res)=>{if(!admin(req,res))return;res.json((await sb('/rpc/shq_order_statistics',{method:'POST',body:{}}))[0])}));
  app.get('/api/reviews',h(async(req,res)=>res.json(await sb('/shq_reviews?status=eq.approved&select=name,rating,text,published_at&order=published_at.desc&limit=6'))));
  app.get('/api/inv/:id/review',h(async(req,res)=>{const i=await own(req,res);if(!i)return;res.json((await sb('/shq_reviews?inv=eq.'+i.id+'&select=*'))[0]||null)}));
  app.post('/api/inv/:id/review',limit('review-submit',10,3600000),h(async(req,res)=>{
    const i=await ownerOrder(req,res);if(!i)return;if(!i.data._order.publishedAt)throw problem(403,'Отзыв можно оставить после публикации приглашения.');const b=req.body||{},name=String(b.name||'').trim().slice(0,80),text=String(b.text||'').trim().slice(0,1500);
    if(!name||!text||!Number.isInteger(b.rating)||b.rating<1||b.rating>5||b.consent!==true)throw problem(400,'Укажите имя, оценку, текст и согласие на публикацию.');
    const old=(await sb('/shq_reviews?inv=eq.'+i.id+'&select=*'))[0],record={inv:i.id,name,rating:b.rating,text,status:'pending',version:crypto.randomUUID(),created_at:new Date().toISOString(),published_at:null};
    if(old){if(old.version!==b.version)throw problem(409,'Отзыв изменился. Обновите его перед сохранением.');const changed=await sb('/shq_reviews?inv=eq.'+i.id+'&version=eq.'+old.version,{method:'PATCH',body:record,prefer:'return=representation'});if(changed.length!==1)throw problem(409,'Отзыв изменился.');res.json(changed[0])}
    else res.json((await sb('/shq_reviews',{method:'POST',body:record,prefer:'return=representation'}))[0]);
  }));
  app.get('/api/admin/reviews',h(async(req,res)=>{
    if(!admin(req,res))return;const status=['pending','approved','hidden'].includes(req.query.status)?req.query.status:'pending',offset=Math.max(0,Math.min(100000,Math.floor(Number(req.query.offset)||0)));
    const rows=await sb('/shq_reviews?status=eq.'+status+'&select=*&order=created_at.desc,inv.asc&offset='+offset+'&limit=21');res.json({items:rows.slice(0,20),nextOffset:rows.length>20?offset+20:null});
  }));
  app.post('/api/admin/reviews/:id',h(async(req,res)=>{
    if(!admin(req,res))return;if(!/^[a-f0-9]{8}(?:[a-f0-9]{24})?$/.test(req.params.id)||!['approved','hidden'].includes(req.body?.status)||!/^[a-f0-9-]{36}$/.test(req.body.version||''))throw problem(400,'Некорректное действие.');
    const rows=await sb('/shq_reviews?inv=eq.'+req.params.id+'&version=eq.'+req.body.version,{method:'PATCH',body:{status:req.body.status,published_at:req.body.status==='approved'?new Date().toISOString():null,version:crypto.randomUUID()},prefer:'return=representation'});
    if(rows.length!==1)throw problem(409,'Отзыв изменился. Обновите список перед публикацией.');res.json(rows[0]);
  }));
}
