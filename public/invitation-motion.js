const opening=document.getElementById('opening');
const invitation=document.getElementById('invitation');
const motionButton=document.getElementById('motion');
const replayButton=document.getElementById('replay');
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
let timer=null,openingNow=false;
let demoState={lang:'ru',names:'Арман & Айгерім',date:'2026-12-19',anim:'doors',introPhoto:'',introX:50,introY:50};
try{const saved=JSON.parse(localStorage.getItem('shq-motion-demo')||'null');if(saved&&typeof saved==='object'){demoState.anim=['doors',...PhotoOpenings.catalog.map(a=>a.id)].includes(saved.anim)?saved.anim:'doors';demoState.introPhoto=PhotoOpenings.photoFor({introPhoto:saved.introPhoto})==='/covers/wedding.jpg'?'':PhotoOpenings.photoFor({introPhoto:saved.introPhoto});demoState.introX=PhotoOpenings.position(saved.introX??50);demoState.introY=PhotoOpenings.position(saved.introY??50)}}catch{}
function updateDemoPhoto(){
  const photo=document.querySelector('.photo');
  if(demoState.introPhoto){photo.style.backgroundImage=`url("${demoState.introPhoto}")`;photo.style.backgroundSize='cover';photo.style.backgroundPosition=`${demoState.introX}% ${demoState.introY}%`}
  else{photo.style.backgroundImage='';photo.style.backgroundSize='';photo.style.backgroundPosition=''}
}
function saveDemo(){updateDemoPhoto();try{localStorage.setItem('shq-motion-demo',JSON.stringify(demoState));document.getElementById('demo-save').textContent='Настройки макета сохранены в этом браузере.'}catch{document.getElementById('demo-save').textContent='Фото показано, но сохранить его в браузере не удалось. Выберите файл меньшего размера.'}}
mountIntroPhotoEditor(document.getElementById('intro-photo-editor'),{state:()=>demoState,onChange:saveDemo});updateDemoPhoto();
const demoChoices=[{id:'doors',icon:'🚪',name:'Створки',desc:'Плавное раскрытие в две стороны'},...PhotoOpenings.catalog];
function renderChoices(){document.getElementById('demo-scenes').innerHTML=demoChoices.map(a=>`<button type="button" data-scene="${a.id}" aria-pressed="${a.id===demoState.anim}"><span aria-hidden="true">${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></button>`).join('')}
renderChoices();document.getElementById('demo-scenes').onclick=e=>{const button=e.target.closest('[data-scene]');if(!button)return;demoState.anim=button.dataset.scene;saveDemo();renderChoices();openInvitation(true)};
function setMotion(enabled){
  document.body.dataset.motion=enabled?'on':'off';
  motionButton.setAttribute('aria-pressed',String(enabled));
  motionButton.textContent=enabled?'Эффекты: включены':'Эффекты: выключены';
}
const observer=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)entry.target.classList.add('seen');
},{threshold:.12});
document.querySelectorAll('.details,.venue').forEach(element=>observer.observe(element));
const petals=document.querySelector('.petals');
for(let i=0;i<8;i++){
  const petal=document.createElement('i');petal.className='petal';
  petal.style.setProperty('--x',`${8+i*12}%`);
  petal.style.setProperty('--duration',`${12+i%3*3}s`);
  petal.style.setProperty('--delay',`${-i*2.4}s`);petals.appendChild(petal);
}
function finishOpening(){
  clearTimeout(timer);timer=null;openingNow=false;
  opening.hidden=true;opening.classList.remove('is-opening');invitation.hidden=false;
  motionButton.hidden=false;replayButton.hidden=false;
  document.getElementById('names').focus({preventScroll:true});
  invitation.scrollIntoView({block:'start',behavior:'instant'});
}
function openInvitation(animated){
  if(openingNow)return;
  setMotion(animated);openingNow=true;
  if(demoState.anim!=='doors'){PhotoOpenings.show(demoState,{manual:true,motion:animated,done:finishOpening});return}
  document.getElementById('open').disabled=true;
  if(!animated){finishOpening();return}
  opening.scrollIntoView({block:'start',behavior:'instant'});opening.classList.add('is-opening');timer=setTimeout(finishOpening,1450);
}
// The explicit “Смотреть с анимацией” action opts into motion for this preview only.
// No autoplay or persisted override of the system preference.
document.getElementById('open').addEventListener('click',()=>openInvitation(true));
document.getElementById('open-static').addEventListener('click',()=>{setMotion(false);finishOpening()});
motionButton.addEventListener('click',()=>setMotion(document.body.dataset.motion!=='on'));
replayButton.addEventListener('click',()=>{
  clearTimeout(timer);timer=null;openingNow=false;setMotion(false);
  invitation.hidden=true;opening.hidden=false;opening.classList.remove('is-opening');
  motionButton.hidden=true;replayButton.hidden=true;
  document.querySelectorAll('.seen').forEach(element=>element.classList.remove('seen'));
  document.getElementById('open').disabled=false;window.scrollTo({top:0,behavior:'instant'});
  document.getElementById('open').focus({preventScroll:true});
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){setMotion(false);if(openingNow)finishOpening()}});
motionPreference.addEventListener('change',event=>{if(event.matches){setMotion(false);if(openingNow)finishOpening()}});
document.querySelector('.scroll-cue').addEventListener('click',event=>{
  event.preventDefault();document.getElementById('details').scrollIntoView({behavior:document.body.dataset.motion==='on'?'smooth':'instant'});
});
