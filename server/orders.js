import crypto from 'node:crypto';
import {clean,PRICE,TIER} from './validate.js';
import {assertVersion,updateInvitation,versionOf} from './invitation-store.js';
import {orderView,logOrder,orderEstimate,checkPublication,problem} from './order-domain.js';
import {mountOrderWorkflow} from './order-workflow.js';
import {ORDER_STATUSES} from './public/order-model.js';
import {clientNotificationPreferences} from './client-notification-preferences.js';
export const publishedManually=i=>i.data?._order?.status==='published'&&!!i.data._order.publishedAt;
export const orderForOwner=orderView;
export function mountOrders(app,{env,sb,inv,own,h,limit,notifications,clientNotifications,clientWhatsAppReady=async()=>false,links}){
  const admin=(req,res)=>{const a=Buffer.from(String(req.get('x-admin-key')||'')),b=Buffer.from(env.ADMIN_KEY||'');if(!b.length||a.length!==b.length||!crypto.timingSafeEqual(a,b)){res.status(403).json({error:'Нет доступа к кабинету'});return false}return true};
  mountOrderWorkflow(app,{sb,inv,own,admin,h,limit,clientNotifications});
  app.post('/api/inv/:id/order',limit('order-submit',20,3600000),h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;
    if(publishedManually(i))return res.json({order:orderForOwner(i),version:versionOf(i)});
    if(i.data._order?.archivedAt)throw problem(409,'Заказ находится в архиве. Свяжитесь с организатором.');
    assertVersion(i,req.body?.version);
    const raw=req.body?.contact||{},contact={name:String(raw.name||'').trim().slice(0,80),phone:String(raw.phone||'').trim().slice(0,40),email:String(raw.email||'').trim().toLowerCase().slice(0,254)};
    if(!contact.name||(!contact.phone&&!contact.email)||(contact.phone&&!/^[+\d\s()\-]{5,40}$/.test(contact.phone))||(contact.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)))return res.status(400).json({error:'Укажите имя и корректный телефон или email для связи'});
    const ids=req.body?.services??i.data._order?.services?.map(s=>s.id)??[];if(!Array.isArray(ids)||ids.length>3||ids.some(id=>!['urgent','text','photo'].includes(id))||new Set(ids).size!==ids.length)throw problem(400,'Некорректный набор услуг.');
    const catalog=ids.length?await sb('/shq_services?enabled=eq.true&select=id,name_ru,name_kz,price,version'):[],chosen=ids.map(id=>catalog.find(s=>s.id===id));if(chosen.some(s=>!s))throw problem(409,'Одна из услуг недоступна. Обновите список.');
    if(req.body?.serviceVersions&&chosen.some(s=>req.body.serviceVersions[s.id]!==s.version))throw problem(409,'Цены услуг изменились. Обновите список услуг перед отправкой заявки.');
    const services=chosen.map(({id,name_ru,name_kz,price})=>({id,name_ru,name_kz,price}));
    const previous=i.data._order||{},changed=JSON.stringify(previous.services||[])!==JSON.stringify(services),estimate=orderEstimate(i.data,services);
    const preferences=clientNotificationPreferences(previous.notifications,req.body?.notifications?.whatsapp,contact,await clientWhatsAppReady());
    const order=logOrder({...previous,status:previous.status==='rejected'?'submitted':previous.status||'submitted',rejectionReason:null,submittedAt:previous.submittedAt||new Date().toISOString(),updatedAt:new Date().toISOString(),price:!changed&&previous.quote?previous.price:estimate.total,estimate,services,...(changed?{quote:null,needsAgreement:!!(previous.quote||previous.approval||previous.needsAgreement),...(previous.quote||previous.approval?{status:'discussion'}:{})}:{}),contact,notifications:preferences,note:String(req.body?.note||'').trim().slice(0,1000)},'client',previous.submittedAt?'resubmitted':'submitted',{amount:estimate.total});
    const version=await updateInvitation(sb,i,{...i.data,_order:order});notifications?.kick();clientNotifications?.kick();res.json({order:orderForOwner({data:{...i.data,_order:order}}),version});
  }));
  app.put('/api/inv/:id/order/notifications',limit('client-notification-settings',20,60000),h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;if(!i.data._order)throw problem(404,'Сначала отправьте заявку.');assertVersion(i,req.body?.version);
    if(typeof req.body?.whatsapp!=='boolean')throw problem(400,'Выберите настройку уведомлений.');
    const preferences=clientNotificationPreferences(i.data._order.notifications,req.body.whatsapp,i.data._order.contact,await clientWhatsAppReady());
    const order=logOrder({...i.data._order,notifications:preferences},'client','clientNotifications',{enabled:req.body.whatsapp});
    const version=await updateInvitation(sb,i,{...i.data,_order:order});clientNotifications?.kick();res.json({order:orderForOwner({data:{...i.data,_order:order}}),version});
  }));
  app.get('/api/admin/list',limit('admin-orders',120,60000),h(async(req,res)=>{
    if(!admin(req,res))return;
    const offset=Math.max(0,Math.min(100000,Math.floor(Number(req.query.offset)||0))),status=Object.hasOwn(ORDER_STATUSES,req.query.status||'')?req.query.status:'',archived=req.query.archived==='true';
    const rows=await sb(`/shq_invitations?select=id,created,names:data->>names,eventDate:data->>date,orderStatus:data->_order->>status,orderContact:data->_order->contact,orderSubmitted:data->_order->>submittedAt,orderPrice:data->_order->price,orderArchived:data->_order->>archivedAt&data->>_order=not.is.null&data->_order->>archivedAt=${archived?'not.is.null':'is.null'}${status?'&data->_order->>status=eq.'+status:''}&order=created.desc,id.asc&offset=${offset}&limit=21`);
    res.json({items:rows.slice(0,20).map(r=>({id:r.id,names:r.names,created:r.created,eventDate:r.eventDate,order:{status:r.orderStatus||'submitted',contact:r.orderContact||{},submittedAt:r.orderSubmitted,price:r.orderPrice,archivedAt:r.orderArchived}})),nextOffset:rows.length>20?offset+20:null});
  }));
  app.get('/api/admin/orders/:id',limit('admin-order-read',120,60000),h(async(req,res)=>{
    if(!admin(req,res))return;const i=await inv(req.params.id);if(!i?.data._order)return res.status(404).json({error:'Заявка не найдена'});
    res.json({id:i.id,data:clean(i.data),order:orderForOwner(i),version:versionOf(i),guestPath:await links.path(i.id),notifications:await notifications?.forOrder(i.id)||[],clientNotifications:await clientNotifications?.forOrder(i.id)||[]});
  }));
  app.get('/api/admin/notifications',limit('admin-notification-settings',60,60000),h(async(req,res)=>{if(!admin(req,res))return;res.json({...await notifications.status(),client:await clientNotifications?.status()})}));
  app.post('/api/admin/notifications/telegram/test',limit('telegram-test',3,60000),h(async(req,res)=>{if(!admin(req,res))return;res.json(await notifications.testTelegram())}));
  app.post('/api/admin/orders/:id/notifications/retry',limit('admin-notification-retry',10,60000),h(async(req,res)=>{if(!admin(req,res))return;const i=await inv(req.params.id);if(!i?.data._order)return res.status(404).json({error:'Заявка не найдена'});await notifications.retry(i.id);res.json({ok:true})}));
  app.post('/api/admin/orders/:id/client-notifications/retry',limit('client-notification-retry',10,60000),h(async(req,res)=>{if(!admin(req,res))return;const i=await inv(req.params.id);if(!i?.data._order)throw problem(404,'Заявка не найдена');await clientNotifications?.retry(i.id);res.json({ok:true})}));
  app.post('/api/admin/orders/:id/publish',limit('admin-publish',30,60000),h(async(req,res)=>{
    if(!admin(req,res))return;const i=await inv(req.params.id);if(!i?.data._order)return res.status(404).json({error:'Сначала клиент должен отправить заявку'});
    if(publishedManually(i)){let link;try{link=await links.ensure(i)}catch{}return res.json({published:true,version:versionOf(i),order:orderForOwner(i),guestPath:link?.path||'/i/'+i.id})}
    assertVersion(i,req.body?.version);
    checkPublication(i);
    const order=logOrder({...i.data._order,status:'published',publishedAt:new Date().toISOString()},'admin','published',{amount:i.data._order.price});
    const version=await updateInvitation(sb,i,{...i.data,_order:order});let link;try{link=await links.ensure(i)}catch{}clientNotifications?.kick();res.json({published:true,version,order:orderForOwner({data:{...i.data,_order:order}}),guestPath:link?.path||'/i/'+i.id});
  }));
}
