// Integration smoke test against the configured project. Only records created
// by this run are removed. No payment is created and no email is sent here.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const origin=process.env.PUBLIC_URL||'http://localhost:3108';
const base=process.env.SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_KEY;
if(!base||!key)throw Error('Configure Supabase before running this check');
const headers={apikey:key,...(key.startsWith('sb_')?{}:{Authorization:'Bearer '+key}),'Content-Type':'application/json'};
const marker='QA '+crypto.randomUUID();
let invitation,audioPath,cloudId,userId,cookies='';
async function call(path,{method='GET',body,owner,cookie=cookies}={}){
  const r=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(owner?{'x-owner-token':owner}:{}),...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  const j=await r.json();return {r,j};
}
async function db(path,method='GET',body){
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Database verification failed: HTTP '+r.status);
  const text=await r.text();return text?JSON.parse(text):null;
}
function ok(check,label){assert.ok(check,label);console.log('OK: '+label)}
function wave(){const b=Buffer.alloc(44+16000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(8000,24);b.writeUInt32LE(16000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(16000,40);return b}
try{
  if(process.argv.includes('--account')){
    if(!process.env.QA_EMAIL||!/^\d{6,8}$/.test(process.env.QA_CODE||''))throw Error('QA_EMAIL and QA_CODE are required for account check');
    const login=await call('/api/account/verify',{method:'POST',body:{email:process.env.QA_EMAIL,code:process.env.QA_CODE},cookie:''});
    ok(login.r.status===200,'Email code accepted by real Supabase Auth');userId=login.j.user.id;
    const set=login.r.headers.getSetCookie();ok(set.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')),'Session cookies are protected');
    cookies=set.map(c=>c.split(';')[0]).join('; ');
    const session=await call('/api/account/session');ok(session.j.user?.id===userId&&session.j.storageReady,'Authenticated session and cloud storage work');
    cloudId=crypto.randomUUID();
    const created=await call('/api/account/drafts/'+cloudId,{method:'PUT',body:{version:null,data:{lang:'ru',names:marker,anim:'polaroid',introPhoto:'/covers/wedding.jpg'}}});
    ok(created.r.status===200,'Cloud draft saved in real database');
    const restored=await call('/api/account/drafts/'+cloudId);ok(restored.j.data.names===marker&&restored.j.data.anim==='polaroid','Cloud draft restored with photo and animation');
    const anon=await call('/api/account/drafts/'+cloudId,{cookie:''});ok(anon.r.status===401,'Anonymous client cannot read cloud draft');
    const changed=await call('/api/account/drafts/'+cloudId,{method:'PUT',body:{version:created.j.version,data:{names:marker+' updated',anim:'album'}}});ok(changed.r.status===200,'Cloud draft version updated');
    const stale=await call('/api/account/drafts/'+cloudId,{method:'PUT',body:{version:created.j.version,data:{names:'stale'}}});ok(stale.r.status===409,'Stale device cannot overwrite a newer draft');
    const refreshCookie=set.find(c=>c.startsWith('shq_refresh='))?.split(';')[0];
    const refreshed=await call('/api/account/session',{cookie:refreshCookie});ok(refreshed.j.user?.id===userId&&refreshed.r.headers.getSetCookie().length===2,'Expired access session can be restored through refresh cookie');
    cookies=refreshed.r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  }
  const created=await call('/api/inv',{method:'POST',body:{data:{lang:'ru',names:marker,anim:'mosaic',rsvpQuestions:['children','diet','transfer']}}});
  ok(created.r.status===200&&/^[a-f0-9]{32}$/.test(created.j.id),'Invitation created through website API');invitation=created.j;
  const denied=await call('/api/inv/'+invitation.id+'/status',{owner:'0'.repeat(48)});ok(denied.r.status===403,'Wrong owner token is rejected');
  const audio=wave();
  const uploaded=await call('/api/upload-audio',{method:'POST',owner:invitation.tok,body:{inv:invitation.id,name:marker+'.wav',data:'data:audio/wav;base64,'+audio.toString('base64')}});
  ok(uploaded.r.status===200,'Music uploaded through website into Supabase Storage');
  const prefix=base+'/storage/v1/object/public/'+(process.env.AUDIO_BUCKET||'shaqyru-audio')+'/';
  assert.ok(uploaded.j.url.startsWith(prefix));audioPath=uploaded.j.url.slice(prefix.length);assert.ok(audioPath.startsWith(invitation.id+'/'));
  const media=await fetch(uploaded.j.url,{signal:AbortSignal.timeout(15000)});ok(media.ok&&Buffer.from(await media.arrayBuffer()).equals(audio),'Uploaded audio can be downloaded without corruption');
  const changed=await call('/api/inv/'+invitation.id,{method:'PUT',owner:invitation.tok,body:{version:invitation.version,data:{names:marker,lang:'ru',anim:'mosaic',mus:uploaded.j.url,musTitle:marker,rsvpQuestions:['children','diet','transfer']}}});
  ok(changed.r.status===200,'Invitation saves music URL and version');
  const restored=await call('/api/i/'+invitation.id,{owner:invitation.tok});ok(restored.r.status===200&&restored.j.data.mus===uploaded.j.url&&restored.j.data.anim==='mosaic'&&restored.j.rsvpDetailsReady,'Owner preview reads saved music, animation and RSVP configuration');
  const guest=await call('/api/i/'+invitation.id,{cookie:''});ok(guest.r.status===402,'Unpaid invitation remains closed to guests');
  const rsvp=await call('/api/rsvp/'+invitation.id,{method:'POST',body:{name:marker,status:'yes',cnt:2},cookie:''});ok(rsvp.r.status===404,'Unpaid invitation cannot collect guest responses');
  if(process.argv.includes('--orders')){
    if(!process.env.ADMIN_KEY)throw Error('ADMIN_KEY required for publication check');
    const submitted=await call('/api/inv/'+invitation.id+'/order',{method:'POST',owner:invitation.tok,body:{version:changed.j.version,contact:{name:marker,email:'qa@example.com'},note:'Temporary integration check'}});ok(submitted.r.status===200,'Manual order submitted');
    const adminHeaders={'x-admin-key':process.env.ADMIN_KEY,'Content-Type':'application/json'};
    const list=await fetch(origin+'/api/admin/list',{headers:adminHeaders,signal:AbortSignal.timeout(15000)});const listed=await list.json();ok(list.ok&&listed.items.some(i=>i.id===invitation.id),'Order is visible in organizer cabinet');
    const published=await fetch(origin+'/api/admin/orders/'+invitation.id+'/publish',{method:'POST',headers:adminHeaders,body:JSON.stringify({version:submitted.j.version}),signal:AbortSignal.timeout(15000)});ok(published.ok,'Administrator publishes without a payment record');
    const opened=await call('/api/i/'+invitation.id,{cookie:''});ok(opened.r.status===200&&opened.j.preview===false,'Published invitation opens for guests');
    const answered=await call('/api/rsvp/'+invitation.id,{method:'POST',body:{name:marker,status:'yes',cnt:2,requestId:crypto.randomUUID(),details:{children:1,diet:'QA',transfer:true}},cookie:''});ok(answered.r.status===200,'Guest RSVP is written into the real database');
    const rows=await call('/api/inv/'+invitation.id+'/guests',{owner:invitation.tok});ok(rows.j.some(g=>g.name===marker&&g.details?.children===1&&g.cnt===2),'Organizer reads guest responses and extra answers');
    const payments=await db('/rest/v1/shq_payments?inv=eq.'+invitation.id+'&select=id');ok(payments.length===0,'No online payment was created');
  }
}finally{
  if(audioPath)await db('/storage/v1/object/'+(process.env.AUDIO_BUCKET||'shaqyru-audio'),'DELETE',{prefixes:[audioPath]});
  if(invitation)await db('/rest/v1/shq_invitations?id=eq.'+invitation.id,'DELETE');
  if(cloudId&&userId)await db('/rest/v1/shq_cloud_drafts?user_id=eq.'+userId+'&id=eq.'+cloudId,'DELETE');
  if(cookies)await call('/api/account/logout',{method:'POST',body:{}});
  console.log('Cleanup: only this run’s test records and audio removed');
}
