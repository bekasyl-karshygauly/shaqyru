const styleKeys=['dsg','c','font','frame','photo','cover','introPhoto','introX','introY','pl','ps','pf','anim','fx','scene','sceneSpeed','sceneDensity'];
export const styleSnapshot=s=>structuredClone(Object.fromEntries(styleKeys.map(k=>[k,s[k]])));
export function mountComparison(host,{key,state,apply}){
  const panel=document.createElement('div');panel.className='compare-tools';const heading=host.querySelector('.sec-hdr');if(heading)heading.after(panel);else host.prepend(panel);
  const dialog=document.createElement('dialog');dialog.className='compare-dialog';dialog.setAttribute('aria-labelledby','compare-title');document.body.append(dialog);
  let saved=null,loading=true,trigger=null,urls=[],pending=Promise.resolve();
  const t=(ru,kz)=>state().lang==='kz'?kz:ru;
  const db=new Promise((resolve,reject)=>{const r=indexedDB.open('shq-design-compare',1);r.onupgradeneeded=()=>r.result.createObjectStore('variants');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  const store=value=>{pending=pending.catch(()=>{}).then(async()=>{const d=await db;await new Promise((resolve,reject)=>{const tx=d.transaction('variants','readwrite');tx.objectStore('variants').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})});return pending};
  const status=document.createElement('p');status.setAttribute('role','status');
  const save=document.createElement('button'),open=document.createElement('button');save.type=open.type='button';save.className=open.className='gh';save.id='compare-save';open.id='compare-open';panel.append(save,open,status);
  function labels(){save.textContent=saved?t('Обновить вариант A','A нұсқасын жаңарту'):t('Сохранить как вариант A','A нұсқасы ретінде сақтау');open.textContent=t('Сравнить оформление','Безендіруді салыстыру');save.disabled=open.disabled=loading}
  save.onclick=async()=>{saved=styleSnapshot(state());labels();status.textContent=t('Вариант A сохранён. Измените оформление и сравните с текущим вариантом B.','A нұсқасы сақталды. Безендіруді өзгертіп, ағымдағы B нұсқасымен салыстырыңыз.');try{await store(saved)}catch{status.textContent=t('Вариант A доступен до закрытия страницы: не удалось сохранить в браузере.','A нұсқасы бет жабылғанша қолжетімді: браузерде сақтау мүмкін болмады.')}};
  function clearFrames(){for(const nonce of urls)try{sessionStorage.removeItem('shq-preview:'+nonce);sessionStorage.removeItem('shq-preview-scroll:'+nonce)}catch{}urls=[];dialog.querySelectorAll('iframe').forEach(f=>f.removeAttribute('src'))}
  dialog.addEventListener('close',()=>{clearFrames();trigger?.focus({preventScroll:true})});
  open.onclick=async()=>{
    trigger=open;if(!saved)await save.onclick();clearFrames();dialog.replaceChildren();
    const header=document.createElement('header'),h=document.createElement('h2'),close=document.createElement('button');h.id='compare-title';h.textContent=t('Какое приглашение вам ближе?','Қай шақыру сізге жақын?');close.type='button';close.className='gh';close.textContent=t('Закрыть','Жабу');close.onclick=()=>dialog.close();header.append(h,close);dialog.append(header);
    const note=document.createElement('p');note.textContent=t('A — сохранённое оформление. B — текущее. Текст и данные мероприятия одинаковы; выбор меняет только оформление.','A — сақталған безендіру. B — ағымдағы. Іс-шара мәтіні мен деректері бірдей; таңдау тек безендіруді өзгертеді.');dialog.append(note);
    const grid=document.createElement('div');grid.className='compare-grid';dialog.append(grid);
    const error=document.createElement('p');error.setAttribute('role','alert');dialog.append(error);
    const current=state(),variants=[{...current,...saved},{...current}];
    for(const [i,data] of variants.entries()){
      const section=document.createElement('section'),title=document.createElement('h3'),actions=document.createElement('div'),choose=document.createElement('button'),play=document.createElement('button'),frame=document.createElement('iframe');
      title.textContent=i?t('B · Текущее','B · Ағымдағы'):t('A · Сохранённое','A · Сақталған');actions.className='compare-actions';choose.type=play.type='button';choose.className='go';play.className='gh';choose.textContent=t('Выбрать ','Таңдау ')+(i?'B':'A');play.textContent=t('Показать открытие','Ашылуын көрсету');frame.title=title.textContent;frame.className='compare-frame';
      choose.onclick=()=>{const tier=state().paidTier;if(tier&&DG[data.dsg][2]>tier){error.textContent=t('Этот вариант выходит за согласованный уровень.','Бұл нұсқа төленген деңгейден қымбат.');return}apply(styleSnapshot(data));dialog.close()};
      play.disabled=true;frame.onload=()=>{play.disabled=false};play.onclick=()=>{frame.contentDocument?.querySelector('[data-test-intro]')?.click()};
      actions.append(choose,play);section.append(title,actions,frame);grid.append(section);
      try{const nonce=crypto.randomUUID(),{id,tok,paid,paidTier,_dirty,_serverVersion,...preview}=data;sessionStorage.setItem('shq-preview:'+nonce,JSON.stringify(preview));urls.push(nonce);frame.src='/preview?embedded=1#'+nonce}catch{error.textContent=t('Не хватает места для сравнения. Уменьшите размер фотографий и попробуйте снова.','Салыстыруға орын жеткіліксіз. Суреттер өлшемін азайтып, қайталап көріңіз.')}
    }
    dialog.showModal();close.focus();
  };
  db.then(d=>new Promise((resolve,reject)=>{const r=d.transaction('variants').objectStore('variants').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})).then(value=>{if(value)saved=styleSnapshot(normalizeState({...state(),...value}))}).catch(()=>{status.textContent=t('Сравнение будет доступно до закрытия страницы.','Салыстыру бет жабылғанша қолжетімді.')}).finally(()=>{loading=false;labels()});
  document.addEventListener('shq:changed',labels);labels();return {update:labels};
}
