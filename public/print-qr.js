import qrcode from './vendor/qrcode.mjs';
import {download} from './event-tools.js';
import {validInvitationSlug} from './invitation-links.js';
export function invitationQrUrl(value){
  const u=new URL(value,location.origin);
  if(u.origin!==location.origin||!(/^\/i\/(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(u.pathname)||/^\/[a-z0-9-]+$/.test(u.pathname)&&validInvitationSlug(u.pathname.slice(1))))throw Error('QR доступен для опубликованного приглашения');
  const clean=new URL(u.pathname,u.origin),guest=u.searchParams.get('g');if(guest&&/^(?:[a-f0-9]{10}|[a-f0-9]{24})$/.test(guest))clean.searchParams.set('g',guest);
  return clean.href;
}
export function qrSvg(url){const qr=qrcode(0,'M');qr.addData(url,'Byte');qr.make();return qr.createSvgTag({cellSize:8,margin:32,scalable:true,title:'QR · Шақыру'})}
export function openPrintQr(value,title='',lang='ru'){
  const url=invitationQrUrl(value),svg=qrSvg(url),k=lang==='kz',trigger=document.activeElement;
  const dialog=document.createElement('dialog');dialog.className='qr-dialog';dialog.setAttribute('aria-labelledby','qr-title');
  const h=document.createElement('h2');h.id='qr-title';h.textContent=k?'Шақырудың QR-коды':'QR-код приглашения';
  const card=document.createElement('section');card.className='qr-print-card';const names=document.createElement('h3');names.textContent=title;const art=document.createElement('div');art.className='qr-art';art.innerHTML=svg;const caption=document.createElement('p');caption.textContent=k?'Шақыруды ашу үшін сканерлеңіз':'Отсканируйте, чтобы открыть приглашение';const link=document.createElement('p');link.textContent=url;link.className='qr-url';card.append(names,art,caption,link);
  const actions=document.createElement('div');actions.className='qr-actions';
  for(const [label,action] of [[k?'SVG жүктеу':'Скачать SVG',()=>download(svg,'image/svg+xml','invitation-qr.svg')],[k?'Басып шығару / PDF':'Печать / PDF',()=>{document.body.classList.add('printing-qr');try{window.print()}finally{document.body.classList.remove('printing-qr')}}],[k?'Жабу':'Закрыть',()=>dialog.close()]]){const b=document.createElement('button');b.type='button';b.className='gh';b.textContent=label;b.onclick=action;actions.append(b)}
  dialog.append(h,card,actions);if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)){const p=document.createElement('p');p.textContent=k?'Жергілікті сілтеме: қонақтарға жіберу үшін сайтты жариялаңыз.':'Это локальная ссылка. Для сканирования гостями сайт должен работать на публичном адресе.';dialog.append(p)}
  document.body.append(dialog);dialog.addEventListener('close',()=>{document.body.classList.remove('printing-qr');dialog.remove();trigger?.focus({preventScroll:true})});dialog.showModal();
}
