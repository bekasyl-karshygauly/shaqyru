import test from 'node:test';
import assert from 'node:assert/strict';
import {clientNotificationConfig,createClientNotifications} from '../client-notifications.js';

const id='abcdef0123456789abcdef0123456789',phone='77015550123',at='2026-10-28T08:00:00.000Z';
const env={PUBLIC_URL:'https://invite.example',WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED:'1',WHATSAPP_ACCESS_TOKEN:'TEST_CLIENT_WA_SECRET',WHATSAPP_PHONE_NUMBER_ID:'987654',WHATSAPP_API_VERSION:'v99.0',WHATSAPP_CLIENT_STATUS_TEMPLATE:'customer_order_status',WHATSAPP_CLIENT_TEMPLATE_LANGUAGE:'ru'};
const subscription=()=>({enabled:true,phone,consentedAt:at,consentVersion:'order-status-v1'});
function fixture({settings={},record={},event={},provider=async()=>Response.json({messages:[{id:'wamid.client'}]}),path='/arman-aigerim'}={}){
  let claimed=false;
  const reads=[],writes=[],requests=[];
  const invitation={id,edit_token:'PRIVATE_EDIT_TOKEN',data:{names:'Арман & Айгерім',_order:{status:'processing',contact:{phone:'+7 701 555 0123',email:'PRIVATE_EMAIL'},notifications:{whatsapp:subscription()}}}};
  Object.assign(invitation.data._order,record);
  const job={id:'11111111-1111-4111-8111-111111111111',inv:id,revision:'rev',channel:'whatsapp',order_status:'processing',recipient:phone,consented_at:at,created_at:new Date().toISOString(),attempts:1,lease:'22222222-2222-4222-8222-222222222222',...event};
  const sb=async(url,options={})=>{reads.push({url,...options});if(url.startsWith('/rpc/')){if(claimed)return [];claimed=true;return [job]}if(options.method==='PATCH')writes.push({url,...options});return []};
  const service=createClientNotifications({env:{...env,...settings},sb,inv:async()=>invitation,links:{path:async()=>path},fetchImpl:async(url,options)=>{requests.push({url,...options});return provider(url,options)}});
  return {service,invitation,job,reads,writes,requests};
}

test('customer notifications are explicitly enabled and independent from organizer templates',()=>{
  assert.deepEqual(clientNotificationConfig({}),{enabled:false,configured:false,publicUrl:false});
  assert.equal(clientNotificationConfig(env).configured,true);
  assert.equal(clientNotificationConfig({...env,WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED:'0'}).configured,false);
  assert.equal(clientNotificationConfig({...env,WHATSAPP_CLIENT_STATUS_TEMPLATE:''}).configured,false);
  assert.equal(clientNotificationConfig({...env,WHATSAPP_CLIENT_TEMPLATE_LANGUAGE:''}).configured,false);
  assert.equal(clientNotificationConfig({...env,WHATSAPP_CLIENT_STATUS_TEMPLATE:'../../secret'}).configured,false);
  assert.equal(clientNotificationConfig({...env,WHATSAPP_ORDER_TEMPLATE:'',WHATSAPP_TEMPLATE_LANGUAGE:''}).configured,true);
  for(const PUBLIC_URL of ['http://localhost:3108','https://localhost:3108','https://127.0.0.1','https://user:secret@example.com','not a URL'])assert.equal(clientNotificationConfig({...env,PUBLIC_URL}).publicUrl,false);
});

test('a consented customer receives their status without owner credentials or organizer recipient',async()=>{
  const f=fixture();await f.service.runOnce();assert.equal(f.requests.length,1);
  const request=f.requests[0],body=JSON.parse(request.body),fields=body.template.components[0].parameters.map(p=>p.text);
  assert.equal(body.to,phone);assert.equal(body.type,'template');assert.equal(body.template.name,'customer_order_status');assert.equal(body.template.language.code,'ru');assert.equal(fields.length,4);assert.equal(fields[0],id);assert.equal(fields[1],'Арман & Айгерім');assert.match(fields[2],/обработ|в работе/i);assert.match(fields[3],/ответьте/);
  assert.equal(request.headers.Authorization,'Bearer TEST_CLIENT_WA_SECRET');
  assert.ok(!request.body.includes('PRIVATE_EDIT_TOKEN'));assert.ok(!request.body.includes('PRIVATE_EMAIL'));assert.ok(!request.body.includes('/admin'));assert.ok(!request.body.includes('/create'));assert.ok(!request.body.includes('77788562088'));
  assert.equal(f.writes[0].body.status,'sent');assert.equal(f.writes[0].body.provider_id,'wamid.client');assert.equal(f.writes[0].body.lease,null);assert.match(f.writes[0].url,/&lease=eq\./);assert.match(f.writes[0].url,/&status=eq.processing/);
  await f.service.runOnce();assert.equal(f.requests.length,1);
});

test('published updates share only a sanitized guest URL',async()=>{
  for(const [path,expected]of [['/arman-aigerim?t=PRIVATE_EDIT_TOKEN#owner','/arman-aigerim'],['https://external.example/arman-aigerim','/i/'+id],['/admin','/i/'+id],['/create?id='+id,'/i/'+id],['javascript:alert(1)','/i/'+id]]){
    const f=fixture({path,record:{status:'published',publishedAt:new Date().toISOString()},event:{order_status:'published'}});await f.service.runOnce();
    const body=JSON.parse(f.requests[0].body),detail=body.template.components[0].parameters[3].text;
    assert.equal(detail,'Гостевая ссылка: https://invite.example'+expected);assert.ok(!f.requests[0].body.includes('PRIVATE_EDIT_TOKEN'));
  }
});

test('a draft cannot receive a published guest link and a closed publication does not share one',async()=>{
  const draft=fixture({record:{status:'published'},event:{order_status:'published'}});await draft.service.runOnce();assert.equal(draft.requests.length,0);assert.equal(draft.writes[0].body.last_error,'PUBLICATION_MISSING');
  const closed=fixture({record:{status:'published',publishedAt:new Date().toISOString()},event:{order_status:'published'}});closed.invitation.data.closed=true;await closed.service.runOnce();assert.equal(closed.requests.length,1);assert.match(JSON.parse(closed.requests[0].body).template.components[0].parameters[3].text,/Доступ гостям закрыт/);assert.ok(!closed.requests[0].body.includes('https://invite.example'));assert.ok(!closed.requests[0].body.includes('Можно отправлять'));
});

test('revoked, changed or legacy unconsented recipients are skipped before contacting Meta',async()=>{
  for(const [whatsapp,error]of [[{...subscription(),enabled:false},'CONSENT_REVOKED'],[{...subscription(),consentVersion:'legacy'},'CONSENT_REVOKED'],[{...subscription(),phone:'77015550999'},'RECIPIENT_CHANGED'],[{...subscription(),consentedAt:'2026-10-28T08:01:00Z'},'CONSENT_CHANGED']]){
    const f=fixture({record:{notifications:{whatsapp}}});await f.service.runOnce();assert.equal(f.requests.length,0);assert.equal(f.writes[0].body.status,'skipped');assert.equal(f.writes[0].body.last_error,error);
  }
  const absent=fixture({record:{notifications:undefined}});await absent.service.runOnce();assert.equal(absent.requests.length,0);assert.equal(absent.writes[0].body.last_error,'CONSENT_REVOKED');
});

test('consent timestamps compare instants rather than Postgres timezone spelling',async()=>{
  const f=fixture({event:{consented_at:'2026-10-28T08:00:00+00:00'}});await f.service.runOnce();assert.equal(f.requests.length,1);assert.equal(f.writes[0].body.status,'sent');
});

test('superseded, expired and malformed events cannot send an obsolete status',async()=>{
  for(const [event,error]of [[{order_status:'accepted'},'STATUS_SUPERSEDED'],[{created_at:new Date(Date.now()-8*24*3600000).toISOString()},'EVENT_EXPIRED'],[{created_at:'invalid'},'EVENT_EXPIRED'],[{order_status:'arbitrary'},'INVALID_EVENT'],[{recipient:'7 701 555 0123'},'RECIPIENT_CHANGED'],[{channel:'telegram'},'INVALID_EVENT']]){
    const f=fixture({event});await f.service.runOnce();assert.equal(f.requests.length,0);assert.equal(f.writes[0].body.status,'skipped');assert.equal(f.writes[0].body.last_error,error);
  }
});

test('rejection reason is client-visible and template variables are bounded plain text',async()=>{
  const f=fixture({record:{status:'rejected',rejectionReason:'Неверная дата\nУточните время'},event:{order_status:'rejected'}});f.invitation.data.names='A\nB\t'+'x'.repeat(800);await f.service.runOnce();const fields=JSON.parse(f.requests[0].body).template.components[0].parameters;
  assert.match(fields[2].text,/Неверная дата/);for(const field of fields){assert.ok(field.text.length<=500);assert.doesNotMatch(field.text,/[\n\r\t]/)}
});

test('Kazakh status text follows an approved Kazakh template language',async()=>{
  const f=fixture({settings:{WHATSAPP_CLIENT_TEMPLATE_LANGUAGE:'kk_KZ'}});await f.service.runOnce();const body=JSON.parse(f.requests[0].body);assert.equal(body.template.language.code,'kk_KZ');assert.match(body.template.components[0].parameters[3].text,/хабарламаға/);assert.doesNotMatch(body.template.components[0].parameters[2].text,/обработ/i);
});

test('temporary provider failure retries, permanent rejection fails and raw errors stay private',async()=>{
  for(const [status,error,expected]of [[429,{code:130429,message:'PRIVATE_PROVIDER_DETAIL'},'retry'],[503,{code:1,message:'PRIVATE_PROVIDER_DETAIL'},'retry'],[400,{code:2,is_transient:true,message:'PRIVATE_PROVIDER_DETAIL'},'retry'],[401,{code:190,message:'PRIVATE_PROVIDER_DETAIL'},'failed']]){
    const f=fixture({provider:async()=>Response.json({error},{status,headers:{'retry-after':'90'}})});await f.service.runOnce();assert.equal(f.writes[0].body.status,expected);assert.equal(f.writes[0].body.last_error,'PROVIDER_'+error.code);assert.ok(Date.parse(f.writes[0].body.available_at)>Date.now()+85000);assert.ok(!JSON.stringify(f.writes).includes('PRIVATE_PROVIDER_DETAIL'));
  }
  const exhausted=fixture({event:{attempts:6},provider:async()=>{throw Error('PRIVATE_NETWORK_DETAIL')}});await exhausted.service.runOnce();assert.equal(exhausted.writes[0].body.status,'failed');assert.equal(exhausted.writes[0].body.last_error,'NETWORK_OR_TIMEOUT');
});

test('invalid provider responses retry without acknowledging delivery',async()=>{
  for(const provider of [async()=>({ok:true,json:async()=>{throw Error('PRIVATE_JSON')}}),async()=>Response.json({messages:[]})]){
    const f=fixture({provider});await f.service.runOnce();assert.equal(f.writes[0].body.status,'retry');assert.equal(f.writes[0].body.sent_at,undefined);assert.equal(f.writes[0].body.provider_id,undefined);
  }
});

test('disabled or nonpublic configuration never claims work or contacts the provider',async()=>{
  for(const settings of [{WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED:'0'},{WHATSAPP_CLIENT_STATUS_TEMPLATE:''},{PUBLIC_URL:'http://localhost:3108'}]){
    const f=fixture({settings});await f.service.runOnce();f.service.start();f.service.stop();assert.equal(f.reads.length,0);assert.equal(f.requests.length,0);
  }
});

test('queue failure is bounded and status never exposes credentials',async()=>{
  const service=createClientNotifications({env,sb:async()=>{throw Error('PRIVATE_DATABASE_DETAIL')},inv:async()=>{},fetchImpl:async()=>{throw Error('must not send')}});
  await service.runOnce();const state=await service.status();assert.equal(state.queueReady,false);assert.ok(state.lastError);assert.ok(!JSON.stringify(state).includes('PRIVATE_DATABASE_DETAIL'));assert.ok(!JSON.stringify(state).includes(env.WHATSAPP_ACCESS_TOKEN));
});

test('concurrent kicks do not claim a second batch while the first is running',async()=>{
  let finish,claims=0;const blocked=new Promise(resolve=>finish=resolve);
  const service=createClientNotifications({env,sb:async url=>{if(url.startsWith('/rpc/')){claims++;await blocked}return []},inv:async()=>{},fetchImpl:async()=>{throw Error('must not send')}});
  const first=service.runOnce();await service.runOnce();service.kick();assert.equal(claims,1);finish();await first;
});

test('administrator summaries omit the recipient and retries only reset failed jobs',async()=>{
  const f=fixture({settings:{WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED:'0'}});await f.service.forOrder(id);assert.match(f.reads[0].url,/limit=12$/);assert.doesNotMatch(f.reads[0].url,/recipient|provider_id/);
  await f.service.retry(id);assert.match(f.writes[0].url,/status=eq.failed$/);assert.equal(f.writes[0].body.status,'pending');assert.equal(f.writes[0].body.attempts,0);
  const before=f.reads.length;await f.service.forOrder('../bad');await f.service.retry('../bad');assert.equal(f.reads.length,before);
});
