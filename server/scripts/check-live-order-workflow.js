import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createApp} from '../server.js';
if(process.env.TELEGRAM_BOT_TOKEN||process.env.WHATSAPP_ACCESS_TOKEN)throw Error('Use an isolated database when real notification providers are enabled.');
const env={...process.env,TELEGRAM_BOT_TOKEN:'',WHATSAPP_ACCESS_TOKEN:''},server=createApp({env}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
const origin='http://127.0.0.1:'+server.address().port;let id=null,token=null,version=null;
const headers={apikey:env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json'};if(!env.SUPABASE_SERVICE_KEY.startsWith('sb_'))headers.Authorization='Bearer '+env.SUPABASE_SERVICE_KEY;
async function db(path,options={}){const r=await fetch(env.SUPABASE_URL.replace(/\/$/,'')+'/rest/v1'+path,{...options,headers});assert.ok(r.ok,'Database check failed: '+r.status);const text=await r.text();return text?JSON.parse(text):null}
async function call(path,{method='GET',body,admin=false,owner=false,status=200}={}){const r=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(admin?{'x-admin-key':env.ADMIN_KEY}:{}),...(owner?{'x-owner-token':token}:{})},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify({path,error:j.error}));return j}
const client=(path,body)=>call('/api/inv/'+id+path,{method:'POST',owner:true,body:{version,...body}}),admin=(path,body)=>call('/api/admin/orders/'+id+path,{method:'POST',admin:true,body:{version,...body}});
try{
  const created=await call('/api/inv',{method:'POST',body:{data:{names:'QA Workflow '+crypto.randomUUID(),lang:'ru',dsg:0}}});({id,tok:token,version}=created);
  let j=await client('/order',{contact:{name:'QA Workflow',email:'qa@example.invalid'},services:['text']});version=j.version;assert.equal(j.order.services[0].id,'text');
  j=await client('/order/revisions',{text:'QA transaction revision'});version=j.version;const revision=j.order.revisions[0].id;
  await call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:true,status:409,body:{version}});
  j=await admin('/revisions/'+revision,{done:true});version=j.version;
  j=await admin('/quote',{amount:5000,note:'QA agreed total'});version=j.version;const quoteId=j.order.quote.id;
  j=await client('/order/accept',{quoteId});version=j.version;assert.equal(j.order.approval.current,true);
  const snapshot=await call('/api/inv/'+id+'/order/agreement',{owner:true});assert.equal(snapshot.price,5000);assert.ok(snapshot.data.names.startsWith('QA Workflow'));
  j=await admin('/workflow',{rsvpAlerts:true});version=j.version;j=await admin('/publish',{});version=j.version;
  const response={name:'QA Guest',status:'yes',cnt:2,requestId:crypto.randomUUID()};await call('/api/rsvp/'+id,{method:'POST',body:response});await call('/api/rsvp/'+id,{method:'POST',body:response});
  const jobs=await db('/shq_order_notifications?inv=eq.'+id+'&select=channel,kind,status');assert.equal(jobs.filter(x=>x.kind==='rsvp').length,2);assert.ok(jobs.every(x=>x.status==='pending'));
  const guest=await call('/api/i/'+id);assert.ok(!JSON.stringify(guest).includes('QA agreed total'));assert.ok(!JSON.stringify(guest).includes('qa@example.invalid'));
  const review=await call('/api/inv/'+id+'/review',{method:'POST',owner:true,body:{name:'QA Workflow',rating:5,text:'QA moderation check',consent:true}});assert.equal(review.status,'pending');
  await call('/api/admin/reviews/'+id,{method:'POST',admin:true,body:{version:review.version,status:'hidden'}});
  assert.ok(!(await call('/api/reviews')).some(x=>x.text==='QA moderation check'));
  j=await admin('/workflow',{archived:true});version=j.version;const list=await call('/api/admin/list?archived=true&status=all',{admin:true});assert.ok(list.items.some(x=>x.id===id));assert.ok(!JSON.stringify(list).includes('snapshot'));assert.equal((await call('/api/i/'+id)).data.names,snapshot.data.names);
  const stats=await call('/api/admin/statistics',{admin:true});assert.ok(stats.total>=1);assert.ok(Number(stats.agreed_amount)>=5000);
  console.log('Live workflow passed: services, revisions, quote, approved snapshot, publication, RSVP alert deduplication, private review, archive, statistics.');
}finally{
  if(id){await db('/shq_invitations?id=eq.'+id,{method:'DELETE'});assert.equal((await db('/shq_order_notifications?inv=eq.'+id+'&select=id')).length,0);console.log('Only the QA invitation and its dependent records were removed.');}
  server.closeAllConnections();await new Promise(r=>server.close(r));
}
