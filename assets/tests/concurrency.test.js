import test from "node:test";
import assert from "node:assert/strict";
import {createApp} from "../server.js";
import {clean} from "../validate.js";
const id="12345678",owner="a".repeat(48),requestId="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
async function fixture(){
  let invitation={id,edit_token:owner,data:clean({names:"Initial"}),price:2490},queries=0,beforePatch=null;
  const guests=new Map();
  const fake=async(url,o={})=>{
    queries++;const u=new URL(url),body=o.body?JSON.parse(o.body):null;
    if(u.pathname.endsWith("/shq_invitations")){
      if(o.method==="PATCH"){
        if(beforePatch)await beforePatch(body);
        // Compare with the latest committed row, not with the earlier GET.
        const expected=invitation.data._rev?"eq."+invitation.data._rev:"is.null";
        if(u.searchParams.get("data->>_rev")!==expected)return Response.json([]);
        Object.assign(invitation,body);return Response.json([{id}]);
      }
      if(u.searchParams.has("limit"))return Response.json(Array.from({length:100},(_,n)=>({...structuredClone(invitation),id:n.toString(16).padStart(8,"0")})));
      return Response.json([structuredClone(invitation)]);
    }
    if(u.pathname.endsWith("/shq_payments"))return Response.json([{inv:id,tier:1,amount:2490,provider_id:"real",confirmed_at:"2026-10-13"}]);
    if(u.pathname.endsWith("/shq_guests")){
      if(o.method==="POST"){
        assert.match(o.headers.Prefer,/resolution=merge-duplicates/);assert.equal(u.searchParams.get("on_conflict"),"code");
        guests.set(body.code,body);return Response.json([]);
      }
      return Response.json([...guests.values()]);
    }
    throw Error(u.pathname);
  };
  const server=createApp({env:{SUPABASE_URL:"https://mock.invalid",SUPABASE_SERVICE_KEY:"sb_secret_mock",ADMIN_KEY:"mock-admin"},fetchImpl:fake}).listen(0,"127.0.0.1");await new Promise(r=>server.on("listening",r));
  const url="http://127.0.0.1:"+server.address().port;
  return {call:(p,o={})=>fetch(url+p,o),put:(p,body)=>fetch(url+p,{method:"PUT",headers:{"Content-Type":"application/json","x-owner-token":owner},body:JSON.stringify(body)}),get invitation(){return invitation},guests,get queries(){return queries},set beforePatch(fn){beforePatch=fn},close:()=>{server.closeAllConnections();return new Promise(r=>server.close(r))}};
}
const version=async f=>(await (await f.call(`/api/inv/${id}/status`,{headers:{"x-owner-token":owner}})).json()).version;
test("A delayed content update cannot remove a newly installed password",async()=>{
  const f=await fixture();let release;
  try{
    const gate=new Promise(r=>release=r);let arrived;const started=new Promise(r=>arrived=r);
    f.beforePatch=async body=>{if(body.data.names==="Delayed edit"){arrived();await gate}};
    const stale=f.put(`/api/inv/${id}`,{data:{names:"Delayed edit"},version:"legacy"});await started;
    assert.equal((await f.put(`/api/inv/${id}/password`,{password:"secret",version:"legacy"})).status,200);
    release();const result=await stale;assert.equal(result.status,409);assert.equal((await result.json()).conflict,true);
    assert.ok(f.invitation.data._access.passwordHash);assert.equal((await f.call(`/api/i/${id}`)).status,401);
  }finally{release?.();await f.close()}
});
test("A delayed password update cannot overwrite a newer document or closure",async()=>{
  const f=await fixture();let release;
  try{
    const gate=new Promise(r=>release=r);let arrived;const started=new Promise(r=>arrived=r);
    f.beforePatch=async body=>{if(body.data._access?.passwordHash){arrived();await gate}};
    const password=f.put(`/api/inv/${id}/password`,{password:"secret",version:"legacy"});await started;
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"New content",closed:true},version:"legacy"})).status,200);
    release();assert.equal((await password).status,409);assert.equal(f.invitation.data.names,"New content");assert.equal(f.invitation.data.closed,true);
  }finally{release?.();await f.close()}
});
test("Stale and unversioned clients cannot overwrite a versioned invitation",async()=>{
  const f=await fixture();try{
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"First"},version:"legacy"})).status,200);
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"Lost"},version:"legacy"})).status,409);
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"Lost"}})).status,409);
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"Second"},version:await version(f)})).status,200);
    assert.equal(f.invitation.data.names,"Second");
  }finally{await f.close()}
});
test("Ten saves do not consume the password budget; actual password excess includes Retry-After",async()=>{
  const f=await fixture();try{
    for(let n=0;n<10;n++)assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"Edit "+n},version:await version(f)})).status,200);
    for(let n=0;n<10;n++)assert.equal((await f.put(`/api/inv/${id}/password`,{password:"",version:await version(f)})).status,200);
    const limited=await f.put(`/api/inv/${id}/password`,{password:"",version:await version(f)});assert.equal(limited.status,429);assert.ok(Number(limited.headers.get("Retry-After"))>0);
  }finally{await f.close()}
});
test("A retried RSVP is one record and updates the existing response",async()=>{
  const f=await fixture();try{
    const send=body=>f.call(`/api/rsvp/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Guest",status:"yes",cnt:2,requestId,...body})});
    assert.equal((await send({})).status,200);assert.equal((await send({})).status,200);assert.equal(f.guests.size,1);
    assert.equal((await send({status:"no"})).status,200);assert.equal(f.guests.size,1);assert.equal([...f.guests.values()][0].cnt,0);
    assert.equal((await send({requestId:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"})).status,200);assert.equal(f.guests.size,2);
  }finally{await f.close()}
});
test("Admin pages orders using one bounded database query",async()=>{
  const f=await fixture();try{
    const start=f.queries,r=await f.call("/api/admin/list",{headers:{"x-admin-key":"mock-admin"}});assert.equal(r.status,200);const j=await r.json();assert.equal(j.items.length,20);assert.equal(j.nextOffset,20);assert.equal(f.queries-start,1);
  }finally{await f.close()}
});
test("Small API bodies are limited without preventing invitation drafts",async()=>{
  const f=await fixture();try{
    const large="a".repeat(70000);
    assert.equal((await f.put(`/api/inv/${id}/password`,{password:large})).status,413);
    assert.equal((await f.put(`/api/inv/${id}`,{data:{names:"Valid",text:large},version:"legacy"})).status,200);
  }finally{await f.close()}
});
