import crypto from 'node:crypto';
import {clean} from './validate.js';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status,message)=>Object.assign(new Error(message),{status,expose:true});
const cookieMap=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(p=>{const i=p.indexOf('=');try{return [p.slice(0,i).trim(),decodeURIComponent(p.slice(i+1))]}catch{return []}}));
export function mountAccounts(app,{env,base,key,sb,fetchImpl,limit}){
  const anon=String(env.SUPABASE_ANON_KEY||'').trim(),configured=!!(base&&key&&anon);
  const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
  const options=req=>({httpOnly:true,secure:req.secure,sameSite:'strict',path:'/api/account'});
  function setSession(req,res,j){if(!j.access_token||!j.refresh_token)throw fail(502,'Сервис входа не вернул сессию');res.cookie('shq_access',j.access_token,{...options(req),maxAge:Math.min(Number(j.expires_in)||3600,86400)*1000});res.cookie('shq_refresh',j.refresh_token,{...options(req),maxAge:30*86400e3})}
  function clear(req,res){res.clearCookie('shq_access',options(req));res.clearCookie('shq_refresh',options(req))}
  async function auth(path,{method='GET',body,token}={}){if(!configured)throw fail(503,'Облачный аккаунт пока не подключён');const r=await fetchImpl(base+'/auth/v1'+path,{method,headers:{apikey:anon,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});if(!r.ok)throw fail(r.status===429?429:r.status>=500?503:401,r.status===429?'Слишком много попыток. Подождите и попробуйте снова.':'Не удалось войти. Проверьте код или запросите новый.');return r.status===204?{}:r.json()}
  async function current(req,res){if(!configured)return null;const cookies=cookieMap(req);if(cookies.shq_access){try{const user=await auth('/user',{token:cookies.shq_access});if(uuid.test(user.id))return user}catch(e){if(e.status!==401)throw e}}
    if(cookies.shq_refresh){try{const j=await auth('/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:cookies.shq_refresh}});if(!uuid.test(j.user?.id))throw fail(401,'Войдите снова');setSession(req,res,j);return j.user}catch(e){if(e.status!==401)throw e;clear(req,res)}}return null;
  }
  async function required(req,res){const user=await current(req,res);if(!user)throw fail(401,'Войдите в аккаунт, чтобы открыть облачные приглашения');return user}
  app.use('/api/account',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD'].includes(req.method)){let origin;try{origin=new URL(req.get('origin')).origin}catch{}const expected=env.PUBLIC_URL?new URL(env.PUBLIC_URL).origin:req.protocol+'://'+req.get('host');if(!origin||origin!==expected||req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Запрос должен быть отправлен с этого сайта'})}next()});
  app.post('/api/account/code',limit('account-code',5,3600e3),wrap(async(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail(400,'Введите корректный email');await auth('/otp',{method:'POST',body:{email,create_user:true}});res.json({sent:true})}));
  app.post('/api/account/verify',limit('account-verify',12,600e3),wrap(async(req,res)=>{const email=String(req.body?.email||'').trim().toLowerCase(),token=String(req.body?.code||'');if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!/^\d{6,8}$/.test(token))throw fail(400,'Введите email и код из письма');const j=await auth('/verify',{method:'POST',body:{email,token,type:'email'}});setSession(req,res,j);res.json({user:{id:j.user.id,email:j.user.email}})}));
  app.post('/api/account/logout',wrap(async(req,res)=>{const c=cookieMap(req);try{if(c.shq_access)await auth('/logout?scope=local',{method:'POST',token:c.shq_access})}catch{}clear(req,res);res.json({ok:true})}));
  app.get('/api/account/session',wrap(async(req,res)=>{const user=await current(req,res);let storageReady=false;if(configured){try{await sb('/shq_cloud_drafts?select=id&limit=0');storageReady=true}catch{}}res.json({configured,storageReady,user:user?{id:user.id,email:user.email}:null})}));
  app.get('/api/account/drafts',limit('cloud-read',120,60000),wrap(async(req,res)=>{const u=await required(req,res);const offset=Math.max(0,Math.min(100000,Number(req.query.offset)||0));res.json(await sb(`/shq_cloud_drafts?user_id=eq.${u.id}&select=id,title,updated_at,version&order=updated_at.desc&limit=50&offset=${Math.floor(offset)}`))}));
  app.get('/api/account/drafts/:id',limit('cloud-read',120,60000),wrap(async(req,res)=>{const u=await required(req,res);if(!uuid.test(req.params.id))throw fail(400,'Некорректный черновик');const rows=await sb(`/shq_cloud_drafts?user_id=eq.${u.id}&id=eq.${req.params.id}&select=*`);if(!rows.length)throw fail(404,'Приглашение не найдено');res.json(rows[0])}));
  app.put('/api/account/drafts/:id',limit('cloud-write',60,60000),wrap(async(req,res)=>{
    const u=await required(req,res),id=req.params.id;if(!uuid.test(id))throw fail(400,'Некорректный черновик');const version=req.body?.version;if(version!==null&&!uuid.test(version||''))throw fail(400,'Не указана версия черновика');
    const raw=req.body?.data||{},data=clean(raw);
    // Existing invitation access is imported only after checking the original owner token.
    if(raw.id||raw.tok){if(!/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(raw.id||'')||!/^[a-f0-9]{48}$/.test(raw.tok||''))throw fail(403,'Не удалось подтвердить владельца приглашения');const rows=await sb(`/shq_invitations?id=eq.${raw.id}&select=id,edit_token`);const expected=Buffer.from(rows[0]?.edit_token||''),actual=Buffer.from(raw.tok);if(expected.length!==actual.length||!crypto.timingSafeEqual(expected,actual))throw fail(403,'Не удалось подтвердить владельца приглашения');data.id=raw.id;data.tok=raw.tok}
    data._dirty=raw._dirty!==false;data._serverVersion=typeof raw._serverVersion==='string'?raw._serverVersion.slice(0,64):null;
    const next=crypto.randomUUID(),row={id,user_id:u.id,data,title:data.names||'Новое приглашение',version:next,updated_at:new Date().toISOString()};let written;
    if(version===null){try{written=await sb('/shq_cloud_drafts?on_conflict=user_id,id',{method:'POST',body:row,prefer:'resolution=ignore-duplicates,return=representation'})}catch(e){throw e}}
    else written=await sb(`/shq_cloud_drafts?user_id=eq.${u.id}&id=eq.${id}&version=eq.${version}`,{method:'PATCH',body:{data:row.data,title:row.title,version:next,updated_at:row.updated_at},prefer:'return=representation'});
    if(!written?.length)throw fail(409,'В облаке уже есть другая версия. Ваши изменения сохранены на устройстве. Откройте облачную версию из «Моих приглашений» или создайте отдельную копию.');res.json({id,version:next,updated_at:row.updated_at});
  }));
}
