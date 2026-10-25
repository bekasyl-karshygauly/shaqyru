import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.js';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
async function fixture(){
  const rows=[];let mails=0;
  const fetchImpl=async(url,o={})=>{const u=new URL(url),body=o.body?JSON.parse(o.body):{};
    if(u.pathname==='/auth/v1/otp'){mails++;return Response.json({})}
    if(u.pathname==='/auth/v1/verify'){if(body.token!=='123456')return Response.json({}, {status:403});const user=body.email==='b@example.com'?b:a;return Response.json({access_token:user,refresh_token:'refresh-'+user,expires_in:3600,user:{id:user,email:body.email}})}
    if(u.pathname==='/auth/v1/user'){const user=o.headers.Authorization?.slice(7);return [a,b].includes(user)?Response.json({id:user,email:'test@example.com'}):Response.json({}, {status:401})}
    if(u.pathname==='/auth/v1/token'){const user=body.refresh_token?.replace('refresh-','');return [a,b].includes(user)?Response.json({access_token:user,refresh_token:'refresh-'+user,expires_in:3600,user:{id:user,email:'test@example.com'}}):Response.json({}, {status:401})}
    if(u.pathname==='/auth/v1/logout')return new Response(null,{status:204});
    if(u.pathname==='/rest/v1/shq_invitations')return Response.json([{id:'12345678',edit_token:'a'.repeat(48)}]);
    if(u.pathname==='/rest/v1/shq_cloud_drafts'){
      if(o.method==='POST'){if(rows.some(r=>r.user_id===body.user_id&&r.id===body.id))return Response.json([]);rows.push(body);return Response.json([body])}
      const selected=rows.filter(r=>['user_id','id','version'].every(key=>!u.searchParams.has(key)||u.searchParams.get(key)==='eq.'+r[key]));
      if(o.method==='PATCH'){selected.forEach(r=>Object.assign(r,body));return Response.json(selected)}
      return Response.json(selected);
    }throw Error('Unexpected path '+u.pathname);
  };
  const server=createApp({env:{SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_KEY:'sb_secret_test',SUPABASE_ANON_KEY:'sb_publishable_test'},fetchImpl}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));const origin='http://127.0.0.1:'+server.address().port;
  const call=(path,options={})=>fetch(origin+'/api/account'+path,options);
  const post=(path,body,cookie='',method='POST')=>call(path,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  const login=async email=>{const r=await post('/verify',{email,code:'123456'});return r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};
  return {call,post,login,rows,get mails(){return mails},close:()=>new Promise(r=>server.close(r))};
}
test('email login uses HttpOnly cookies, rejects cross-origin calls and handles refresh/logout',async()=>{
  const f=await fixture();try{
    assert.equal((await f.call('/code',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:JSON.stringify({email:'a@example.com'})})).status,403);assert.equal(f.mails,0);
    assert.equal((await f.post('/code',{email:'a@example.com'})).status,200);assert.equal(f.mails,1);
    assert.equal((await f.post('/verify',{email:'a@example.com',code:'000000'})).status,401);
    const login=await f.post('/verify',{email:'a@example.com',code:'123456'});const cookies=login.headers.getSetCookie();assert.ok(cookies.every(c=>c.includes('HttpOnly')&&c.includes('SameSite=Strict')));assert.ok(!(await login.text()).includes('refresh_token'));
    const r=await f.call('/session',{headers:{Cookie:'shq_refresh=refresh-'+a}});assert.equal((await r.json()).user.id,a);assert.ok(r.headers.getSetCookie().length===2);
    const out=await f.post('/logout',{},'shq_access='+a);assert.equal(out.status,200);assert.ok(out.headers.getSetCookie().every(c=>c.includes('Expires=Thu, 01 Jan 1970')));
  }finally{await f.close()}
});
test('cloud drafts isolate accounts, reject forged ownership, and preserve concurrent changes',async()=>{
  const f=await fixture();try{
    assert.equal((await f.call('/drafts')).status,401);const ac=await f.login('a@example.com'),bc=await f.login('b@example.com');
    let r=await f.post('/drafts/'+id,{version:null,data:{names:'Мой праздник',story:[{src:'/covers/wedding.jpg',zoom:1.5,duration:8}],giftNote:'Книги'}},ac,'PUT');assert.equal(r.status,200);const v1=(await r.json()).version;
    assert.equal((await f.call('/drafts/'+id,{headers:{Cookie:bc}})).status,404);assert.deepEqual(await (await f.call('/drafts',{headers:{Cookie:bc}})).json(),[]);
    assert.equal((await f.post('/drafts/'+id,{version:null,data:{names:'Перезаписать'}},ac,'PUT')).status,409);
    r=await f.post('/drafts/'+id,{version:v1,data:{names:'Новая версия'}},ac,'PUT');assert.equal(r.status,200);
    assert.equal((await f.post('/drafts/'+id,{version:v1,data:{names:'Устаревшая версия'}},ac,'PUT')).status,409);assert.equal(f.rows[0].data.names,'Новая версия');
    assert.equal((await f.post('/drafts/'+id,{version:(await r.json()).version,data:{id:'12345678',tok:'b'.repeat(48)}},ac,'PUT')).status,403);
  }finally{await f.close()}
});
test('unconfigured account reports unavailable without pretending to save',async()=>{
  const server=createApp({env:{}}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));try{const r=await fetch('http://127.0.0.1:'+server.address().port+'/api/account/session');assert.deepEqual(await r.json(),{configured:false,storageReady:false,user:null})}finally{await new Promise(r=>server.close(r))}
});

test('Render public origin is used for account requests and sitemap without trusting another Origin',async()=>{
  const env={SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_KEY:'sb_secret_test',SUPABASE_ANON_KEY:'sb_publishable_test',RENDER_EXTERNAL_URL:'https://shaqyru-live.onrender.com'};
  let mails=0;const fetchImpl=async()=>{mails++;return Response.json({})};
  const server=createApp({env,fetchImpl}).listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
  const origin='http://127.0.0.1:'+server.address().port;
  try{
    const request=source=>fetch(origin+'/api/account/code',{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify({email:'test@example.com'})});
    assert.equal((await request('https://other.example')).status,403);assert.equal(mails,0);
    assert.equal((await request(env.RENDER_EXTERNAL_URL)).status,200);assert.equal(mails,1);
    assert.match(await (await fetch(origin+'/sitemap.xml')).text(),/https:\/\/shaqyru-live\.onrender\.com/);
    assert.equal(env.PUBLIC_URL,undefined);
  }finally{await new Promise(r=>server.close(r))}
});
