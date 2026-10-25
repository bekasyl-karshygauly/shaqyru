export const ZONES = ["Asia/Almaty", "Asia/Atyrau", "Asia/Aqtau", "Asia/Aqtobe", "Asia/Oral", "Asia/Qyzylorda", "Asia/Bishkek", "Europe/Moscow", "UTC"];
export function createRequestId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
const parts = (date, zone) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {timeZone:zone, year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date).map(p=>[p.type,p.value]));
export function eventInstant(date, time="00:00", zone="Asia/Almaty") {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(time)||!ZONES.includes(zone))return null;
  const target=Date.parse(date+"T"+time+":00Z");if(!Number.isFinite(target))return null;
  let guess=target;
  for(let n=0;n<3;n++){const p=parts(new Date(guess),zone);guess+=target-Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`)}
  const p=parts(new Date(guess),zone);return `${p.year}-${p.month}-${p.day}`===date&&`${p.hour}:${p.minute}`===time?new Date(guess):null;
}
const stamp=d=>d.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
const escapeICS=v=>String(v||"").replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/;/g,"\\;").replace(/,/g,"\\,");
// Fold by UTF-8 bytes, keeping each Unicode code point intact (RFC 5545).
function fold(line){let result="",row="",size=0;for(const ch of line){const n=new TextEncoder().encode(ch).length;if(size+n>75){result+=row+"\r\n";row=" ";size=1}row+=ch;size+=n}return result+row}
export function calendar(s, id="preview") {
  const start=eventInstant(s.date,s.time||"00:00",s.zone||"Asia/Almaty");if(!start)return "";
  const allDay=!s.time,end=new Date(start.getTime()+3*3600000);
  const nextDay=new Date(Date.parse(s.date+"T00:00:00Z")+86400000).toISOString().slice(0,10).replace(/-/g,"");
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Shaqyru//Invitations//RU","CALSCALE:GREGORIAN","BEGIN:VEVENT",`UID:${id}@shaqyru`,"DTSTAMP:"+stamp(new Date()),allDay?"DTSTART;VALUE=DATE:"+s.date.replace(/-/g,""):"DTSTART:"+stamp(start),allDay?"DTEND;VALUE=DATE:"+nextDay:"DTEND:"+stamp(end),"SUMMARY:"+escapeICS(s.names||"Шақыру"),"LOCATION:"+escapeICS([s.place,s.addr].filter(Boolean).join(", ")),"DESCRIPTION:"+escapeICS([s.text,s.sch].filter(Boolean).join("\n\n")),"END:VEVENT","END:VCALENDAR"].map(fold).join("\r\n")+"\r\n";
}
export function maps(s){
  const point=s.lat!==""&&s.lng!==""&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))&&Math.abs(Number(s.lat))<=90&&Math.abs(Number(s.lng))<=180;
  const dest=point?`${Number(s.lat)},${Number(s.lng)}`:[s.place,s.addr].filter(Boolean).join(", ");
  return {google:"https://www.google.com/maps/dir/?api=1&destination="+encodeURIComponent(dest),dgis:point?`https://2gis.kz/geo/${Number(s.lng)},${Number(s.lat)}`:"https://2gis.kz/search/"+encodeURIComponent(dest)};
}
export function csv(rows){const cell=v=>{let value=String(v??"");if(/^(\s*[=+@-]|[\t\r\n])/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"'};return "\ufeff"+[["Имя","Ответ","Количество гостей","Комментарий","Дети","Питание","Трансфер"],...rows.map(g=>[g.name,g.status==="yes"?"Придёт":g.status==="no"?"Не придёт":"Ждём ответа",g.cnt||0,g.note||"",g.status==="yes"?(g.details?.children||0):0,g.status==="yes"?(g.details?.diet||""):"",g.status==="yes"&&g.details?.transfer?"Да":"Нет"])].map(row=>row.map(cell).join(";")).join("\r\n")}
export function download(content,type,name){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
