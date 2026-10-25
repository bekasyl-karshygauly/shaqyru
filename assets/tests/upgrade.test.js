import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistory} from '../public/edit-history.js';
import {cleanRsvpDetails,guestGreeting} from '../public/rsvp-details.js';
import {checkInvitation} from '../public/editor-assistant.js';
import {createApp} from '../server.js';
import {clean} from '../validate.js';
test('history coalesces typing, branches after undo and excludes owner/access credentials',()=>{
  let time=0;const h=createHistory({names:'A',tok:'secret',paid:1,closed:true,_serverVersion:'v1'},{now:()=>time});time=100;h.capture({names:'B',tok:'secret',paid:0});time=200;h.capture({names:'BC'});assert.equal(h.entries.length,2);assert.deepEqual(h.go(0),{names:'A'});time=1000;h.capture({names:'New branch'});assert.equal(h.entries.length,2);assert.equal(h.go(2),null);assert.ok(!JSON.stringify(h.serialize()).includes('secret'));const restored=createHistory({names:'New branch'});assert.equal(restored.load(h.serialize(),{names:'New branch',tok:'different'}),true);assert.equal(restored.index,1);
});
test('expanded RSVP clamps counts, clears declined responses, limits fields and formats personal names literally',()=>{
  assert.deepEqual(cleanRsvpDetails({children:8,diet:'x'.repeat(250),transfer:true},2),{children:2,diet:'x'.repeat(200),transfer:true});assert.deepEqual(cleanRsvpDetails({children:2,diet:'X',transfer:true},0,'no'),{children:0,diet:'',transfer:false});assert.equal(cleanRsvpDetails({transfer:true},1,'yes',[]).transfer,false);assert.equal(guestGreeting({lang:'ru',greeting:'Дорогие {name}!'},'Алия и Данияр'),'Дорогие Алия и Данияр!');assert.deepEqual(clean({rsvpQuestions:['children','invalid','children']}).rsvpQuestions,['children']);
});
test('review detects an earlier time today and early automatic closure',()=>{
  const s={names:'A',date:'2026-10-16',time:'12:00',place:'Hall',addr:'Address',text:'Welcome',zone:'Asia/Almaty',closeAt:'2026-10-16T10:00'};const issues=checkInvitation(s,{now:new Date('2026-10-16T08:00:00Z'),suggestions:true});assert.ok(issues.some(x=>x.field==='time'));assert.ok(issues.some(x=>x.field==='closeAt'));assert.ok(issues.some(x=>x.field==='photo'));
});
const id='12345678',owner='a'.repeat(48);
async function fixture(){
  let row={id,edit_token:owner,data:clean({names:'Original',rsvpQuestions:['children','diet','transfer']}),price:2490},guests=[],detailsReady=true;
  const fake=async(url,o={})=>{const u=new URL(url),body=o.body?JSON.parse(o.body):null;if(u.pathname.endsWith('/shq_invitations')){if(o.method==='PATCH'){if(u.searchParams.get('data->>_rev')!==(row.data._rev?'eq.'+row.data._rev:'is.null'))return Response.json([]);row={...row,...body}}return Response.json([structuredClone(row)])}if(u.pathname.endsWith('/shq_payments'))return Response.json([{tier:1,amount:2490,provider_id:'p',confirmed_at:'2026-10-15'}]);if(u.pathname.endsWith('/shq_guests')){if(u.searchParams.get('select')==='details'&&!detailsReady)return Response.json({error:'column missing'},{status:400});if(o.method==='POST')guests.push(body);return Response.json(guests)}throw Error(u.pathname)};
  const server=createApp({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_KEY:'test'},fetchImpl:fake}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  const call=(path,method='GET',body,headers={})=>fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined});return {call,get row(){return row},get guests(){return guests},set detailsReady(v){detailsReady=v},close:()=>new Promise(r=>server.close(r))};
}
test('collaboration roles, CAS, revocation, expiry and private-field isolation are enforced by server',async()=>{
  const f=await fixture(),own={'x-owner-token':owner};try{
    const grant=async role=>{const response=await f.call(`/api/inv/${id}/collaborators`,'POST',{role,version:f.row.data._rev||'legacy'},own);assert.equal(response.status,200);return response.json()};
    assert.equal((await f.call(`/api/inv/${id}/collaborators`,'POST',{role:'editor'})).status,403);
    const viewer=await grant('viewer'),editor=await grant('editor'),viewHeaders={'x-collaboration-token':viewer.token},editHeaders={'x-collaboration-token':editor.token};
    const read=await (await f.call(`/api/collaboration/${id}`,'GET',null,editHeaders)).json();assert.equal(read.role,'editor');assert.ok(!read.data._sharing);assert.ok(!JSON.stringify(f.row).includes(editor.token));
    assert.equal((await f.call(`/api/collaboration/${id}`,'PUT',{data:{names:'Blocked'},version:read.version},viewHeaders)).status,403);
    assert.equal((await f.call(`/api/inv/${id}/guests`,'GET',null,{'x-owner-token':editor.token})).status,403);
    const write=await f.call(`/api/collaboration/${id}`,'PUT',{data:{...read.data,names:'Partner edit',closed:true,_access:{passwordHash:'bad'},_sharing:[]},version:read.version},editHeaders);assert.equal(write.status,200);assert.equal(f.row.data.names,'Partner edit');assert.equal(f.row.data.closed,false);assert.equal(f.row.data._sharing.length,2);assert.ok(!f.row.data._access.passwordHash);
    assert.equal((await f.call(`/api/collaboration/${id}`,'PUT',{data:read.data,version:read.version},editHeaders)).status,409);
    const v=f.row.data._rev;assert.equal((await f.call(`/api/inv/${id}`,'PUT',{data:{names:'Owner edit'},version:v},own)).status,200);assert.equal(f.row.data._sharing.length,2);
    assert.equal((await f.call(`/api/inv/${id}/collaborators/${editor.id}`,'DELETE',{version:f.row.data._rev},own)).status,200);assert.equal((await f.call(`/api/collaboration/${id}`,'GET',null,editHeaders)).status,403);
    f.row.data._sharing[0].expires=Date.now()-1;assert.equal((await f.call(`/api/collaboration/${id}`,'GET',null,viewHeaders)).status,403);
  }finally{await f.close()}
});
test('expanded answers reach storage; missing migration does not break legacy RSVP',async()=>{
  const f=await fixture();try{const response=await f.call(`/api/rsvp/${id}`,'POST',{name:'Guest',status:'yes',cnt:2,requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',details:{children:7,diet:'Без орехов',transfer:true}});assert.equal(response.status,200);assert.deepEqual(f.guests[0].details,{children:2,diet:'Без орехов',transfer:true});}finally{await f.close()}
  const missing=await fixture();missing.detailsReady=false;try{const body={name:'Guest',status:'yes',cnt:1,requestId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};assert.equal((await missing.call(`/api/rsvp/${id}`,'POST',body)).status,200);assert.equal((await missing.call(`/api/rsvp/${id}`,'POST',{...body,details:{children:1}})).status,503)}finally{await missing.close()}
});
