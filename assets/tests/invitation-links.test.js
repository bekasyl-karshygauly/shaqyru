import test from 'node:test';
import assert from 'node:assert/strict';
import {invitationSlug,validInvitationSlug} from '../public/invitation-links.js';
import {workflowFixture} from './workflow-fixture.js';

test('Russian and Kazakh names become safe, readable slugs with route protection',()=>{
  assert.equal(invitationSlug('Арман & Айгерім'),'arman-aigerim');assert.equal(invitationSlug('Қуаныш + Әсел'),'quanysh-asel');assert.equal(invitationSlug('  Élena — Андрей  '),'elena-andrei');
  for(const names of ['', 'admin', '🔥', 'aa', 'a'.repeat(200),'<script>alert(1)</script>']){const slug=invitationSlug(names);assert.ok(validInvitationSlug(slug));assert.ok(slug.length<=54)}
  for(const s of ['admin','create','../test','a/b','Aigerim','a--b','-abc','abc-','12345678','a'.repeat(71)])assert.equal(validInvitationSlug(s),false);
});

async function fixture(){const {app,tables}=workflowFixture(),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const base='http://127.0.0.1:'+server.address().port;
  const call=async(url,{method='GET',body,owner,admin}={})=>{const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(owner?{'x-owner-token':owner}:{}),...(admin?{'x-admin-key':'test-admin'}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:(r.headers.get('content-type')||'').includes('json')?await r.json():await r.text()}};
  const create=async()=>{const i=(await call('/api/inv',{method:'POST',body:{data:{names:'Арман & Айгерім',lang:'ru',dsg:0}}})).body;return i};
  const publish=async i=>{const submitted=await call('/api/inv/'+i.id+'/order',{method:'POST',owner:i.tok,body:{version:i.version,contact:{name:'Клиент',email:'test@example.com'}}});return call('/api/admin/orders/'+i.id+'/publish',{method:'POST',admin:true,body:{version:submitted.body.version}})};
  return {call,tables,create,publish,close:()=>new Promise(r=>server.close(r))};
}

test('publication allocates a stable unique address; old links, personalized guests and privacy still work',async()=>{
  const f=await fixture();try{
    const first=await f.create();assert.equal((await f.call('/api/inv/'+first.id+'/link',{method:'POST',body:{}})).status,403);assert.equal((await f.call('/api/inv/'+first.id+'/link',{method:'POST',owner:first.tok,body:{}})).status,402);assert.equal(f.tables.shq_invitation_slugs.length,0);
    const published=await f.publish(first);assert.equal(published.status,200);assert.equal(published.body.guestPath,'/arman-aigerim');
    const same=await Promise.all([1,2,3].map(()=>f.call('/api/inv/'+first.id+'/link',{method:'POST',owner:first.tok,body:{}})));assert.ok(same.every(r=>r.body.path==='/arman-aigerim'));assert.equal(f.tables.shq_invitation_slugs.length,1);
    const second=await f.create();assert.equal((await f.publish(second)).body.guestPath,'/arman-aigerim-2');
    const html=await f.call('/arman-aigerim?g=aaaaaaaaaa');assert.equal(html.status,200);assert.ok(html.body.includes('name="shq-invitation-id" content="'+first.id+'"'));assert.ok(html.body.includes('https://invite.example/arman-aigerim'));assert.ok(!html.body.includes(first.tok));assert.equal((await f.call('/i/'+first.id)).status,200);assert.equal((await f.call('/api/i/'+first.id)).status,200);
    assert.equal((await f.call('/api/admin/orders/'+first.id,{admin:true})).body.guestPath,'/arman-aigerim');
    await f.call('/api/inv/'+first.id+'/guests',{method:'POST',owner:first.tok,body:{names:['Алия']}});const guest=f.tables.shq_guests[0];assert.equal((await f.call('/api/i/'+first.id+'?g='+guest.code)).body.guest.name,'Алия');
    assert.equal((await f.call('/api/rsvp/'+first.id,{method:'POST',body:{code:guest.code,status:'yes',cnt:2}})).status,200);
    const edited=await f.call('/api/inv/'+first.id,{method:'PUT',owner:first.tok,body:{version:published.body.version,data:{names:'Новые имена'}}});assert.equal(edited.status,200);
    const protectedState=await f.call('/api/inv/'+first.id+'/password',{method:'PUT',owner:first.tok,body:{version:edited.body.version,password:'private123'}});assert.equal(protectedState.status,200);
    assert.equal((await f.call('/api/inv/'+first.id+'/link',{method:'POST',owner:first.tok,body:{}})).body.path,'/arman-aigerim');assert.equal((await f.call('/api/i/'+first.id)).status,401);
    const protectedHtml=await f.call('/arman-aigerim');assert.ok(!protectedHtml.body.includes('Новые имена'));assert.ok(!protectedHtml.body.includes('private123'));
    const closed=await f.call('/api/inv/'+first.id,{method:'PUT',owner:first.tok,body:{version:protectedState.body.version,data:{names:'Новые имена',closed:true}}});assert.equal(closed.status,200);assert.equal((await f.call('/api/i/'+first.id)).status,410);
    assert.equal((await f.call('/does-not-exist')).status,404);
  }finally{await f.close()}
});

test('Telegram test endpoint requires admin access and has a useful missing-configuration error',async()=>{
  const f=await fixture();try{assert.equal((await f.call('/api/admin/notifications/telegram/test',{method:'POST',body:{}})).status,403);const r=await f.call('/api/admin/notifications/telegram/test',{method:'POST',admin:true,body:{}});assert.equal(r.status,503);assert.match(r.body.error,/токен бота/)}finally{await f.close()}
});
