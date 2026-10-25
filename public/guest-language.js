export const languageFields=[['text','Текст приглашения','Шақыру мәтіні',500],['names','Имена','Есімдер',80],['hosts','Организаторы','Ұйымдастырушылар',100],['place','Место','Өтетін орны',100],['addr','Адрес','Мекенжай',150],['sch','Программа дня','Күн тәртібі',1200],['greeting','Личное обращение с {name}','{name} бар жеке сәлемдесу',180],['dressCode','Дресс-код','Дресс-код',400],['giftNote','Пожелания по подаркам','Сыйлықтар туралы',500],['contactName','Контактное лицо','Байланыс тұлғасы',100]];
export function cleanTranslations(input){
  const result={ru:{},kz:{}};
  for(const lang of ['ru','kz'])for(const [key,,,max] of languageFields){const value=input?.[lang]?.[key];if(typeof value==='string')result[lang][key]=value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,max)}
  return result;
}
export function guestLanguageState(s,lang,events){
  if(!s.bilingual||!['ru','kz'].includes(lang))return {...s};
  const result={...s,lang};
  if(lang!==s.lang&&!s.te)result.text=events[s.ev][lang==='kz'?3:4];
  for(const [key,value] of Object.entries(cleanTranslations(s.translations)[lang]))if(value.trim())result[key]=value;
  return result;
}
// One navigation restores unsent RSVP fields; no owner token is copied to the URL.
export function mountGuestLanguage(host,s,j){
  if(!s.bilingual)return null;
  const nav=document.createElement('nav');nav.className='guest-languages';nav.setAttribute('aria-label','Язык приглашения / Шақыру тілі');
  const key='shq-language-form:'+location.pathname+':'+(new URL(location.href).searchParams.get('g')||location.hash);
  let resume=null;try{resume=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);if(Date.now()-resume?.at>60000)resume=null}catch{}
  for(const [lang,name] of [['ru','Русский'],['kz','Қазақша']]){
    const a=document.createElement('a');a.textContent=name;a.lang=lang==='kz'?'kk':'ru';const url=new URL(location.href);url.searchParams.set('lang',lang);a.href=url.href;a.setAttribute('aria-current',String(lang===s.lang));
    a.onclick=e=>{if(e.button!==0||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();if(lang===s.lang)return;
      const fields=[...host.querySelectorAll('.rsvp-form input,.rsvp-form textarea')].map(n=>({id:n.id,value:n.value,checked:n.checked}));
      const record={at:Date.now(),fields,count:Number(host.querySelector('.cnt-val')?.textContent)||1,sent:!!host.querySelector('.rsvp-success')};
      try{
        // An owner preview becomes a local preview, never a guest link containing credentials.
        if(j.preview&&location.pathname!=='/preview'){const nonce=crypto.randomUUID();sessionStorage.setItem('shq-preview:'+nonce,JSON.stringify(j.data));url.pathname='/preview';url.search='?lang='+lang;url.hash=nonce;sessionStorage.setItem('shq-language-form:/preview:#'+nonce,JSON.stringify(record))}
        else sessionStorage.setItem(key,JSON.stringify(record));
        location.assign(url.href);
      }catch{const error=document.createElement('p');error.setAttribute('role','alert');error.textContent=s.lang==='kz'?'Жауапты сақтау мүмкін болмады. Браузер қоймасын тексеріңіз.':'Не удалось сохранить заполненный ответ перед переключением. Проверьте доступ к хранилищу браузера.';nav.append(error)}
    };nav.append(a);
  }host.prepend(nav);return resume;
}
export function mountLanguageEditor(host,{state,onChange}){
  const panel=document.createElement('details');panel.className='language-editor';host.append(panel);let selected=state().lang==='kz'?'ru':'kz';
  function update(){
    const s=state(),k=s.lang==='kz';s.translations=cleanTranslations(s.translations);panel.replaceChildren();
    const summary=document.createElement('summary');summary.textContent=k?'Қонақтар үшін екі тіл':'Два языка для гостей';panel.append(summary);
    const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.id='guest-bilingual';check.checked=!!s.bilingual;label.append(check,document.createTextNode(k?' Қонақ тілді өзі таңдай алады':' Гость может выбирать язык'));panel.append(label);
    const content=document.createElement('div');content.hidden=!s.bilingual;panel.append(content);
    check.onchange=()=>{s.bilingual=check.checked;content.hidden=!check.checked;onChange()};
    const note=document.createElement('p');note.className='mu';note.textContent=k?'Батырмалар мен күндер автоматты түрде аударылады. Өз мәтініңіздің аудармасын енгізіңіз. Бос өріс бастапқы мәтінді сақтайды.':'Кнопки и даты переключаются автоматически. Перевод своего текста добавьте ниже. Пустое поле сохраняет исходный текст; стандартное приглашение переводится автоматически.';content.append(note);
    const l=document.createElement('label');l.htmlFor='translation-language';l.textContent=k?'Аударма тілі':'Язык перевода';const select=document.createElement('select');select.id=l.htmlFor;for(const [v,text] of [['ru','Русский'],['kz','Қазақша']]){const o=document.createElement('option');o.value=v;o.textContent=text;select.append(o)}select.value=selected;content.append(l,select);
    const fields=document.createElement('div');content.append(fields);
    function draw(){fields.replaceChildren();for(const [key,ru,kk,max] of languageFields){const l=document.createElement('label');l.textContent=k?kk:ru;l.htmlFor='translation-'+key;const input=document.createElement(max>150?'textarea':'input');input.id=l.htmlFor;input.maxLength=max;input.value=s.translations[selected][key]||'';input.placeholder=key==='text'&&!s.te?EV[s.ev][selected==='kz'?3:4]:s[key]||'';input.oninput=()=>{state().translations[selected][key]=input.value;onChange()};fields.append(l,input)}}
    select.onchange=()=>{selected=select.value;draw()};draw();
  }update();return {update};
}
