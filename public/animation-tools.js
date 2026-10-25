const storageKey='shq-favorite-animations';

export function mountAnimationTools(host,{catalog,state,translations={},onFilter,onChoose,onPreview}){
  const valid=new Set(catalog.map(a=>a.id));let favorites=new Set();
  try{const saved=JSON.parse(localStorage.getItem(storageKey));if(Array.isArray(saved))favorites=new Set(saved.filter(id=>valid.has(id)))}catch{}
  const t=(ru,kz)=>state().lang==='kz'?kz:ru;
  const title=a=>state().lang==='kz'?(a.kz||translations[a.name]||a.name):a.name;
  const description=a=>state().lang==='kz'?(a.descKz||translations[a.desc]||a.desc):a.desc;
  const normalize=text=>String(text||'').toLocaleLowerCase().replaceAll('ё','е').trim();
  host.classList.add('animation-tools');
  host.innerHTML='<label for="animation-search" class="animation-search-label"></label><input type="search" id="animation-search" maxlength="100"><div class="animation-tools-actions"><button type="button" class="gh animation-favorite-current"></button><label class="animation-only-label"><input type="checkbox" id="animation-only-favorites"><span></span></label></div><p class="animation-tools-status" role="status"></p><details class="animation-shortlist"><summary></summary><p class="animation-shortlist-hint"></p><div class="animation-saved-list"></div></details>';
  const find=s=>host.querySelector(s),search=find('#animation-search'),only=find('#animation-only-favorites'),toggle=find('.animation-favorite-current'),status=find('.animation-tools-status'),list=find('.animation-saved-list');
  const matches=a=>(!only.checked||favorites.has(a.id))&&normalize([a.name,a.kz,a.desc,a.descKz,translations[a.name],translations[a.desc]].join(' ')).includes(normalize(search.value));
  function save(){try{localStorage.setItem(storageKey,JSON.stringify([...favorites]));status.textContent=''}catch{status.textContent=t('Избранное доступно до закрытия страницы: браузер не разрешил сохранить список.','Таңдаулылар бет жабылғанша қолжетімді: браузер тізімді сақтауға рұқсат бермеді.')}}
  function update(){
    find('.animation-search-label').textContent=t('Найти анимацию','Анимацияны табу');search.placeholder=t('Например: цветы, конверт, кино','Мысалы: гүлдер, конверт, кино');
    find('.animation-only-label span').textContent=t('Только избранное','Тек таңдаулылар');
    const selected=catalog.find(a=>a.id===state().anim)||catalog[0],saved=favorites.has(selected.id);
    toggle.textContent=(saved?'★ ':'☆ ')+t('В избранном: ','Таңдаулы: ')+title(selected);
    if(!saved)toggle.textContent='☆ '+t('В избранное: ','Таңдаулыға: ')+title(selected);
    toggle.setAttribute('aria-pressed',String(saved));
    find('summary').textContent=t('Мои избранные анимации','Менің таңдаулы анимацияларым')+' · '+favorites.size;
    find('.animation-shortlist-hint').textContent=t('Просматривайте со своим фото. Приглашение изменится только после нажатия «Выбрать». Список хранится в этом браузере.','Өз фотоңызбен көріңіз. Шақыру «Таңдау» басылғанда ғана өзгереді. Тізім осы браузерде сақталады.');
    list.replaceChildren();
    if(!favorites.size){const empty=document.createElement('p');empty.className='animation-empty';empty.textContent=t('Пока пусто. Выберите понравившуюся анимацию и добавьте её в избранное кнопкой со звездой.','Әзірге бос. Ұнаған анимацияны таңдап, жұлдызшалы батырмамен таңдаулыға қосыңыз.');list.append(empty)}
    for(const id of favorites){
      const a=catalog.find(a=>a.id===id),row=document.createElement('article');row.className='animation-saved';row.dataset.savedAnimation=id;
      const heading=document.createElement('h4');heading.textContent=a.icon+' '+title(a);
      const desc=document.createElement('p');desc.textContent=description(a);
      const actions=document.createElement('div');actions.className='animation-saved-actions';
      for(const [action,label]of [['preview',t('Смотреть','Көру')],['choose',state().anim===id?t('Выбрано','Таңдалған'):t('Выбрать','Таңдау')],['remove',t('Убрать','Алып тастау')]]){
        const button=document.createElement('button');button.type='button';button.className='gh';button.dataset.action=action;button.textContent=label;button.setAttribute('aria-label',label+': '+title(a));if(action==='choose')button.setAttribute('aria-pressed',String(state().anim===id));
        button.onclick=()=>{
          if(action==='preview'){onPreview(id);return}
          if(action==='choose'){onChoose(id);list.querySelector(`[data-saved-animation="${id}"] [data-action="choose"]`)?.focus({preventScroll:true});return}
          const next=row.nextElementSibling?.dataset.savedAnimation||row.previousElementSibling?.dataset.savedAnimation;
          favorites.delete(id);save();onFilter();
          (next?list.querySelector(`[data-saved-animation="${next}"] [data-action="remove"]`):find('summary'))?.focus({preventScroll:true});
        };actions.append(button);
      }
      row.append(heading,desc,actions);list.append(row);
    }
  }
  search.oninput=onFilter;only.onchange=onFilter;
  toggle.onclick=()=>{const id=state().anim||catalog[0].id;if(favorites.has(id))favorites.delete(id);else favorites.add(id);save();onFilter()};
  update();return {matches,update};
}
