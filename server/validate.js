import {cleanTranslations} from "./public/guest-language.js";
// Серверная проверка данных приглашения: всё, что попадает на страницу гостей, проходит через clean().
export const TIER = [1,1,1,1,2,2,2,2,2,2,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,3,4,4,3,4]; // уровень цены по номеру дизайна (30 дизайнов)
export const PRICE = [0, 2490, 3990, 5990, 8990];
const FN = ["Lora","Montserrat","Pacifico","Lobster","Oswald","Comfortaa","Caveat"];
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const col = (v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined);
const pick = (v, a, d) => (a.includes(v) ? v : d);
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v < max ? v : 0);
export function clean(d = {}) {
  if (!d || typeof d !== "object" || Array.isArray(d)) d = {};
  const c = {}, src = d.c && typeof d.c === "object" ? d.c : {};
  for (const k of ["bg", "ink", "ac"]) { const x = col(src[k]); if (x) c[k] = x; }
  const photo = media(d.photo, "image", true);
  const cover = d.cover === "none" ? "none" : media(d.cover, "image");
  return {
    bilingual:d.bilingual===true,translations:cleanTranslations(d.translations),
    ev: int(d.ev, 11), lang: pick(d.lang, ["kz", "ru"], "kz"), dsg: int(d.dsg, TIER.length),
    names: str(d.names, 80), hosts: str(d.hosts, 100),
    date: validDate(d.date) ? d.date : "", time: /^([01]\d|2[0-3]):[0-5]\d$/.test(d.time) ? d.time : "",
    place: str(d.place, 100), addr: str(d.addr, 150), text: str(d.text, 500), te: d.te ? 1 : 0, c,
    font: pick(d.font, FN, ""), frame: pick(d.frame, ["none","thin","double","dot","thick","round"], "double"),
    photo, cover, introPhoto:media(d.introPhoto,"image",true),
    introX:Number.isFinite(d.introX)?Math.max(0,Math.min(100,d.introX)):50,
    introY:Number.isFinite(d.introY)?Math.max(0,Math.min(100,d.introY)):50,
    pl: pick(d.pl, ["frame", "bg"], "frame"), ps: pick(d.ps, ["circle","arch","oval","square"], "circle"),
    pf: pick(d.pf, ["none","sepia","bw","warm","fade"], "none"),
    anim: pick(d.anim, ["auto","env","doors","scroll","box","curtain","heart","flip","portal","cinema","album","iris","mosaic","polaroid","bloom","panorama","soft"], "auto"),
    fx: pick(d.fx, ["auto","petals","stars","confetti","hearts","dust"], "auto"),
    scene:pick(d.scene,['none','garden','stars','balloons','ornament'],'none'),
    sceneSpeed:pick(d.sceneSpeed,['slow','normal','fast'],'normal'),
    sceneDensity:pick(d.sceneDensity,['low','medium','high'],'medium'),
    story:(Array.isArray(d.story)?d.story:[]).slice(0,5).map(p=>({src:media(p?.src,'image',true),caption:str(p?.caption,120),x:bounded(p?.x,0,100,50),y:bounded(p?.y,0,100,50),zoom:bounded(p?.zoom,1,2,1),fit:pick(p?.fit,['contain','cover'],'contain'),duration:bounded(p?.duration,3,15,5)})).filter(p=>p.src),
    greeting:str(d.greeting,180),rsvpQuestions:[...new Set((Array.isArray(d.rsvpQuestions)?d.rsvpQuestions:[]).filter(k=>['children','diet','transfer'].includes(k)))],
    dressCode:str(d.dressCode,400),giftNote:str(d.giftNote,500),contactName:str(d.contactName,100),contactPhone:str(d.contactPhone,30),
    dressColors:(Array.isArray(d.dressColors)?d.dressColors:[]).filter(c=>col(c)).slice(0,5),
    faq:(Array.isArray(d.faq)?d.faq:[]).slice(0,6).map(p=>({q:str(p?.q,150),a:str(p?.a,500)})),
    sch: str(d.sch, 1200),
    zone: pick(d.zone, ["Asia/Almaty","Asia/Atyrau","Asia/Aqtau","Asia/Aqtobe","Asia/Oral","Asia/Qyzylorda","Asia/Bishkek","Europe/Moscow","UTC"], "Asia/Almaty"),
    lat: coordinate(d.lat,90), lng: coordinate(d.lng,180),
    closed: d.closed === true,
    closeAt: typeof d.closeAt === "string" && validDate(d.closeAt.slice(0,10)) && /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(d.closeAt) ? d.closeAt : "",
    mus: d.mus === "none" ? "none" : media(d.mus, "audio"),
    musTitle: str(d.musTitle || "", 100),
    vc: d.vc ? 1 : 0,
  };
}

function coordinate(value,max){return typeof value==="string" && value.trim()!=="" && Number.isFinite(Number(value)) && Math.abs(Number(value))<=max ? String(Number(value)) : ""}

function media(value, type, inline = false) {
  if (typeof value !== "string" || /[\s<>"'\\\u0000-\u001f]/.test(value)) return "";
  if (inline && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length < 15000000) return value;
  if (value.length > 250) return "";
  const local = type === "image" ? /^\/(covers|uploads)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i : /^\/(audio|uploads)\/[A-Za-z0-9_-]+\.(mp3|wav|m4a|aac|ogg|webm)$/i;
  if (local.test(value)) return value;
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password ? u.href : ""; } catch { return ""; }
}
function validDate(value) {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00Z");
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
}

function bounded(v,min,max,fallback){return Number.isFinite(v)?Math.max(min,Math.min(max,v)):fallback}
