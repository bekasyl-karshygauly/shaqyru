import {element} from './order-components.js';
const host=document.querySelector('#public-reviews');
if(host){
  let rows=null,failed=false;
  function render(){const kz=document.documentElement.lang==='kk';host.querySelector('h2').textContent=kz?'Клиенттер пікірлері':'Отзывы клиентов';const list=host.querySelector('.reviews-grid');list.replaceChildren();
    if(failed){list.append(element('p',kz?'Пікірлерді жүктеу мүмкін болмады. Кейінірек қайталаңыз.':'Не удалось загрузить отзывы. Попробуйте позже.'));return}
    if(!rows){list.append(element('p',kz?'Пікірлер жүктелуде…':'Загружаем отзывы…'));return}
    if(!rows.length){list.append(element('p',kz?'Алғашқы пікірлер клиенттер келісіп, ұйымдастырушы тексергеннен кейін пайда болады.':'Первые отзывы появятся после согласия клиентов и проверки организатором.'));return}
    for(const row of rows){const card=element('article','','review-card');card.append(element('strong',row.name),element('span','★'.repeat(row.rating)+' · '+row.rating+'/5'),element('p',row.text));if(row.published_at){const time=element('time',new Date(row.published_at).toLocaleDateString(kz?'kk-KZ':'ru-RU'));time.dateTime=row.published_at;card.append(time)}list.append(card)}
  }
  const retry=host.querySelector('button');retry.onclick=async()=>{retry.disabled=true;failed=false;rows=null;render();try{const response=await fetch('/api/reviews',{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const j=await response.json();if(!Array.isArray(j))throw Error();rows=j;failed=false}catch{failed=true}finally{retry.disabled=false;render()}};
  new MutationObserver(()=>{retry.textContent=document.documentElement.lang==='kk'?'Пікірлерді жаңарту':'Обновить отзывы';render()}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});retry.click();
}
