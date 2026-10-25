import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrderNotifications,notificationConfig} from '../order-notifications.js';
const id='abcdef0123456789abcdef0123456789';
const env={PUBLIC_URL:'https://invite.example',TELEGRAM_BOT_TOKEN:'test-bot-secret',TELEGRAM_CHAT_ID:'123456',WHATSAPP_ACCESS_TOKEN:'test-wa-secret',WHATSAPP_PHONE_NUMBER_ID:'987654',WHATSAPP_API_VERSION:'v99.0',WHATSAPP_ORDER_TEMPLATE:'new_order',WHATSAPP_TEMPLATE_LANGUAGE:'ru'};
function fixture(fetchImpl,jobChannels=['telegram','whatsapp']){
  const writes=[],requests=[];let claimed=false;
  const sb=async(path,options)=>{if(path.startsWith('/rpc/')){if(claimed)return [];claimed=true;return jobChannels.map((channel,n)=>({id:'job-'+n,inv:id,channel,attempts:1,lease:'lease-'+n}))}writes.push({path,...options});return []};
  const inv=async()=>({id,edit_token:'PRIVATE_OWNER_SECRET',data:{names:'Имя <b>& праздник',dsg:0,_order:{price:2490,contact:{name:'Клиент',email:'client@example.com'},note:'Комментарий'}}});
  const notifications=createOrderNotifications({env,sb,inv,fetchImpl:async(url,options)=>{requests.push({url,...options});return fetchImpl(url,options)}});
  return {notifications,writes,requests};
}

test('automatic alerts require actual provider configuration and a public HTTPS origin',()=>{
  assert.equal(notificationConfig({}).telegram.configured,false);assert.equal(notificationConfig(env).whatsapp.configured,true);
  for(const PUBLIC_URL of ['http://localhost:3108','https://localhost:3108','https://user:password@example.com'])assert.equal(notificationConfig({...env,PUBLIC_URL}).publicUrl,false);
  assert.equal(notificationConfig({...env,TELEGRAM_CHAT_ID:'@Bekasyl'}).telegram.configured,false);
});

test('both services receive an admin review link, server price and no owner token',async()=>{
  const f=fixture(async url=>Response.json(url.includes('telegram')?{ok:true,result:{message_id:123}}:{messages:[{id:'wamid.test'}]}));
  await f.notifications.runOnce();assert.equal(f.requests.length,2);assert.equal(f.writes.length,2);
  const telegram=JSON.parse(f.requests[0].body),whatsapp=JSON.parse(f.requests[1].body);
  assert.equal(telegram.chat_id,'123456');assert.ok(telegram.text.includes('2 490 ₸'));assert.ok(telegram.text.includes('https://invite.example/admin#order='+id));
  assert.equal(telegram.reply_markup.inline_keyboard[0][0].url,'https://invite.example/admin#order='+id);assert.equal(telegram.parse_mode,undefined);
  assert.equal(whatsapp.to,'77788562088');assert.equal(whatsapp.type,'template');assert.equal(whatsapp.template.components[0].parameters[4].text,'https://invite.example/admin#order='+id);
  assert.ok(!JSON.stringify([telegram,whatsapp]).includes('PRIVATE_OWNER_SECRET'));assert.ok(f.writes.every(w=>w.body.status==='sent'&&w.path.includes('&lease=eq.lease-')));
  await f.notifications.runOnce();assert.equal(f.requests.length,2,'already claimed/sent jobs are not sent again');
});

test('temporary failures schedule retry; permanent failures remain visible for admin retry',async()=>{
  const f=fixture(async url=>Response.json(url.includes('telegram')?{ok:false,error_code:429,parameters:{retry_after:90},description:'sensitive raw response'}:{error:{code:190,message:'token detail'}},{status:url.includes('telegram')?429:401}));
  await f.notifications.runOnce();assert.equal(f.writes[0].body.status,'retry');assert.equal(f.writes[1].body.status,'failed');
  assert.ok(Date.parse(f.writes[0].body.available_at)>Date.now()+85000);assert.ok(!JSON.stringify(f.writes).includes('sensitive'));assert.ok(!JSON.stringify(f.writes).includes('token detail'));
});

test('unconfigured channels never contact providers and queue failures do not escape to the caller',async()=>{
  let calls=0;const disabled=createOrderNotifications({env:{},sb:async()=>{calls++;throw Error()},inv:async()=>{},fetchImpl:async()=>{calls++;throw Error()}});
  await disabled.runOnce();disabled.start();disabled.stop();assert.equal(calls,0);
  const enabled=createOrderNotifications({env,sb:async()=>{throw Error('database secret')},inv:async()=>{},fetchImpl:fetch});
  await enabled.runOnce();const status=await enabled.status();assert.equal(status.queueReady,false);assert.ok(status.lastError);assert.ok(!JSON.stringify(status).includes('database secret'));
});

test('guest-response notifications use their own text and WhatsApp template',async()=>{
  let claimed=false;const requests=[],database=[];
  const sb=async(path,options)=>{database.push({path,...options});if(path.startsWith('/rpc/')){if(claimed)return [];claimed=true;return ['telegram','whatsapp'].map(channel=>({id:channel,lease:channel,inv:id,attempts:1,channel,kind:'rsvp',payload:{name:'Алия',status:'yes',cnt:3}}))}return []};
  const service=createOrderNotifications({env:{...env,WHATSAPP_RSVP_TEMPLATE:'guest_response'},sb,inv:async()=>({id,data:{names:'Праздник',dsg:0,_order:{price:2490,contact:{name:'Клиент'}}}}),fetchImpl:async(url,options)=>{requests.push(JSON.parse(options.body));return Response.json(url.includes('telegram')?{ok:true,result:{message_id:1}}:{messages:[{id:'wa.guest'}]})}});
  await service.runOnce();assert.match(requests[0].text,/Ответ гостя/);assert.match(requests[0].text,/Алия: Придёт · 3/);assert.equal(requests[1].template.name,'guest_response');assert.equal(requests[1].template.components[0].parameters[2].text,'Алия');assert.equal(database[0].body.p_rsvp_whatsapp,true);
});
