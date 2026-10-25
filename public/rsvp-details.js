export function cleanRsvpDetails(value={},count=1,status='yes',questions=['children','diet','transfer']){
  if(!value||typeof value!=='object')value={};
  return {children:status==='yes'&&questions.includes('children')?Math.max(0,Math.min(count,Math.trunc(Number(value.children)||0))):0,diet:status==='yes'&&questions.includes('diet')?String(value.diet||'').trim().slice(0,200):'',transfer:status==='yes'&&questions.includes('transfer')&&value.transfer===true};
}
export function guestGreeting(s,name){return (s.greeting|| (s.lang==='kz'?'{name}, сізді шақырамыз!':'{name}, приглашаем вас!')).replaceAll('{name}',()=>String(name||''))}
export function rsvpSummary(g,kz=false){const d=g.details;if(!d||g.status!=='yes')return '';return [d.children?(kz?'Балалар: ':'Дети: ')+d.children:'',d.diet?(kz?'Тамақтану: ':'Питание: ')+d.diet:'',d.transfer?(kz?'Трансфер қажет':'Нужен трансфер'):''].filter(Boolean).join(' · ')}
export function mountRsvpQuestions(host,s,initial={},count=()=>1){
  const k=s.lang==='kz',fields={};
  for(const key of s.rsvpQuestions||[]){const label=document.createElement('label'),input=document.createElement(key==='diet'?'textarea':'input');label.htmlFor='rsvp-'+key;label.textContent=({children:k?'Балалар саны (жалпы санның ішінде)':'Сколько детей (входят в общее число)',diet:k?'Тамақтану ерекшеліктері (міндетті емес)':'Пожелания по питанию (необязательно)',transfer:k?'Трансфер қажет пе?':'Нужен трансфер?'})[key];input.id='rsvp-'+key;input.className='rsvp-input';if(key==='children'){input.type='number';input.min=0;input.max=count();input.value=initial.children||0}else if(key==='transfer'){input.type='checkbox';input.checked=!!initial.transfer;input.className='rsvp-transfer'}else{input.maxLength=200;input.rows=2;input.value=initial.diet||''}host.append(label,input);fields[key]=input}
  return {read(){if(fields.children){fields.children.max=count();if(!fields.children.reportValidity())return null}return cleanRsvpDetails({children:fields.children?.value,diet:fields.diet?.value,transfer:fields.transfer?.checked},count(),'yes',s.rsvpQuestions)},sync(){if(fields.children)fields.children.max=count()}};
}
