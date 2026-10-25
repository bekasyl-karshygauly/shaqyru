// Presentation and navigation only. Invitation data belongs to the editor.
export function mountDesignStudio({state}){
  const $=s=>document.querySelector(s),t=(ru,kz)=>state().lang==='kz'?kz:ru;
  const copy={editorTitle:['Здесь начинается ваш праздник','Мерекеңіз осы жерден басталады'],editorIntro:['Выберите дизайн, добавьте детали — и приглашение оживёт.','Дизайнды таңдап, мәліметтерді қосыңыз — шақыруыңыз дайын болады.'],preview:['Ваше приглашение','Сіздің шақыруыңыз'],live:['ПРЕДПРОСМОТР','АЛДЫН АЛА ҚАРАУ'],previewHint:['Изменения сразу видны здесь','Өзгерістер осы жерде бірден көрінеді'],empty:['Нет подходящих дизайнов. Попробуйте другое название или категорию.','Сәйкес дизайн табылмады. Басқа атауды немесе санатты таңдаңыз.']};
  const preview=document.createElement('div');preview.className='preview-heading';preview.innerHTML='<div><span class="eyebrow" data-copy="live"></span><h2 data-copy="preview"></h2></div><span class="live-dot" aria-hidden="true"></span>';$('#pvw-col').prepend(preview);
  const note=document.createElement('p');note.className='preview-note';note.dataset.copy='previewHint';$('#pv').after(note);
  const search=document.createElement('div');search.className='template-search';search.innerHTML='<label for="template-search"></label><div><input id="template-search" type="search" autocomplete="off"><span id="template-count" role="status"></span></div>';$('#fl').before(search);
  const empty=document.createElement('p');empty.className='template-empty';empty.dataset.copy='empty';empty.hidden=true;$('#gal').after(empty);
  let favoriteFilter={only:false,ids:[]};$('#gal').addEventListener('favoriteschange',e=>{favoriteFilter=e.detail;filter()});
  function filter(){const query=$('#template-search').value.trim().toLocaleLowerCase();let count=0;$('#gal').querySelectorAll('button.g').forEach(b=>{b.hidden=!b.querySelector('b').textContent.toLocaleLowerCase().includes(query)||(favoriteFilter.only&&!favoriteFilter.ids.includes(Number(b.dataset.i)));if(!b.hidden)count++});$('#template-count').textContent=t(`${count} из 30`,`${count} / 30`);empty.hidden=count>0}
  $('#template-search').addEventListener('input',filter);new MutationObserver(filter).observe($('#gal'),{childList:true});
  function translate(){
    document.querySelectorAll('[data-copy]').forEach(el=>{const pair=copy[el.dataset.copy];if(pair)el.textContent=pair[state().lang==='kz'?1:0]});
    $('.skip-editor').textContent=t('К редактору','Редакторға өту');$('.editor-breadcrumb').textContent=t('← На главную','← Басты бетке');
    const nav=$('.editor-site-nav').children;['Главная|Басты бет','Мои приглашения|Менің шақыруларым','Создать приглашение|Шақыру жасау'].forEach((pair,i)=>nav[i].textContent=t(...pair.split('|')));
    search.querySelector('label').textContent=t('Найти свой дизайн','Өз дизайныңызды табыңыз');$('#template-search').placeholder=t('Название дизайна…','Дизайн атауы…');filter();try{localStorage.setItem('shq-language',state().lang)}catch{}
  }
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  for(const id of ['ev','fl','gal','covg','animg','fxg','top-lang','lg']){const group=$('#'+id),sync=()=>group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('on'))));new MutationObserver(sync).observe(group,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});sync()}
  const links=[...$('#step-nav').querySelectorAll('a')];const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting)links.forEach(a=>{const active=a.hash==='#'+e.target.id;a.classList.toggle('on',active);if(active)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current')})},{rootMargin:'-15% 0px -65% 0px'});document.querySelectorAll('.form-col > .sec').forEach(e=>observer.observe(e));
  translate();
}
