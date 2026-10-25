import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "node:path";
import {defaultCover} from "./public/media-tools.js";
const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function shareTags(i,publicUrl,canonicalPath){
  let origin;try{const u=new URL(publicUrl);if(u.protocol!=="https:"||u.username||u.password)throw 0;origin=u.origin}catch{return '<meta property="og:title" content="Шақыру — приглашение"><meta name="robots" content="noindex">'}
  const s=i?.data,title=i?(s.names||"Шақыру")+" — "+(s.lang==="kz"?"Шақыру":"Приглашение"):"Шақыру — приглашение";
  const guestPath=/^\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonicalPath||'')?canonicalPath:'/i/'+i?.id;
  const description=i?[s.date,s.time,s.place].filter(Boolean).join(" · "):"Откройте ссылку, чтобы посмотреть приглашение.";
  return `<meta name="robots" content="noindex"><meta property="og:type" content="website"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}">${i?`<meta property="og:url" content="${origin}${guestPath}"><meta property="og:image" content="${origin}/share/${i.id}.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">`:""}`;
}
export async function shareImage(s,root){
  const canvas=createCanvas(1200,630),ctx=canvas.getContext("2d");
  const gradient=ctx.createLinearGradient(0,0,1200,630);gradient.addColorStop(0,s.c.bg||"#20143b");gradient.addColorStop(1,"#090b1a");ctx.fillStyle=gradient;ctx.fillRect(0,0,1200,630);
  const source=s.photo||(s.cover==="none"?"":s.cover||defaultCover(s.ev,s.dsg));
  try{let image;if(/^\/covers\/[\w-]+\.jpg$/.test(source))image=await loadImage(path.join(root,"public",source));else if(/^data:image\/(jpeg|png|webp);base64,/.test(source))image=await loadImage(Buffer.from(source.split(",")[1],"base64"));if(image){const scale=Math.max(1200/image.width,630/image.height);ctx.drawImage(image,(1200-image.width*scale)/2,(630-image.height*scale)/2,image.width*scale,image.height*scale);ctx.fillStyle="rgba(9,11,26,.7)";ctx.fillRect(0,0,1200,630)}}catch{}
  const accent=s.c.ac||"#f4d58a";ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.strokeRect(35,35,1130,560);
  ctx.textAlign="center";ctx.fillStyle=accent;ctx.font="28px sans-serif";ctx.fillText("ШАҚЫРУ",600,100);
  ctx.fillStyle="#fff";let size=64;do{ctx.font=`bold ${size}px sans-serif`;size-=2}while(ctx.measureText(s.names||"Приглашение").width>1050&&size>24);ctx.fillText(s.names||"Приглашение",600,285,1050);
  ctx.font="30px sans-serif";ctx.fillText(s.lang==="kz"?"Сіздерді қуанышымызға шақырамыз":"Приглашаем разделить наш праздник",600,350);
  ctx.fillStyle=accent;ctx.font="32px sans-serif";ctx.fillText([s.date?s.date.split("-").reverse().join("."):"",s.time].filter(Boolean).join("  ·  "),600,440);
  ctx.fillStyle="#fff";ctx.font="26px sans-serif";ctx.fillText(s.place||"",600,495,1000);
  return canvas.toBuffer("image/png");
}
