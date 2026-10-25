import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";
import { clean } from "../validate.js";
import { calendar, eventInstant, csv, maps } from "../public/event-tools.js";
import { passwordHash, guestToken } from "../invitation-access.js";
const id="12345678",owner="a".repeat(48);
async function fixture(){
  const i={id,edit_token:owner,data:clean({names:"Арман & Айгерім",date:"2026-12-19",time:"18:00",place:"Алтын сарай",dsg:0})};let paid=true,writes=0;
  const fetchImpl=async(url,o={})=>{const u=new URL(url);if(u.pathname.endsWith("/shq_invitations")){if(o.method==="PATCH"){if(u.searchParams.get("data->>_rev")!==(i.data._rev?"eq."+i.data._rev:"is.null"))return Response.json([]);i.data=JSON.parse(o.body).data}return Response.json([i])}if(u.pathname.endsWith("/shq_payments"))return Response.json(paid?[{inv:id,tier:1,amount:2490,provider_id:"real",confirmed_at:"2026-10-12"}]:[]);if(u.pathname.endsWith("/shq_guests")){if(o.method==="POST")writes++;return Response.json([])}throw Error(u.pathname)};
  const server=createApp({env:{SUPABASE_URL:"https://db.example",SUPABASE_SERVICE_KEY:"sb_secret_test",PUBLIC_URL:"https://example.com"},fetchImpl}).listen(0,"127.0.0.1");await new Promise(r=>server.on("listening",r));const call=(url,o={})=>fetch(`http://127.0.0.1:${server.address().port}`+url,o);
  return {i,call,set paid(v){paid=v},get writes(){return writes},close:()=>new Promise(r=>server.close(r))};
}
const json=(body,headers={})=>({method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
test("Password guards reads and RSVP, rotates sessions, and never bypasses payment",async()=>{
  const f=await fixture();try{
    const r=await f.call(`/api/inv/${id}/password`,{...json({password:"secret"},{"x-owner-token":owner}),method:"PUT"});assert.equal(r.status,200);assert.notEqual(f.i.data._access.passwordHash,"secret");
    assert.equal((await f.call(`/api/i/${id}`)).status,401);
    assert.equal((await f.call(`/api/rsvp/${id}`,json({name:"Guest",status:"yes"}))).status,401);
    assert.equal((await f.call(`/api/i/${id}/unlock`,json({password:"wrong"}))).status,403);
    const unlocked=await f.call(`/api/i/${id}/unlock`,json({password:"secret"}));assert.equal(unlocked.status,200);const {token}=await unlocked.json();
    const view=await f.call(`/api/i/${id}`,{headers:{"x-guest-token":token}});assert.equal(view.status,200);assert.ok(!(await view.json()).data._access);
    assert.equal((await f.call(`/api/rsvp/${id}`,json({name:"Guest",status:"yes",requestId:"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"},{"x-guest-token":token}))).status,200);assert.equal(f.writes,1);
    f.i.data._access.passwordHash=await passwordHash("changed");assert.equal((await f.call(`/api/i/${id}`,{headers:{"x-guest-token":token}})).status,401);
    f.paid=false;assert.equal((await f.call(`/api/i/${id}`,{headers:{"x-guest-token":guestToken(f.i)}})).status,402);assert.equal((await f.call(`/api/i/${id}/unlock`,json({password:"changed"}))).status,404);
    assert.equal((await f.call(`/api/inv/${id}/password`,{...json({password:"secret"}),method:"PUT"})).status,403);
  }finally{await f.close()}
});
test("Closed invitations block guests, responses and public metadata; owner can reopen",async()=>{
  const f=await fixture();try{
    for(const data of [{closed:true},{closed:false,closeAt:"2020-01-01T00:00"}]){
      Object.assign(f.i.data,data);assert.equal((await f.call(`/api/i/${id}`)).status,410);assert.equal((await f.call(`/api/rsvp/${id}`,json({name:"Guest",status:"yes"}))).status,410);
      assert.equal((await f.call(`/api/i/${id}`,{headers:{"x-owner-token":owner}})).status,200);
      const html=await (await f.call(`/i/${id}`)).text();assert.ok(!html.includes('content="Арман'));assert.equal((await f.call(`/share/${id}.png`)).status,404);
    }
    f.i.data.closed=false;f.i.data.closeAt="";assert.equal((await f.call(`/api/i/${id}`)).status,200);
  }finally{await f.close()}
});
test("Public share image is a PNG; private/unpaid invitations reveal no names or image",async()=>{
  const f=await fixture();try{
    let html=await (await f.call(`/i/${id}`)).text();assert.match(html,/og:image/);assert.match(html,/Арман &amp; Айгерім/);
    const image=await f.call(`/share/${id}.png`);assert.equal(image.status,200);assert.equal(image.headers.get("content-type"),"image/png");assert.equal(Buffer.from(await image.arrayBuffer()).subarray(1,4).toString(),"PNG");
    f.i.data._access={passwordHash:await passwordHash("secret")};html=await (await f.call(`/i/${id}`)).text();assert.ok(!html.includes('content="Арман'));assert.ok(!html.includes('og:image'));assert.equal((await f.call(`/share/${id}.png`)).status,404);
    f.i.data._access={};f.paid=false;assert.equal((await f.call(`/share/${id}.png`)).status,404);
  }finally{await f.close()}
});
test("Autosaving edits preserves the password hash and strips forged private fields",async()=>{
  const f=await fixture();try{
    const hash=await passwordHash("secret");f.i.data._access={passwordHash:hash};
    assert.equal((await f.call(`/api/inv/${id}`,{...json({data:{names:"Updated",_access:{passwordHash:""},closed:true}},{"x-owner-token":owner}),method:"PUT"})).status,200);
    assert.equal(f.i.data._access.passwordHash,hash);assert.equal(f.i.data.closed,true);
  }finally{await f.close()}
});
test("Calendar uses event time zone and all-day dates, escapes injection; map coordinates are ordered",()=>{
  assert.equal(eventInstant("2026-12-19","18:00","Asia/Almaty").toISOString(),"2026-12-19T13:00:00.000Z");assert.equal(eventInstant("2026-02-30","12:00"),null);
  const text=calendar(clean({date:"2026-12-19",time:"18:00",names:"Имя\nBEGIN:VEVENT",text:"а".repeat(100)}),id);assert.match(text,/DTSTART:20261219T130000Z/);assert.match(text,/SUMMARY:Имя\\nBEGIN:VEVENT/);
  assert.ok(text.split("\r\n").every(line=>Buffer.byteLength(line)<=75));
  assert.match(calendar(clean({date:"2026-12-19",time:""})),/DTEND;VALUE=DATE:20261220/);
  const routes=maps({lat:"43.2",lng:"76.9"});assert.match(routes.dgis,/76.9,43.2/);assert.match(routes.google,/43.2%2C76.9/);
  const exportText=csv([{name:"=FORMULA()",note:'Quoted "text";\nnext'}]);assert.ok(exportText.startsWith("\ufeff"));assert.match(exportText,/'=FORMULA/);assert.match(exportText,/""text""/);
});
