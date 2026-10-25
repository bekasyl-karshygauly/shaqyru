/* Shared photo openings for the editor, guest invitation and motion preview. */
window.PhotoOpenings=(()=>{
  const catalog=[
    {id:'cinema',icon:'🎬',name:'Киноистория',kz:'Кинохикая',desc:'Экран раскрывается сверху и снизу',descKz:'Экран жоғары және төмен ашылады',group:'Кино'},
    {id:'album',icon:'📖',name:'Фотоальбом',kz:'Фотоальбом',desc:'Обложка переворачивается как страница',descKz:'Мұқаба парақ сияқты аударылады',group:'Бумага'},
    {id:'iris',icon:'◉',name:'Диафрагма',kz:'Диафрагма',desc:'Фото открывается через растущий круг',descKz:'Фото үлкейетін шеңбер арқылы ашылады',group:'Геометрия'},
    {id:'mosaic',icon:'▦',name:'Мозаика',kz:'Мозаика',desc:'Двенадцать фрагментов разлетаются волной',descKz:'Он екі бөлік толқынмен ашылады',group:'Геометрия'},
    {id:'polaroid',icon:'📸',name:'Стопка снимков',kz:'Фотосуреттер',desc:'Снимки разъезжаются в разные стороны',descKz:'Суреттер екі жаққа жылжиды',group:'Бумага'},
    {id:'bloom',icon:'🌷',name:'Цветочное раскрытие',kz:'Гүлдің ашылуы',desc:'Лепестки раскрываются вокруг фотографии',descKz:'Фото айналасында гүл күлтелері ашылады',group:'Романтика'},
    {id:'panorama',icon:'↔',name:'Панорама',kz:'Панорама',desc:'Полосы фото уходят влево и вправо',descKz:'Фото жолақтары екі жаққа ашылады',group:'Кино'},
    {id:'soft',icon:'☁',name:'Нежное растворение',kz:'Нәзік ашылу',desc:'Мягкое появление без вращений и вспышек',descKz:'Айналусыз және жарқылсыз жұмсақ көрініс',group:'Романтика'}
  ];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function safePhoto(value){
    if(typeof value!=='string'||/[\s<>"'\\\u0000-\u001f]/.test(value))return '';
    if(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)&&value.length<15000000)return value;
    if(value.length>250)return '';
    if(/^\/(covers|uploads|images)\/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$/i.test(value))return value;
    try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:''}catch{return ''}
  }
  const position=value=>Number.isFinite(Number(value))?Math.min(100,Math.max(0,Number(value))):50;
  function photoFor(s){return safePhoto(s.introPhoto)||safePhoto(s.photo)||(s.cover!=='none'&&safePhoto(s.cover))||'/covers/wedding.jpg'}
  async function loadPhoto(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>12*1024*1024)throw Error('format');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();if(img.width*img.height>40000000)throw Error('size');
      const ratio=Math.min(1,1200/Math.max(img.width,img.height));const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.85);
    }finally{URL.revokeObjectURL(url)}
  }
  let current=null;
  function show(s,{done,manual=false,motion,controlled}={}){
    current?.();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    if(reduced.matches&&!manual){done?.();return}
    const choice=catalog.find(a=>a.id===s.anim)||catalog[0],kz=s.lang==='kz';
    const dialog=document.createElement(controlled?'div':'dialog');dialog.className=`intro photo-intro scene-${choice.id}`;
    dialog.setAttribute('aria-label',kz?'Шақыруды ашу':'Открытие приглашения');
    dialog.style.setProperty('--photo-x',`${position(s.introX)}%`);dialog.style.setProperty('--photo-y',`${position(s.introY)}%`);
    const src=esc(photoFor(s)),picture=`<img src="${src}" alt="">`;
    const panels=choice.id==='mosaic'?12:choice.id==='panorama'?5:choice.id==='bloom'?6:choice.id==='polaroid'?3:choice.id==='cinema'?2:1;
    dialog.innerHTML=`<div class="scene-stage"><div class="scene-image">${picture}</div><div class="scene-panels" aria-hidden="true">${Array.from({length:panels},(_,i)=>`<div class="scene-panel" style="--i:${i}">${['album','polaroid','panorama'].includes(choice.id)?picture:''}</div>`).join('')}</div><div class="scene-copy"><small>${esc(kz?choice.kz:choice.name)}</small><h2>${esc(s.names)}</h2><p>${esc(s.date||'')}</p></div><button class="seal" type="button">${kz?'Ашу':'Открыть'}</button></div><div class="scene-controls"><label><input type="checkbox" class="scene-motion"> ${kz?'Қозғалысты көрсету':'Показывать движение'}</label><button class="intro-skip" type="button">${kz?'Өткізу':'Пропустить'}</button></div>`;
    // Choosing a preview is an explicit request to see the movement.
    const toggle=dialog.querySelector('.scene-motion');toggle.checked=motion??(manual||!reduced.matches);
    const previous=document.activeElement;let finished=false,playing=false,timer;const animations=[];
    const close=()=>{
      if(finished)return;finished=true;clearTimeout(timer);animations.forEach(a=>a.cancel());reduced.removeEventListener('change',onPreference);
      if(!controlled)dialog.close();dialog.remove();current=null;if(!controlled)previous?.isConnected&&previous.focus({preventScroll:true});done?.();
    };
    const onPreference=e=>{if(e.matches){toggle.checked=false;if(playing&&!controlled)close()}};
    reduced.addEventListener('change',onPreference);current=close;
    dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.querySelector('.intro-skip').onclick=close;
    const animate=(element,frames,duration=1400,delay=0)=>animations.push(element.animate(frames,{duration,delay,fill:'forwards',easing:'cubic-bezier(.22,.7,.2,1)'}));
    toggle.onchange=()=>{if(!toggle.checked&&playing)close()};
    const start=()=>{
      if(playing)return;playing=true;if(!toggle.checked){close();return}
      dialog.querySelector('.seal').disabled=true;
      animate(dialog.querySelector('.seal'),[{opacity:1},{opacity:0,transform:'scale(.85)'}],350);
      const parts=[...dialog.querySelectorAll('.scene-panel')];
      parts.forEach((part,i)=>{
        switch(choice.id){
          case 'cinema':animate(part,[{transform:'translateY(0)'},{transform:`translateY(${i===0?'-':'+'}105%)`}]);break;
          case 'album':animate(part,[{transform:'perspective(1000px) rotateY(0)'},{transform:'perspective(1000px) rotateY(-135deg)'}]);break;
          case 'iris':animate(part,[{clipPath:'circle(150% at 50% 50%)'},{clipPath:'circle(0% at 50% 50%)',opacity:0}]);animate(dialog.querySelector('.scene-image'),[{clipPath:'circle(0% at 50% 50%)'},{clipPath:'circle(100% at 50% 50%)'}]);break;
          case 'mosaic':animate(part,[{opacity:1,transform:'scale(1) rotate(0)'},{opacity:0,transform:`translateY(${i%2?-80:80}px) scale(.2) rotate(${i%2?35:-35}deg)`}],1000,i*55);break;
          case 'polaroid':animate(part,[{transform:`rotate(${(i-1)*7}deg)`},{opacity:0,transform:`translate(${i%2?'-':'+'}115%,${i*15}px) rotate(${i%2?-30:30}deg)`}],1300,i*130);break;
          case 'bloom':animate(part,[{transform:`rotate(${i*60}deg) translateY(0)`},{transform:`rotate(${i*60}deg) translateY(-150%) scale(.6)`,opacity:0}],1600,i*45);break;
          case 'panorama':animate(part,[{transform:'translateX(0)'},{transform:`translateX(${i%2?'-':'+'}110%)`}],1250,i*100);break;
          case 'soft':animate(part,[{opacity:1},{opacity:0}],1800);break;
        }
      });
      animate(dialog.querySelector('.scene-copy'),[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],1000,450);
      animate(dialog,[{opacity:1},{opacity:0}],500,2200);if(!controlled)timer=setTimeout(close,2750);
    };
    dialog.querySelector('.seal').onclick=start;
    document.body.append(dialog);
    if(controlled){toggle.checked=true;controlled({element:dialog,start,dispose:close})}
    else{dialog.showModal();dialog.querySelector('.seal').focus()}
  }
  return {catalog,show,close:()=>current?.(),loadPhoto,photoFor,position};
})();
