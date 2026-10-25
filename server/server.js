import {mountCollaborators} from './collaborators.js';
import {mountOrders,publishedManually,orderForOwner} from './orders.js';
import {createOrderNotifications} from './order-notifications.js';
import {createInvitationLinks} from './invitation-links.js';
import {cleanRsvpDetails} from './public/rsvp-details.js';
import express from "express";
import {mountAccounts} from "./accounts.js";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { clean, TIER, PRICE } from "./validate.js";
import { paymentConfig, validResult, verifySignature, resultXml } from "./payments.js";
import { passwordHash, passwordMatches, guestToken, guestAllowed, isClosed } from "./invitation-access.js";
import { shareTags, shareImage } from "./share-image.js";
import { readFile } from "node:fs/promises";
import { createRateLimiter } from "./rate-limits.js";
import { updateInvitation, assertVersion, versionOf } from "./invitation-store.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const ID = /^(?:[a-f0-9]{8}|[a-f0-9]{32})$/, CODE = /^(?:[a-f0-9]{10}|[a-f0-9]{24})$/, TOK = /^[a-f0-9]{48}$/;
const rid = n => crypto.randomBytes(n).toString("hex");
const eq = (a,b) => { const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length && crypto.timingSafeEqual(x,y); };

export function createApp({ env = process.env, fetchImpl = fetch } = {}) {
  // Render assigns the HTTPS service URL at runtime; an explicit custom domain wins.
  if(!env.PUBLIC_URL&&env.RENDER_EXTERNAL_URL)env={...env,PUBLIC_URL:env.RENDER_EXTERNAL_URL};
  const base = String(env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = String(env.SUPABASE_SERVICE_KEY || "").trim();
  const headers = { apikey: key, ...(key.startsWith("sb_") ? {} : { Authorization: `Bearer ${key}` }), "Content-Type": "application/json" };
  const config = paymentConfig(env);
  async function sb(p, { method="GET", body, prefer }={}) {
    if (!base || !key) throw new Error("База данных не настроена");
    const r=await fetchImpl(base+"/rest/v1"+p,{ method, headers:{...headers,...(prefer?{Prefer:prefer}:{})}, body:body===undefined?undefined:JSON.stringify(body), signal:AbortSignal.timeout(15000) });
    if (!r.ok) { const e=new Error("Не удалось обратиться к базе данных. Проверьте настройки и миграцию.");e.status=503;e.databaseStatus=r.status;throw e; }
    const text=await r.text();return text?JSON.parse(text):null;
  }
  const app=express();app.disable("x-powered-by");
  app.set("trust proxy", Number(env.TRUST_PROXY_HOPS) || false);
  app.use((req,res,next)=>{
    res.set({"X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Frame-Options":req.path==="/preview"?"SAMEORIGIN":"DENY"});
    if(req.path.startsWith("/api/"))res.set("Cache-Control","no-store");next();
  });
  const lim=createRateLimiter();
  const policies=[
    ["POST",/^\/api\/inv$/,"create",20,3600e3],
    ["PUT",/^\/api\/inv\/[^/]+$/,"edit",300,60000],
    ["PUT",/^\/api\/inv\/[^/]+\/password$/,"password",10,60000],
    ["POST",/^\/api\/i\/[^/]+\/unlock$/,"unlock",10,60000],
    ["POST",/^\/api\/inv\/[^/]+\/guests$/,"add-guests",30,3600e3],
    ["POST",/^\/api\/upload-audio$/,"upload",15,3600e3],
    ["POST",/^\/api\/pay\/[^/]+$/,"checkout",10,3600e3],
    ["POST",/^\/api\/rsvp\/[^/]+$/,"rsvp",60,3600e3],
    ["GET",/^\/api\/admin\/list$/,"admin",15,60000],
    ["GET",/^\/share\/[^/]+\.png$/,"share-image",60,60000],
    ["GET",/^\/api\/i\/[^/]+$/,"guest-read",300,60000],
    ["GET",/^\/i\/[^/]+$/,"guest-document",300,60000],
    ["GET",/^\/api\/inv\//,"owner-read",300,60000],
  ].map(([method,pattern,group,max,ms])=>({method,pattern,guard:lim(group,max,ms)}));
  app.use((req,res,next)=>{const p=policies.find(p=>p.method===req.method&&p.pattern.test(req.path));return p?p.guard(req,res,next):next()});
  const smallJson=express.json({limit:"64kb"}),invJson=express.json({limit:"16mb"}),audioJson=express.json({limit:"22mb"});
  app.use((req,res,next)=>{const parser=req.path==="/api/upload-audio"?audioJson:/^\/api\/collaboration\/[^/]+$/.test(req.path)?invJson:(/^\/api\/inv(?:\/[^/]+)?$/.test(req.path)||/^\/api\/account\/drafts\/[^/]+$/.test(req.path))?invJson:smallJson;parser(req,res,next)});
  app.use("/api/payments/result",express.urlencoded({extended:false,limit:"64kb",parameterLimit:80}));
  app.use((req,res,next)=>{if(/^\/(?:i\/|preview|admin|view\.html|admin\.html)/.test(req.path))res.set("X-Robots-Tag","noindex, nofollow, noarchive");next()});
  app.use(express.static(path.join(root,"public")));
  app.get("/create",(req,res)=>res.sendFile(path.join(root,"public","create.html")));
  app.get("/i/:id",async(req,res,next)=>{try{
    const i=await inv(req.params.id);
    const publicShare=i&&(await entitlement(i)).paid&&!isClosed(i)&&!i.data._access?.passwordHash;
    const html=await readFile(path.join(root,"public","view.html"),"utf8");
    res.set("Cache-Control","no-store").type("html").send(html.replace("<!-- SHARE_META -->",shareTags(publicShare?i:null,env.PUBLIC_URL,i?await links.path(i.id):undefined)));
  }catch(e){res.set("Cache-Control","no-store").sendFile(path.join(root,"public","view.html"))}});
  app.get("/preview",(req,res)=>res.sendFile(path.join(root,"public","view.html")));
  app.get("/admin",(req,res)=>res.sendFile(path.join(root,"public","admin.html")));
  const h=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
  const inv=async id=>ID.test(id)?(await sb(`/shq_invitations?id=eq.${id}&select=*`))[0]||null:null;
  const links=createInvitationLinks({sb,inv});
  // A legacy paid flag is never payment proof. Only verified ledger records grant access.
  async function entitlement(i) {
    if(publishedManually(i))return {paid:true,tier:4};
    let records;
    try{records=await sb(`/shq_payments?inv=eq.${i.id}&status=eq.confirmed&select=tier,amount,provider_id,confirmed_at`)}
    catch(e){if(e.databaseStatus===404)return {paid:false,tier:0};throw e;}
    return accessFrom(i,records);
  }
  function accessFrom(i,records){const tier=records.filter(p=>p.provider_id&&p.confirmed_at&&p.amount===PRICE[p.tier]).reduce((n,p)=>Math.max(n,p.tier),0);return {paid:tier>=TIER[clean(i.data).dsg],tier}}
  async function own(req,res) {
    const i=await inv(req.params.id),t=String(req.get("x-owner-token")||"");
    if(!i||!TOK.test(t)||!eq(i.edit_token,t)){res.status(403).json({error:"Нет доступа"});return null;}return i;
  }
  let rsvpReadiness={until:0,ready:false};
  async function rsvpDetailsReady(){if(rsvpReadiness.until>Date.now())return rsvpReadiness.ready;let ready=false;try{await sb('/shq_guests?select=details&limit=0');ready=true}catch{}rsvpReadiness={until:Date.now()+10000,ready};return ready}
  mountCollaborators(app,{sb,inv,own,entitlement,h,limit:lim});
  const notifications=createOrderNotifications({env,sb,inv,fetchImpl});app.locals.orderNotifications=notifications;
  mountOrders(app,{env,sb,inv,own,h,limit:lim,notifications,links});
  mountAccounts(app,{env,base,key,sb,fetchImpl,limit:lim});
  app.get("/api/config",h(async(req,res)=>res.json({orderMode:'manual',paymentsReady:false,rsvpDetailsReady:await rsvpDetailsReady()})));
  app.get("/health",(req,res)=>res.json({status:"ok"}));
  app.get('/api/inv/:id/link',h(async(req,res)=>{const i=await own(req,res);if(!i)return;res.json({path:await links.path(i.id)})}));
  app.post('/api/inv/:id/link',lim('invitation-link',30,60000),h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;
    if(!(await entitlement(i)).paid)return res.status(402).json({error:'Гостевая ссылка доступна после публикации'});
    res.json(await links.ensure(i));
  }));
  app.get("/robots.txt",(req,res)=>{
    let sitemap="";try{const u=new URL(env.PUBLIC_URL);if(u.protocol==="https:"&&!u.username&&!u.password)sitemap=`\nSitemap: ${u.origin}/sitemap.xml`}catch{}
    res.type("text").send("User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /preview\nDisallow: /view.html\nDisallow: /i/\nDisallow: /share/"+sitemap+"\n");
  });
  app.get("/sitemap.xml",(req,res)=>{
    let origin;try{const u=new URL(env.PUBLIC_URL);if(u.protocol!=="https:"||u.username||u.password)throw 0;origin=u.origin}catch{return res.status(503).type("text").send("Public URL is not configured")}
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`);
  });
  app.post("/api/inv",h(async(req,res)=>{
    const data={...clean(req.body?.data),_rev:rid(16)},id=rid(16),tok=rid(24),price=PRICE[TIER[data.dsg]];
    await sb("/shq_invitations",{method:"POST",body:{id,edit_token:tok,data,price,paid:false,paid_tier:0}});res.json({id,tok,paid:false,price,version:data._rev});
  }));
  app.put("/api/inv/:id",h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;const data=clean(req.body?.data),access=await entitlement(i);
    assertVersion(i,req.body?.version);
    if(access.tier&&TIER[data.dsg]>access.tier)return res.status(402).json({error:"Этот дизайн дороже оплаченного. Выберите оплаченный уровень."});
    data._access=i.data._access||{};data._sharing=i.data._sharing||[];if(i.data._order)data._order=i.data._order;
    const version=await updateInvitation(sb,i,data,{price:PRICE[TIER[data.dsg]]});res.json({paid:access.tier>=TIER[data.dsg],order:orderForOwner(i),version});
  }));
  app.get("/api/inv/:id/status",h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;const access=await entitlement(i);res.json({paid:access.paid,paidTier:access.tier,order:orderForOwner(i),price:i.price,data:clean(i.data),passwordSet:!!i.data._access?.passwordHash,version:versionOf(i),guestPath:access.paid?await links.path(i.id):null});
  }));
  app.put("/api/inv/:id/password",h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;const password=req.body?.password;
    assertVersion(i,req.body?.version);
    if(typeof password!=="string"||(password!==""&&(password.length<4||password.length>128)))return res.status(400).json({error:"Пароль должен содержать от 4 до 128 символов"});
    const data={...i.data,_access:{passwordHash:password?await passwordHash(password):""}};
    const version=await updateInvitation(sb,i,data);res.json({passwordSet:!!password,version});
  }));
  app.post("/api/i/:id/unlock",h(async(req,res)=>{
    const i=await inv(req.params.id);if(!i||!(await entitlement(i)).paid)return res.status(404).json({error:"Приглашение недоступно"});
    if(isClosed(i))return res.status(410).json({error:"Приглашение закрыто организатором"});
    if(typeof req.body?.password!=="string"||req.body.password.length>128||!await passwordMatches(req.body.password,i.data._access?.passwordHash))return res.status(403).json({error:"Неверный пароль"});
    res.json({token:guestToken(i)});
  }));
  app.get("/share/:id.png",h(async(req,res)=>{
    const i=await inv(req.params.id);
    if(!i||!(await entitlement(i)).paid||isClosed(i)||i.data._access?.passwordHash)return res.status(404).end();
    res.set("Cache-Control","no-store").type("png").send(await shareImage(clean(i.data),root));
  }));
  app.post("/api/upload-audio",h(async(req,res)=>{
    req.params.id=String(req.body?.inv||"");const i=await own(req,res);if(!i)return;
    const b=req.body||{},name=String(b.name||"audio.mp3").slice(0,80);
    const match=/^data:audio\/(mpeg|mp3|wav|x-wav|m4a|x-m4a|mp4|aac|ogg|webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(b.data||""));
    if(!match)return res.status(400).json({error:"Выберите аудиофайл MP3, M4A, WAV или OGG"});
    const buffer=Buffer.from(match[2],"base64");
    if(!buffer.length||buffer.length>15*1024*1024)return res.status(400).json({error:"Размер файла должен быть от 1 байта до 15 МБ"});
    const type=match[1],ext=({mpeg:"mp3",mp3:"mp3",wav:"wav","x-wav":"wav",m4a:"m4a","x-m4a":"m4a",mp4:"m4a",aac:"aac",ogg:"ogg",webm:"webm"})[type];
    const valid=ext==="mp3"?(buffer.subarray(0,3).toString()==="ID3"||(buffer[0]===255&&(buffer[1]&224)===224)):
      ext==="wav"?buffer.subarray(0,4).toString()==="RIFF"&&buffer.subarray(8,12).toString()==="WAVE":
      ext==="ogg"?buffer.subarray(0,4).toString()==="OggS":
      ext==="webm"?buffer.subarray(0,4).equals(Buffer.from([26,69,223,163])):
      ext==="m4a"?buffer.subarray(4,8).toString()==="ftyp":buffer[0]===255&&(buffer[1]&246)===240;
    if(!valid)return res.status(400).json({error:"Содержимое файла не соответствует аудиоформату"});
    const bucket=env.AUDIO_BUCKET||"shaqyru-audio",file=`${i.id}/audio_${rid(8)}.${ext}`;
    const response=await fetchImpl(`${base}/storage/v1/object/${bucket}/${file}`,{method:"POST",headers:{...headers,"Content-Type":`audio/${type}`},body:buffer,signal:AbortSignal.timeout(30000)});
    if(!response.ok)return res.status(503).json({error:"Хранилище музыки не настроено или временно недоступно"});
    res.json({ok:true,url:`${base}/storage/v1/object/public/${bucket}/${file}`,title:name});
  }));
  app.post("/api/pay/:id",h(async(req,res)=>{
    return res.status(410).json({error:'Онлайн-оплата отключена. Отправьте заявку на согласование.'});
  }));
  app.post("/api/payments/result",h(async(req,res)=>{
    if(!config)return res.status(503).send("Payment service not configured");
    const p=req.body;if(!verifySignature("result",p,config.secret))return res.status(403).send("Invalid signature");
    if(!/^[a-f0-9]{32}$/.test(p.pg_order_id||""))return res.status(400).send("Invalid order");
    const order=(await sb(`/shq_payments?id=eq.${p.pg_order_id}&select=*`))[0];
    if(!order||!validResult(p,config,order))return res.status(400).send("Payment mismatch");
    if(p.pg_result!=="1"){
      await sb(`/shq_payments?id=eq.${order.id}&status=neq.confirmed`,{method:"PATCH",body:{status:"failed"}});
      return res.type("application/xml").send(resultXml("ok","Result received",config.secret));
    }
    if(p.pg_captured!=="1")return res.status(409).type("application/xml").send(resultXml("error","Waiting for capture",config.secret));
    const confirmed=await sb("/rpc/shq_confirm_payment",{method:"POST",body:{p_order:order.id,p_provider:p.pg_payment_id}});
    if(!confirmed)return res.status(409).send("Payment not confirmed");
    res.type("application/xml").send(resultXml("ok","Order paid",config.secret));
  }));
  app.get("/api/i/:id",h(async(req,res)=>{
    const i=await inv(req.params.id);if(!i)return res.status(404).json({error:"Приглашение не найдено"});
    const token=String(req.get("x-owner-token")||""),owner=TOK.test(token)&&eq(i.edit_token,token),access=await entitlement(i);
    if(!access.paid&&!owner)return res.status(402).json({error:"Приглашение ещё не опубликовано организатором"});
    if(!owner&&isClosed(i))return res.status(410).json({error:"Приглашение закрыто организатором"});
    if(!owner&&!guestAllowed(i,req.get("x-guest-token")))return res.status(401).json({error:"Введите пароль приглашения",passwordRequired:true});
    let guest=null;if(CODE.test(String(req.query.g||"")))guest=(await sb(`/shq_guests?code=eq.${req.query.g}&inv=eq.${i.id}&select=*`))[0]||null;
    res.json({data:clean(i.data),preview:owner||!access.paid,guest:guest?{name:guest.name,status:guest.status,cnt:guest.cnt,details:guest.details||{}}:null,rsvpDetailsReady:i.data.rsvpQuestions?.length?await rsvpDetailsReady():false});
  }));
  app.get("/api/inv/:id/guests",h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;if(!(await entitlement(i)).paid)return res.status(402).json({error:"Ссылки для гостей доступны после публикации"});
    res.json(await sb(`/shq_guests?inv=eq.${i.id}&select=*&order=created.asc`));
  }));
  app.post("/api/inv/:id/guests",h(async(req,res)=>{
    const i=await own(req,res);if(!i)return;if(!(await entitlement(i)).paid)return res.status(402).json({error:"Добавление гостей доступно после публикации"});
    const names=(Array.isArray(req.body?.names)?req.body.names:[]).map(n=>String(n).trim().slice(0,60)).filter(Boolean).slice(0,200);
    if(!names.length)return res.status(400).json({error:"Введите имена гостей"});
    await sb("/shq_guests",{method:"POST",body:names.map(name=>({code:rid(12),inv:i.id,name}))});res.json({ok:true});
  }));
  app.post("/api/rsvp/:id",h(async(req,res)=>{
    const i=await inv(req.params.id);if(!i||!(await entitlement(i)).paid)return res.status(404).json({error:"Не найдено"});const b=req.body||{};
    if(isClosed(i))return res.status(410).json({error:"Приглашение закрыто организатором"});
    if(!guestAllowed(i,req.get("x-guest-token")))return res.status(401).json({error:"Введите пароль приглашения",passwordRequired:true});
    if(!["yes","no"].includes(b.status))return res.status(400).json({error:"Некорректный ответ"});
    const upd={status:b.status,cnt:b.status==="no"?0:Math.min(Math.max(parseInt(b.cnt)||1,1),10),note:String(b.note||"").slice(0,300),updated:new Date().toISOString()};
    const questions=clean(i.data).rsvpQuestions;if(questions.length){if(await rsvpDetailsReady())upd.details=cleanRsvpDetails(b.details,upd.cnt,b.status,questions);else if(b.details)return res.status(503).json({error:'Дополнительные ответы пока недоступны. Организатору нужно выполнить миграцию 004_rsvp_details.sql.'})}
    if(b.code){
      if(!CODE.test(String(b.code)))return res.status(400).json({error:"Некорректная ссылка гостя"});
      const updated=await sb(`/shq_guests?code=eq.${b.code}&inv=eq.${i.id}`,{method:"PATCH",body:upd,prefer:"return=representation"});if(!updated?.length)return res.status(404).json({error:"Гость не найден"});
    }else{
      const name=typeof b.name==="string"?b.name.trim().slice(0,60):"";if(!name)return res.status(400).json({error:"Укажите имя"});
      if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(b.requestId||""))return res.status(400).json({error:"Обновите страницу и отправьте ответ ещё раз"});
      const code=crypto.createHmac("sha256",i.edit_token).update(`rsvp:${i.id}:${b.requestId}`).digest("hex").slice(0,24);
      await sb("/shq_guests?on_conflict=code",{method:"POST",body:{code,inv:i.id,name,...upd},prefer:"resolution=merge-duplicates"});
      return res.json({ok:true,code});
    }res.json({ok:true});
  }));
  app.post("/api/admin/confirm/:id",(req,res)=>res.status(410).json({error:"Используйте публикацию заявки в кабинете организатора."}));
  app.get('/:slug',lim('friendly-document',300,60000),h(async(req,res,next)=>{
    const i=await links.resolve(req.params.slug);if(!i)return next();
    const publicShare=(await entitlement(i)).paid&&!isClosed(i)&&!i.data._access?.passwordHash;
    const html=await readFile(path.join(root,'public','view.html'),'utf8');
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive'}).type('html').send(html.replace('<!-- SHARE_META -->',`<meta name="shq-invitation-id" content="${i.id}">`+shareTags(publicShare?i:null,env.PUBLIC_URL,'/'+req.params.slug)));
  }));
  app.use((err,req,res,next)=>{
    if((err.status||500)>=500)console.error(`Request failed: ${req.method} ${req.path} (${err.status||500})`);if(res.headersSent)return next(err);
    const status=err.status||500;
    res.status(status).json({error:err.expose?err.message:status===413?"Файл или запрос слишком большой":status===400?"Некорректные данные запроса":[409,503].includes(status)?err.message:"Ошибка сервера. Попробуйте ещё раз.",...(err.version?{version:err.version}:{}),...(err.code==="EDIT_CONFLICT"?{conflict:true}:{})});
  });return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PORT)||3000,app=createApp();app.listen(port,()=>console.log(`Готово: http://localhost:${port}`));app.locals.orderNotifications.start();
}
