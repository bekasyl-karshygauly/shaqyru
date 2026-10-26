// One owner for panel visibility; switching never recreates editor controls.
function mountTabSet(list,{onSelect=()=>{}}={}){
  const tabs=[...list.querySelectorAll(':scope > a')];
  const panels=tabs.map(tab=>document.getElementById(tab.hash.slice(1)));
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let entering=null;
  let active=-1;
  list.setAttribute('role','tablist');
  tabs.forEach((tab,index)=>{
    tab.id='tab-'+panels[index].id;tab.setAttribute('role','tab');
    tab.setAttribute('aria-controls',panels[index].id);
    panels[index].setAttribute('role','tabpanel');
    panels[index].setAttribute('aria-labelledby',tab.id);panels[index].tabIndex=0;
  });
  function cancelEnter(){
    if(!entering)return;
    const {panel,animation}=entering;entering=null;
    animation.onfinish=animation.oncancel=null;animation.cancel();panel.removeAttribute('data-tab-entering');
  }
  function reveal(panel){
    if(reducedMotion.matches||document.hidden||typeof panel.animate!=='function')return;
    try{
      const animation=panel.animate([{opacity:.12,transform:'translate3d(0,10px,0)'},{opacity:1,transform:'none'}],{duration:420,easing:'cubic-bezier(.25,.75,.25,1)',fill:'none'});
      animation.id='editor-tab-enter';entering={panel,animation};panel.setAttribute('data-tab-entering','');
      const complete=()=>{if(entering?.animation===animation){entering=null;panel.removeAttribute('data-tab-entering')}};
      animation.onfinish=animation.oncancel=complete;
    }catch{panel.removeAttribute('data-tab-entering')}
  }
  function select(index,{focus=false,notify=true,animate=true}={}){
    if(index<0||index>=tabs.length)return false;
    const changed=active!==index;if(changed)cancelEnter();
    tabs.forEach((tab,i)=>{const selected=i===index;tab.classList.toggle('on',selected);tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;tab.removeAttribute('aria-current');panels[i].hidden=!selected});
    active=index;if(changed&&animate)reveal(panels[index]);
    if(focus)tabs[index].focus({preventScroll:true});
    if(changed&&notify)onSelect(panels[index]);
    return true;
  }
  const click=event=>{const tab=event.target.closest('[role="tab"]');if(!tabs.includes(tab)||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();select(tabs.indexOf(tab));};
  const keydown=event=>{const index=tabs.indexOf(event.target);if(index<0)return;const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:['Enter',' '].includes(event.key)?index:-1;if(next<0)return;event.preventDefault();select(next,{focus:true})};
  const preferenceChange=()=>{if(reducedMotion.matches)cancelEnter()},visibilityChange=()=>{if(document.hidden)cancelEnter()};
  reducedMotion.addEventListener('change',preferenceChange);document.addEventListener('visibilitychange',visibilityChange);
  list.addEventListener('click',click);list.addEventListener('keydown',keydown);select(0,{notify:false,animate:false});
  return {tabs,panels,select,cancel:cancelEnter,get index(){return active},destroy(){cancelEnter();reducedMotion.removeEventListener('change',preferenceChange);document.removeEventListener('visibilitychange',visibilityChange);list.removeEventListener('click',click);list.removeEventListener('keydown',keydown)}};
}

export function mountEditorNavigation({state}){
  const $=s=>document.querySelector(s),t=(ru,kz)=>state().lang==='kz'?kz:ru;
  const list=$('#step-nav'),shell=$('#editor-navigation'),introList=$('#intro-tabs');
  const footer=document.createElement('div');footer.className='editor-panel-navigation';
  footer.innerHTML='<button type="button" class="gh" id="editor-section-back"></button><span id="editor-section-status"></span><button type="button" class="gh" id="editor-section-next"></button>';
  $('#form-col').append(footer);
  const titles=[['Повод','Мереке'],['Дизайн','Дизайн'],['Данные','Мәліметтер'],['Фото и стиль','Фото және стиль'],['Анимация','Анимация'],['Музыка','Музыка'],['Гостям','Қонақтарға'],['Программа','Бағдарлама']];
  const introTitles=[['Открытие','Ашылу'],['Фото заставки','Мұқаба фотосы'],['Атмосфера','Атмосфера'],['Фотоистория','Фотооқиға'],['Видео','Бейне']];
  let restoring=false,guided=false;
  function remember(id){if(restoring||location.hash==='#'+id)return;const url=new URL(location.href);url.hash=id;history.pushState(null,'',url)}
  function align(){if(shell.getBoundingClientRect().top<0)shell.scrollIntoView({block:'start',behavior:'auto'})}
  function editor(){if($('#form-col').classList.contains('mob-hidden'))$('#mt-edit').click()}
  const main=mountTabSet(list,{onSelect:panel=>{intro.cancel();editor();remember(panel.id);translate();align();document.dispatchEvent(new CustomEvent('shq:sectionchange',{detail:{id:panel.id}}))}});
  const intro=mountTabSet(introList,{onSelect:panel=>{remember(panel.id)}});
  function open(target,{focus=false,scroll=false,record=true,animate=true}={}){
    const node=typeof target==='string'?document.getElementById(target.replace(/^#/,'')):target;
    const section=node?.closest('.form-col > .sec'),index=main.panels.indexOf(section);
    if(index<0)return false;
    const wasRestoring=restoring,enteringMain=main.index!==index;restoring=true;editor();main.select(index,{focus,animate});
    const child=node.closest('.intro-tab-panel');if(child)intro.select(intro.panels.indexOf(child),{animate:animate&&!enteringMain});
    for(let parent=node.parentElement;parent&&parent!==section;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
    restoring=wasRestoring;if(record)remember(child?.id||section.id);
    if(scroll)align();return true;
  }
  function fromUrl(event){let id;try{id=decodeURIComponent(location.hash.slice(1))}catch{return}open(id||main.panels[0].id,{record:false,animate:!!event})}
  function translate(){
    main.tabs.forEach((tab,index)=>{const number=tab.querySelector('span');tab.replaceChildren(number,document.createTextNode(t(...titles[index])))});
    intro.tabs.forEach((tab,index)=>tab.textContent=t(...introTitles[index]));
    list.setAttribute('aria-label',t('Разделы редактора','Редактор бөлімдері'));introList.setAttribute('aria-label',t('Настройки анимации','Анимация баптаулары'));
    $('#editor-section-back').textContent=t('← Назад','← Артқа');$('#editor-section-back').disabled=main.index===0;
    $('#editor-section-next').textContent=main.index===main.tabs.length-1?t('Проверить приглашение','Шақыруды тексеру'):t('Далее: '+titles[main.index+1][0], 'Келесі: '+titles[main.index+1][1]);
    $('#editor-section-status').textContent=t(`Раздел ${main.index+1} из ${main.tabs.length}`,`${main.tabs.length} бөлімнің ${main.index+1}-бөлімі`);
    footer.hidden=guided;
  }
  $('#editor-section-back').onclick=()=>open(main.panels[main.index-1],{focus:true,scroll:true});
  $('#editor-section-next').onclick=()=>{if(main.index<main.tabs.length-1)open(main.panels[main.index+1],{focus:true,scroll:true});else{$('#check-invitation').click();$('.assistant-panel').scrollIntoView({block:'start',behavior:'auto'})}};
  const skip=event=>{event.preventDefault();open(main.panels[main.index],{focus:true,scroll:true});main.panels[main.index].focus({preventScroll:true})};
  $('.skip-editor').addEventListener('click',skip);window.addEventListener('hashchange',fromUrl);window.addEventListener('popstate',fromUrl);
  fromUrl();translate();
  return {open,translate,get ids(){return main.panels.map(panel=>panel.id)},get activeId(){return main.panels[main.index].id},setGuided(value){guided=value;translate()},destroy(){main.destroy();intro.destroy();footer.remove();window.removeEventListener('hashchange',fromUrl);window.removeEventListener('popstate',fromUrl);$('.skip-editor').removeEventListener('click',skip)}};
}
