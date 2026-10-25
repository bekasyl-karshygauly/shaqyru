import {eventInstant} from './event-tools.js';
// Optional guidance and local photo processing; no changes to payment or storage rules.
export function checkInvitation(s,{suggestions=false,now=new Date()}={}){
  const issues=[];
  for(const [field,ru,kz] of [['names','Укажите имена','Есімдерді жазыңыз'],['date','Укажите дату','Күнін көрсетіңіз'],['time','Укажите время','Уақытын көрсетіңіз'],['place','Укажите место','Өтетін орнын көрсетіңіз'],['text','Добавьте текст приглашения','Шақыру мәтінін жазыңыз']])if(!String(s[field]||'').trim())issues.push({field,ru,kz});
  if(s.date&&s.date<now.toLocaleDateString('en-CA',{timeZone:s.zone||'Asia/Almaty'}))issues.push({field:'date',ru:'Дата уже прошла — проверьте её',kz:'Күні өтіп кетті — тексеріңіз'});
  const coordinates=String(s.lat??'').trim()!==''&&String(s.lng??'').trim()!==''&&Number.isFinite(Number(s.lat))&&Number.isFinite(Number(s.lng))&&Math.abs(Number(s.lat))<=90&&Math.abs(Number(s.lng))<=180;
  if(!String(s.addr||'').trim()&&!coordinates)issues.push({field:'addr',ru:'Добавьте адрес или координаты для маршрута',kz:'Бағыт үшін мекенжайды немесе координаттарды қосыңыз'});
  const start=eventInstant(s.date,s.time,s.zone||'Asia/Almaty');if(start&&start<=now&&!issues.some(i=>i.field==='date'))issues.push({field:'time',ru:'Время начала уже прошло — проверьте дату и время',kz:'Басталу уақыты өтіп кетті — күні мен уақытын тексеріңіз'});
  if(suggestions){
    if(!s.photo&&!s.introPhoto&&(!s.cover||s.cover==='none'))issues.push({field:'photo',ru:'По желанию добавьте фото для более личного приглашения',kz:'Қаласаңыз, шақыруға жеке фото қосыңыз'});
    if(s.closeAt&&start){const close=eventInstant(s.closeAt.slice(0,10),s.closeAt.slice(11,16),s.zone||'Asia/Almaty');if(close&&close<start)issues.push({field:'closeAt',ru:'Доступ закроется до начала праздника — проверьте время закрытия',kz:'Қолжетімділік мереке басталмай жабылады — жабылу уақытын тексеріңіз'})}
    if(s.closed)issues.push({field:'closed',ru:'Приглашение закрыто для гостей',kz:'Шақыру қонақтар үшін жабық'});
    if((s.lat||s.lng)&&!coordinates&&s.addr)issues.push({field:'lat',ru:'Проверьте обе координаты: сейчас маршрут строится по адресу',kz:'Екі координатты тексеріңіз: қазір бағыт мекенжай бойынша құрылады'});
  }
  return issues;
}

export function mountEditorAssistant({state,applyPhoto}){
  const $=s=>document.querySelector(s),t=(ru,kz)=>state().lang==='kz'?kz:ru;
  const panel=document.createElement('section');panel.className='assistant-panel';panel.innerHTML='<div class="row"><button type="button" class="gh" id="wizard-toggle"></button><button type="button" class="gh" id="check-invitation"></button></div><div id="wizard-controls" hidden><p id="wizard-progress" role="status"></p><div class="row"><button type="button" class="gh" id="wizard-back"></button><button type="button" class="go" id="wizard-next"></button></div></div><div id="invitation-check" role="status" hidden></div>';
  $('#step-nav').before(panel);
  const groups=[['sec-ev'],['sec-dsg'],['sec-data','sec-style','sec-anim','sec-mus','sec-details','sec-prog'],[]];
  let enabled=false,step=0;
  function review(){const box=$('#invitation-check');box.hidden=false;box.replaceChildren();const issues=checkInvitation(state(),{suggestions:true}),heading=document.createElement('p');heading.textContent=issues.length?t('Перед отправкой проверьте:','Жіберер алдында тексеріңіз:'):t('Основные данные заполнены. Откройте предпросмотр и проверьте текст.','Негізгі деректер толтырылған. Алдын ала көріп, мәтінді тексеріңіз.');box.append(heading);
    for(const issue of issues){const button=document.createElement('button');button.type='button';button.className='gh check-item';button.textContent=t(issue.ru,issue.kz);button.onclick=()=>{if(enabled){step=2;render()}$('#mt-edit').click();const field=$('#'+issue.field);field.scrollIntoView({block:'center'});field.focus()};box.append(button)}
    const note=document.createElement('p');note.className='mu';note.textContent=t('Проверка не блокирует сохранение и предпросмотр. Доступ гостей откроется после публикации организатором.','Тексеру сақтау мен алдын ала көруге кедергі келтірмейді. Қонақтарға қолжетімділік ұйымдастырушы жариялағаннан кейін ашылады.');box.append(note);
  }
  function render(){
    $('#wizard-toggle').textContent=enabled?t('Показать все настройки','Барлық баптауларды көрсету'):t('Создать пошагово','Қадаммен жасау');$('#check-invitation').textContent=t('Проверить приглашение','Шақыруды тексеру');$('#wizard-controls').hidden=!enabled;
    $('#wizard-back').textContent=t('Назад','Артқа');$('#wizard-back').disabled=step===0;$('#wizard-next').textContent=step===3?t('Вернуться к данным','Деректерге оралу'):t('Далее','Келесі');
    $('#wizard-progress').textContent=t(`Шаг ${step+1} из 4: `,`4 қадамның ${step+1}-қадамы: `)+[t('Повод','Мереке'),t('Дизайн','Дизайн'),t('Данные и оформление','Деректер мен безендіру'),t('Проверка','Тексеру')][step];
    for(const id of groups.flat())$('#'+id).hidden=enabled&&!groups[step].includes(id);
    $('#step-nav').hidden=enabled;if(enabled&&step===3)review();else if(enabled)$('#invitation-check').hidden=true;
  }
  $('#wizard-toggle').onclick=()=>{enabled=!enabled;step=0;$('#mt-edit').click();render()};$('#wizard-back').onclick=()=>{step--;render()};$('#wizard-next').onclick=()=>{step=step===3?2:step+1;render();panel.scrollIntoView({block:'start'})};$('#check-invitation').onclick=review;
  document.addEventListener('shq:changed',()=>{if(!$('#invitation-check').hidden)review()});
  $('#form-col').addEventListener('input',()=>{if(!$('#invitation-check').hidden)review()});
  $('#app').addEventListener('click',e=>{if(e.target.closest('[data-l]'))queueMicrotask(()=>{render();if(!$('#invitation-check').hidden)review()})});
  render();

  const dialog=document.createElement('dialog');dialog.id='photo-editor';dialog.className='photo-editor';dialog.innerHTML='<h3 id="photo-title"></h3><canvas width="360" height="480" id="photo-canvas" aria-label="Фото / Фотография"></canvas><label for="photo-zoom" id="zoom-label"></label><input id="photo-zoom" type="range" min="1" max="3" step="0.05" value="1"><label for="photo-x" id="x-label"></label><input id="photo-x" type="range" min="-1" max="1" step="0.02" value="0"><label for="photo-y" id="y-label"></label><input id="photo-y" type="range" min="-1" max="1" step="0.02" value="0"><div class="row"><button type="button" class="gh" id="photo-rotate"></button><button type="button" class="gh" id="photo-cancel"></button><button type="button" class="go" id="photo-apply"></button></div>';
  document.body.append(dialog);dialog.setAttribute('aria-labelledby','photo-title');
  const feedback=document.createElement('p');feedback.id='photo-feedback';feedback.setAttribute('role','status');$('#photo').parentElement.append(feedback);
  let image=null,angle=0,sequence=0;
  function draw(){if(!image)return;const c=$('#photo-canvas'),ctx=c.getContext('2d'),rotated=angle%180!==0,iw=rotated?image.height:image.width,ih=rotated?image.width:image.height,scale=Math.max(c.width/iw,c.height/ih)*Number($('#photo-zoom').value),dx=Number($('#photo-x').value)*(iw*scale-c.width)/2,dy=Number($('#photo-y').value)*(ih*scale-c.height)/2;ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.save();ctx.translate(c.width/2+dx,c.height/2+dy);ctx.rotate(angle*Math.PI/180);ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);ctx.restore()}
  for(const id of ['photo-zoom','photo-x','photo-y'])$('#'+id).oninput=draw;
  $('#photo-rotate').onclick=()=>{angle=(angle+90)%360;draw()};$('#photo-cancel').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{image=null});
  $('#photo-apply').onclick=()=>{try{applyPhoto($('#photo-canvas').toDataURL('image/jpeg',.85));dialog.close();feedback.textContent=t('Фото добавлено','Фото қосылды')}catch{feedback.textContent=t('Не удалось сохранить фото. Попробуйте другой файл.','Фотоны сақтау мүмкін болмады. Басқа файлды таңдаңыз.')}};
  $('#photo').onchange=async e=>{
    const file=e.target.files[0],ticket=++sequence;e.target.value='';if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>15*1024*1024){feedback.textContent=t('Выберите JPEG, PNG или WebP до 15 МБ.','15 МБ дейінгі JPEG, PNG немесе WebP таңдаңыз.');return}
    feedback.textContent=t('Загружаем фото…','Фото жүктелуде…');const url=URL.createObjectURL(file);
    try{const loaded=new Image();loaded.src=url;await loaded.decode();if(ticket!==sequence)return;if(loaded.width*loaded.height>40000000)throw Error('Image too large');image=loaded;angle=0;$('#photo-zoom').value='1';$('#photo-x').value=$('#photo-y').value='0';
      for(const [id,ru,kz] of [['photo-title','Кадрирование фото','Фотоны қиып алу'],['zoom-label','Масштаб','Масштаб'],['x-label','Положение по горизонтали','Көлденең орналасуы'],['y-label','Положение по вертикали','Тігінен орналасуы'],['photo-rotate','Повернуть на 90°','90° бұру'],['photo-cancel','Отмена','Бас тарту'],['photo-apply','Добавить фото','Фото қосу']])$('#'+id).textContent=t(ru,kz);
      draw();feedback.textContent='';dialog.showModal();
    }catch{if(ticket===sequence)feedback.textContent=t('Не удалось открыть фото: файл повреждён или слишком большой. Выберите другое изображение.','Фото ашылмады: файл бүлінген немесе тым үлкен. Басқа суретті таңдаңыз.')}
    finally{URL.revokeObjectURL(url)}
  };
}
