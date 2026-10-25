import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowFixture} from './workflow-fixture.js';

async function fixture(){const {app,tables}=workflowFixture(),server=app.listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const origin='http://127.0.0.1:'+server.address().port;
  const call=async(path,{method='GET',body,owner,admin}={})=>{const response=await fetch(origin+path,{method,headers:{'Content-Type':'application/json',...(owner?{'x-owner-token':owner}:{}),...(admin?{'x-admin-key':'test-admin'}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json()}};
  const i=(await call('/api/inv',{method:'POST',body:{data:{names:'Тестовый праздник',lang:'ru',dsg:0}}})).body;
  return {call,tables,i,close:()=>new Promise(r=>server.close(r))};
}
test('services, revisions, custom quote, approved snapshot, archive and safe history work together',async()=>{
  const f=await fixture();try{const {id,tok}=f.i;let version=f.i.version;
    const owner=(suffix,body)=>f.call('/api/inv/'+id+suffix,{method:'POST',owner:tok,body:{version,...body}}),admin=(suffix,body)=>f.call('/api/admin/orders/'+id+suffix,{method:'POST',admin:true,body:{version,...body}});
    assert.equal((await f.call('/api/admin/services')).status,403);
    const services=await f.call('/api/services');assert.equal(services.body.length,3);
    const sent=await owner('/order',{contact:{name:'Клиент',email:'client@example.com'},services:['urgent']});assert.equal(sent.status,200);version=sent.body.version;assert.equal(sent.body.order.price,3990);
    assert.equal((await f.call('/api/admin/orders/'+id+'/workflow',{method:'POST',owner:tok,body:{version,status:'ready'}})).status,403);
    let j=await owner('/order/revisions',{text:'Поменять подпись'});assert.equal(j.status,200);version=j.body.version;const revision=j.body.order.revisions[0].id;
    assert.equal((await admin('/publish',{})).status,409);
    j=await admin('/revisions/'+revision,{done:true});version=j.body.version;
    j=await admin('/quote',{amount:7000,note:'Срочное изготовление включено'});assert.equal(j.status,200);version=j.body.version;const quote=j.body.order.quote.id;
    assert.equal((await admin('/publish',{})).status,409);
    j=await owner('/order/accept',{quoteId:quote});assert.equal(j.status,200);version=j.body.version;assert.equal(j.body.order.approval.current,true);assert.equal(j.body.order.price,7000);assert.ok(!JSON.stringify(j.body).includes('snapshot'));
    const snapshot=await f.call('/api/inv/'+id+'/order/agreement',{owner:tok});assert.equal(snapshot.body.data.names,'Тестовый праздник');
    j=await f.call('/api/inv/'+id,{method:'PUT',owner:tok,body:{version,data:{names:'Изменённый праздник',dsg:0}}});version=j.body.version;
    assert.equal((await admin('/publish',{})).status,409);assert.equal((await f.call('/api/inv/'+id+'/order/agreement',{owner:tok})).body.data.names,'Тестовый праздник');
    j=await owner('/order/accept',{quoteId:quote});version=j.body.version;
    j=await admin('/publish',{});assert.equal(j.status,200);version=j.body.version;
    j=await admin('/workflow',{archived:true,rsvpAlerts:true});assert.equal(j.status,200);version=j.body.version;
    assert.equal((await f.call('/api/i/'+id)).status,200);assert.equal((await f.call('/api/admin/list?archived=true',{admin:true})).body.items.length,1);assert.equal((await f.call('/api/admin/list',{admin:true})).body.items.length,0);
    assert.ok(!JSON.stringify((await f.call('/api/admin/list?archived=true',{admin:true})).body).includes('snapshot'));assert.ok(!JSON.stringify((await f.call('/api/i/'+id)).body).includes('7000'));
    j=await admin('/workflow',{archived:false});assert.equal(j.status,200);assert.ok(j.body.order.history.some(e=>e.action==='restored'));
    const stats=(await f.call('/api/admin/statistics',{admin:true})).body;assert.equal(stats.total,1);assert.equal(stats.published,1);assert.equal(stats.agreed_amount,7000);
  }finally{await f.close()}
});

test('reviews require a published order and consent; only admin can expose a current review',async()=>{
  const f=await fixture();try{const {id,tok}=f.i;let version=f.i.version;
    const order=await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version,contact:{name:'Клиент',email:'client@example.com'}}});version=order.body.version;
    const body={name:'Клиент <img>',rating:5,text:'Отзыв <script>test</script>',consent:true};
    assert.equal((await f.call('/api/inv/'+id+'/review',{method:'POST',owner:tok,body})).status,403);
    await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:true,body:{version}});
    assert.equal((await f.call('/api/inv/'+id+'/review',{method:'POST',owner:tok,body:{...body,consent:false}})).status,400);
    const review=await f.call('/api/inv/'+id+'/review',{method:'POST',owner:tok,body});assert.equal(review.status,200);assert.equal((await f.call('/api/reviews')).body.length,0);
    assert.equal((await f.call('/api/admin/reviews/'+id,{method:'POST',owner:tok,body:{version:review.body.version,status:'approved'}})).status,403);
    const approved=await f.call('/api/admin/reviews/'+id,{method:'POST',admin:true,body:{version:review.body.version,status:'approved'}});assert.equal(approved.status,200);
    const publicReviews=(await f.call('/api/reviews')).body;assert.equal(publicReviews.length,1);assert.equal(publicReviews[0].name,body.name);assert.ok(!JSON.stringify(publicReviews).includes(id));
    assert.equal((await f.call('/api/admin/reviews/'+id,{method:'POST',admin:true,body:{version:review.body.version,status:'hidden'}})).status,409);
    const changed=await f.call('/api/inv/'+id+'/review',{method:'POST',owner:tok,body:{...body,version:approved.body.version,text:'Изменённый отзыв'}});assert.equal(changed.status,200);assert.equal((await f.call('/api/reviews')).body.length,0);
  }finally{await f.close()}
});

test('service prices and quote replacements reject stale confirmation',async()=>{
  const f=await fixture();try{
    const {id,tok}=f.i,service=(await f.call('/api/services')).body[0];
    const changed=await f.call('/api/admin/services/'+service.id,{method:'PUT',admin:true,body:{price:2000,enabled:true,version:service.version}});assert.equal(changed.status,200);
    assert.equal((await f.call('/api/admin/services/'+service.id,{method:'PUT',admin:true,body:{price:1,enabled:true,version:service.version}})).status,409);
    assert.equal((await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version:f.i.version,contact:{name:'Клиент',email:'client@example.com'},services:[service.id],serviceVersions:{[service.id]:service.version}}})).status,409);
    let j=await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version:f.i.version,contact:{name:'Клиент',email:'client@example.com'}}}),version=j.body.version;
    const quote=async amount=>{const response=await f.call('/api/admin/orders/'+id+'/quote',{method:'POST',admin:true,body:{version,amount}});version=response.body.version;return response.body.order.quote.id};
    const q1=await quote(5000);j=await f.call('/api/inv/'+id+'/order/accept',{method:'POST',owner:tok,body:{version,quoteId:q1}});version=j.body.version;assert.equal(j.body.order.approval.current,true);
    await quote(6000);const status=await f.call('/api/inv/'+id+'/status',{owner:tok});assert.equal(status.body.order.approval.current,false);
    assert.equal((await f.call('/api/inv/'+id+'/order/accept',{method:'POST',owner:tok,body:{version,quoteId:q1}})).status,409);
    assert.equal((await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:true,body:{version}})).status,409);
    j=await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version,services:['urgent'],contact:{name:'Клиент',email:'client@example.com'}}});assert.equal(j.status,200);version=j.body.version;assert.equal(j.body.order.needsAgreement,true);assert.ok(j.body.order.approval,'previous approved copy must remain accessible');assert.equal(j.body.order.approval.current,false);
    assert.equal((await f.call('/api/inv/'+id+'/order/agreement',{owner:tok})).status,200);assert.equal((await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:true,body:{version}})).status,409);
  }finally{await f.close()}
});
