import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
async function fixture(){
  const rows=[],guests=[];let paymentWrites=0;
  const fetchImpl=async(url,o={})=>{const u=new URL(url),b=o.body?JSON.parse(o.body):null;
    if(u.pathname.endsWith('/shq_payments')){if(o.method&&o.method!=='GET')paymentWrites++;return Response.json([])}
    if(u.pathname.endsWith('/shq_invitations')){
      if(o.method==='POST'){rows.push(b);return Response.json(null)}
      const selected=rows.filter(i=>!u.searchParams.has('id')||u.searchParams.get('id')==='eq.'+i.id);
      if(o.method==='PATCH'){const found=selected.filter(i=>u.searchParams.get('data->>_rev')===(i.data._rev?'eq.'+i.data._rev:'is.null'));found.forEach(i=>Object.assign(i,b));return Response.json(found.map(i=>({id:i.id})))}
      if(u.searchParams.get('select')?.includes('orderStatus:'))return Response.json(rows.filter(i=>i.data._order).map(i=>({id:i.id,names:i.data.names,orderStatus:i.data._order.status,orderContact:i.data._order.contact,orderSubmitted:i.data._order.submittedAt,orderPrice:i.data._order.price,created:i.created})));
      return Response.json(selected);
    }
    if(u.pathname.endsWith('/shq_guests')){if(o.method==='POST'){guests.push(...(Array.isArray(b)?b:[b]));return Response.json(null)}const found=guests.filter(g=>(!u.searchParams.has('inv')||u.searchParams.get('inv')==='eq.'+g.inv)&&(!u.searchParams.has('code')||u.searchParams.get('code')==='eq.'+g.code));if(o.method==='PATCH')found.forEach(g=>Object.assign(g,b));return Response.json(found)}
    throw Error('Unexpected path '+u.pathname);
  };
  const server=createApp({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_KEY:'sb_secret_test',ADMIN_KEY:'test-admin'},fetchImpl}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const call=async(path,{method='GET',body,owner,admin}={})=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(owner?{'x-owner-token':owner}:{}),...(admin?{'x-admin-key':admin}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()}};
  const created=await call('/api/inv',{method:'POST',body:{data:{names:'Арман и Айгерім',lang:'ru',rsvpQuestions:['children','diet']}}});
  return {call,i:created.body,rows,guests,get paymentWrites(){return paymentWrites},close:()=>new Promise(r=>server.close(r))};
}
test('client submits an order; only admin publishes; guest links and RSVP then work without payment',async()=>{
  const f=await fixture();try{
    const {id,tok}=f.i;let version=f.i.version;
    assert.equal((await f.call('/api/i/'+id)).status,402);
    assert.equal((await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',body:{version},owner:tok})).status,403);
    assert.equal((await f.call('/api/inv/'+id+'/order',{method:'POST',body:{version,contact:{name:'Клиент'}},owner:tok})).status,400);
    const submitted=await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version,contact:{name:'Клиент',phone:'+7 700 123 45 67'},note:'Обсудим детали'}});assert.equal(submitted.status,200);version=submitted.body.version;
    assert.equal(submitted.body.order.price,2490);assert.equal((await f.call('/api/admin/notifications')).status,403);
    assert.equal((await f.call('/api/admin/list')).status,403);const list=await f.call('/api/admin/list',{admin:'test-admin'});assert.equal(list.body.items.length,1);assert.equal(list.body.items[0].order.status,'submitted');assert.ok(!JSON.stringify(list.body).includes(tok));
    const detail=await f.call('/api/admin/orders/'+id,{admin:'test-admin'});assert.equal(detail.body.data.names,'Арман и Айгерім');assert.ok(!JSON.stringify(detail.body).includes(tok));
    const changed=await f.call('/api/inv/'+id,{method:'PUT',owner:tok,body:{version,data:{names:'Новые имена',_order:{status:'published',publishedAt:'forged'}}}});assert.equal(changed.status,200);assert.equal(f.rows[0].data._order.status,'submitted');
    assert.equal((await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:'test-admin',body:{version}})).status,409);
    version=changed.body.version;const published=await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:'test-admin',body:{version}});assert.equal(published.status,200);assert.equal(published.body.order.status,'published');
    assert.equal((await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:'test-admin',body:{version}})).status,200);
    const guest=await f.call('/api/i/'+id);assert.equal(guest.status,200);assert.equal(guest.body.preview,false);assert.equal(guest.body.data.names,'Новые имена');assert.ok(!JSON.stringify(guest.body).includes('Обсудим детали'));assert.ok(!JSON.stringify(guest.body).includes('+7 700'));
    assert.equal((await f.call('/api/inv/'+id+'/guests',{method:'POST',owner:tok,body:{names:['Алия']}})).status,200);
    const code=f.guests[0].code;const response=await f.call('/api/rsvp/'+id,{method:'POST',body:{code,status:'yes',cnt:2}});assert.equal(response.status,200);assert.equal(f.guests[0].status,'yes');
    assert.equal(f.paymentWrites,0);
  }finally{await f.close()}
});
test('clients cannot self-publish, online checkout is disabled, and edits preserve publication',async()=>{
  const f=await fixture();try{
    const {id,tok}=f.i;const changed=await f.call('/api/inv/'+id,{method:'PUT',owner:tok,body:{version:f.i.version,data:{names:'Подмена',paid:true,_order:{status:'published',publishedAt:'fake'}}}});assert.equal(changed.status,200);assert.equal((await f.call('/api/i/'+id)).status,402);
    assert.equal((await f.call('/api/pay/'+id,{method:'POST',owner:tok,body:{}})).status,410);
    const submitted=await f.call('/api/inv/'+id+'/order',{method:'POST',owner:tok,body:{version:changed.body.version,contact:{name:'Клиент',email:'owner@example.com'}}});
    const published=await f.call('/api/admin/orders/'+id+'/publish',{method:'POST',admin:'test-admin',body:{version:submitted.body.version}});
    const edited=await f.call('/api/inv/'+id,{method:'PUT',owner:tok,body:{version:published.body.version,data:{names:'После публикации',closed:true}}});assert.equal(edited.status,200);assert.equal(f.rows[0].data._order.status,'published');assert.equal((await f.call('/api/i/'+id)).status,410);
    assert.equal(f.paymentWrites,0);
  }finally{await f.close()}
});
