import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowFixture} from './workflow-fixture.js';

const enabledEnv={WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED:'1',WHATSAPP_ACCESS_TOKEN:'TEST_API_TOKEN_ONLY',WHATSAPP_PHONE_NUMBER_ID:'987654',WHATSAPP_API_VERSION:'v99.0',WHATSAPP_CLIENT_STATUS_TEMPLATE:'customer_order_status',WHATSAPP_CLIENT_TEMPLATE_LANGUAGE:'ru'};
const contact={name:'Тестовый клиент',phone:'+7 (701) 555-01-23',email:'private-client@example.test'};

async function fixture(env={}){
  const {app,tables}=workflowFixture({env}),server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.on('listening',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const call=async(path,{method='GET',body,owner,admin}={})=>{
    const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(owner?{'x-owner-token':owner}:{}),...(admin?{'x-admin-key':admin===true?'test-admin':admin}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  const created=await call('/api/inv',{method:'POST',body:{data:{names:'Проверка уведомлений',dsg:0,lang:'ru'}}});
  assert.equal(created.status,200);
  const i=created.body;
  const submit=(version=i.version,extra={})=>call('/api/inv/'+i.id+'/order',{method:'POST',owner:i.tok,body:{version,contact,...extra}});
  const preferences=(version,whatsapp,owner=i.tok)=>call('/api/inv/'+i.id+'/order/notifications',{method:'PUT',owner,body:{version,whatsapp}});
  const admin=(version,status,extra={})=>call('/api/admin/orders/'+i.id+'/workflow',{method:'POST',admin:true,body:{version,status,...extra}});
  const publish=version=>call('/api/admin/orders/'+i.id+'/publish',{method:'POST',admin:true,body:{version}});
  return {app,tables,i,call,submit,preferences,admin,publish,close:()=>new Promise(resolve=>server.close(resolve))};
}

test('unconfigured public API is honest and an ordinary contact does not imply subscription',async()=>{
  const f=await fixture();try{
    const config=await f.call('/api/config');assert.equal(config.status,200);assert.equal(config.body.clientNotifications.whatsapp,false);
    const submitted=await f.submit();assert.equal(submitted.status,200);assert.equal(submitted.body.order.status,'submitted');assert.deepEqual(submitted.body.order.notifications.whatsapp,{enabled:false});
    assert.deepEqual(f.tables.shq_invitations[0].data._order.notifications.whatsapp,{enabled:false});
    assert.ok(!JSON.stringify(config.body).includes('WHATSAPP_ACCESS_TOKEN'));
  }finally{await f.close()}
});

test('malformed opt-in is rejected and unavailable WhatsApp cannot silently subscribe a customer',async()=>{
  const f=await fixture();try{
    for(const whatsapp of ['true',1,{enabled:true,phone:'77019999999',consentedAt:'2000-01-01'},null]){
      const result=await f.submit(f.i.version,{notifications:{whatsapp}});assert.equal(result.status,400);assert.equal(f.tables.shq_invitations[0].data._order,undefined);
    }
    const unavailable=await f.submit(f.i.version,{notifications:{whatsapp:true}});assert.equal(unavailable.status,503);assert.match(unavailable.body.error,/не подключен/i);assert.equal(f.tables.shq_invitations[0].data._order,undefined);
    const normal=await f.submit();assert.equal(normal.status,200);
    const enabled=await f.preferences(normal.body.version,true);assert.equal(enabled.status,503);assert.equal(f.tables.shq_invitations[0].data._order.notifications.whatsapp.enabled,false);
  }finally{await f.close()}
});

test('configured WhatsApp records an explicit normalized consent with server-owned timestamp and version',async()=>{
  const f=await fixture(enabledEnv);try{
    assert.equal((await f.call('/api/config')).body.clientNotifications.whatsapp,true);
    const before=Date.now();
    const result=await f.submit(f.i.version,{notifications:{whatsapp:true,phone:'77019999999',consentedAt:'2000-01-01',consentVersion:'forged'}});
    assert.equal(result.status,200);const prefs=result.body.order.notifications.whatsapp;
    assert.equal(prefs.enabled,true);assert.equal(prefs.phone,'77015550123');assert.equal(prefs.consentVersion,'order-status-v1');assert.ok(Date.parse(prefs.consentedAt)>=before);assert.ok(Date.parse(prefs.consentedAt)<=Date.now());
    assert.notEqual(result.body.version,f.i.version);assert.equal(f.tables.shq_invitations[0].data._rev,result.body.version);assert.deepEqual(f.tables.shq_invitations[0].data._order.notifications.whatsapp,prefs);
    const published=await f.publish(result.body.version);assert.equal(published.status,200);
    const guest=await f.call('/api/i/'+f.i.id);assert.equal(guest.status,200);assert.equal(guest.body.preview,false);
    const encoded=JSON.stringify(guest.body);for(const secret of [f.i.tok,'77015550123','private-client@example.test','consentedAt','consentVersion','_order','notifications'])assert.ok(!encoded.includes(secret),secret+' must not leak to guests');
  }finally{await f.close()}
});

test('only the owner with the current revision can revoke notifications, including after publication',async()=>{
  const f=await fixture(enabledEnv);try{
    const submitted=await f.submit(f.i.version,{notifications:{whatsapp:true}});assert.equal(submitted.status,200);const version=submitted.body.version;
    assert.equal((await f.preferences(version,false,null)).status,403);
    assert.equal((await f.preferences(version,false,'b'.repeat(48))).status,403);
    assert.equal((await f.call('/api/inv/'+f.i.id+'/order/notifications',{method:'PUT',admin:true,body:{version,whatsapp:false}})).status,403);
    assert.equal((await f.preferences(f.i.version,false)).status,409);
    assert.equal(f.tables.shq_invitations[0].data._order.notifications.whatsapp.enabled,true);
    const published=await f.publish(version);assert.equal(published.status,200);
    assert.equal((await f.preferences(published.body.version,'false')).status,400);
    const revoked=await f.preferences(published.body.version,false);assert.equal(revoked.status,200);assert.equal(revoked.body.order.status,'published');assert.equal(revoked.body.order.notifications.whatsapp.enabled,false);assert.notEqual(revoked.body.version,published.body.version);
    assert.equal((await f.preferences(published.body.version,true)).status,409);
    assert.equal((await f.call('/api/i/'+f.i.id)).status,200);
  }finally{await f.close()}
});

test('contact edits retain same-number consent but changing the number clears it without renewed opt-in',async()=>{
  const f=await fixture(enabledEnv);try{
    const submitted=await f.submit(f.i.version,{notifications:{whatsapp:true}});assert.equal(submitted.status,200);const first=submitted.body.order.notifications.whatsapp;
    const same=await f.submit(submitted.body.version,{contact:{...contact,phone:'+7 701 555 0123',name:'Уточнённое имя'}});assert.equal(same.status,200);assert.deepEqual(same.body.order.notifications.whatsapp,first);
    const changed=await f.submit(same.body.version,{contact:{...contact,phone:'+7 701 555 09 99'}});assert.equal(changed.status,200);assert.deepEqual(changed.body.order.notifications.whatsapp,{enabled:false});
    const confirmed=await f.submit(changed.body.version,{contact:{...contact,phone:'+7 701 555 09 99'},notifications:{whatsapp:true}});assert.equal(confirmed.status,200);assert.equal(confirmed.body.order.notifications.whatsapp.enabled,true);assert.equal(confirmed.body.order.notifications.whatsapp.phone,'77015550999');
    const emailOnly=await f.submit(confirmed.body.version,{contact:{...contact,phone:''}});assert.equal(emailOnly.status,200);assert.equal(emailOnly.body.order.notifications.whatsapp.enabled,false);
  }finally{await f.close()}
});

test('a client cannot forge the administrator status or subscription through invitation data',async()=>{
  const f=await fixture();try{
    const submitted=await f.submit();assert.equal(submitted.status,200);
    const forged=await f.call('/api/inv/'+f.i.id,{method:'PUT',owner:f.i.tok,body:{version:submitted.body.version,data:{names:'Новый заголовок',_order:{status:'accepted',notifications:{whatsapp:{enabled:true,phone:'77019999999',consentedAt:new Date().toISOString(),consentVersion:'order-status-v1'}}}}}});
    assert.equal(forged.status,200);const stored=f.tables.shq_invitations[0].data._order;assert.equal(stored.status,'submitted');assert.equal(stored.notifications.whatsapp.enabled,false);
    assert.equal((await f.call('/api/admin/orders/'+f.i.id+'/workflow',{method:'POST',owner:f.i.tok,body:{version:forged.body.version,status:'accepted'}})).status,403);
  }finally{await f.close()}
});

test('administrator rejection requires a client-visible reason and blocks publication until resubmission',async()=>{
  const f=await fixture();try{
    const submitted=await f.submit();assert.equal(submitted.status,200);let version=submitted.body.version;
    assert.equal((await f.admin(version,'rejected')).status,400);assert.equal((await f.admin(version,'rejected',{rejectionReason:'  '})).status,400);assert.equal(f.tables.shq_invitations[0].data._order.status,'submitted');
    const reason='Уточните дату мероприятия.';
    const rejected=await f.admin(version,'rejected',{rejectionReason:reason});assert.equal(rejected.status,200);version=rejected.body.version;assert.equal(rejected.body.order.status,'rejected');assert.equal(rejected.body.order.rejectionReason,reason);assert.ok(rejected.body.order.history.some(e=>e.status==='rejected'&&e.text===reason));
    const ownerStatus=await f.call('/api/inv/'+f.i.id+'/status',{owner:f.i.tok});assert.equal(ownerStatus.body.order.rejectionReason,reason);
    assert.equal((await f.call('/api/inv/'+f.i.id+'/order/revisions',{method:'POST',owner:f.i.tok,body:{version,text:'Обойти отказ'}})).status,409);
    assert.equal((await f.call('/api/inv/'+f.i.id+'/order/accept',{method:'POST',owner:f.i.tok,body:{version,quoteId:'old-quote'}})).status,409);
    const denied=await f.publish(version);assert.equal(denied.status,409);assert.match(denied.body.error,/отклонена/i);assert.equal((await f.call('/api/i/'+f.i.id)).status,402);
    const resubmitted=await f.submit(version,{note:'Исправил дату'});assert.equal(resubmitted.status,200);assert.equal(resubmitted.body.order.status,'submitted');assert.equal(resubmitted.body.order.rejectionReason,'');
    assert.ok(resubmitted.body.order.history.some(e=>e.status==='rejected'&&e.text===reason),'rejection history is preserved');
  }finally{await f.close()}
});

test('accepted and processing statuses are explicit administrator decisions and reject stale revisions',async()=>{
  const f=await fixture();try{
    const submitted=await f.submit();assert.equal(submitted.status,200);
    const accepted=await f.admin(submitted.body.version,'accepted');assert.equal(accepted.status,200);assert.equal(accepted.body.order.status,'accepted');assert.equal(accepted.body.order.approval,null,'organizer acceptance is distinct from client price approval');
    const stale=await f.admin(submitted.body.version,'processing');assert.equal(stale.status,409);assert.equal(f.tables.shq_invitations[0].data._order.status,'accepted');
    const processing=await f.admin(accepted.body.version,'processing');assert.equal(processing.status,200);assert.equal(processing.body.order.status,'processing');
    const detail=await f.call('/api/admin/orders/'+f.i.id,{admin:true});assert.equal(detail.status,200);assert.equal(detail.body.order.status,'processing');assert.ok(Array.isArray(detail.body.clientNotifications));assert.ok(!JSON.stringify(detail.body).includes(f.i.tok));
    const published=await f.publish(processing.body.version);assert.equal(published.status,200);assert.equal(published.body.order.status,'published');
    assert.equal((await f.admin(published.body.version,'processing')).status,400);
  }finally{await f.close()}
});
