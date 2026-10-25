export const SUPPORT={whatsapp:'77788562088',phone:'+7 778 856 20 88',telegram:'Bekasyl'};

const icons={whatsapp:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.7 14.9L2 22l5.3-1.3A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.4-.2-3 .8.8-2.9-.3-.5A8 8 0 1 1 12 20Z"/><path fill="currentColor" d="M8.1 6.8c-.4 0-.8.3-1 .8-.6 1.4.5 3.7 2.4 5.6 1.9 1.8 4.1 2.9 5.5 2.3.7-.3 1.2-.9 1.3-1.5.1-.3-.1-.5-.4-.7l-1.7-.8c-.3-.1-.5-.1-.7.2l-.7.8c-.2.2-.3.2-.6.1a7.3 7.3 0 0 1-3.5-3.1c-.2-.3-.1-.5.1-.7l.6-.7c.1-.2.2-.4.1-.7l-.8-1.8c-.1-.3-.3-.4-.6-.4Z"/></svg>',telegram:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m21.4 3.5-3.3 16c-.2 1.1-.9 1.4-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.3L5.5 12.8.6 11.3c-1.1-.3-1.1-1.1.2-1.6L20 2.3c.9-.3 1.7.2 1.4 1.2Z"/></svg>'};

export function decorateMessengerLink(anchor,name,href,kz=false){
  const label=name==='whatsapp'?'WhatsApp':'Telegram';anchor.href=href;anchor.dataset.messenger=name;
  anchor.innerHTML=icons[name]+'<span>'+label+'</span>';
  anchor.setAttribute('aria-label',label+(kz?' — жаңа қойындыда ашылады':' — откроется в новой вкладке'));
}

export function orderReviewUrl(id,origin){
  if(!/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(id||''))return '';
  try{const base=new URL(origin);if(!['http:','https:'].includes(base.protocol)||base.username||base.password)return '';return new URL('/admin#order='+id,base.origin).href}catch{return ''}
}

export function messengerLinks(text=''){
  const query=text?'?text='+encodeURIComponent(text):'';
  return {whatsapp:'https://wa.me/'+SUPPORT.whatsapp+query,telegram:'https://t.me/'+SUPPORT.telegram+query};
}

// Select fields explicitly: editing tokens and private owner URLs never enter the message.
export function orderMessage(invitation,order,design='',{reviewUrl='',price=order.price}={}){
  const kz=invitation.lang==='kz',t=(ru,kk)=>kz?kk:ru,contact=order.contact||{};
  return [t('Здравствуйте! Хочу согласовать приглашение.','Сәлеметсіз бе! Шақыруға тапсырысты келіскім келеді.'),
    t('Заявка: ','Өтінім: ')+invitation.id,
    invitation.names&&t('Праздник: ','Мереке: ')+invitation.names,
    invitation.date&&t('Дата: ','Күні: ')+invitation.date,
    design&&t('Дизайн: ','Дизайн: ')+design,
    Number.isFinite(price)&&t('Стоимость: ','Бағасы: ')+price.toLocaleString(kz?'kk-KZ':'ru-RU')+' ₸',
    contact.name&&t('Меня зовут: ','Менің атым: ')+contact.name,
    contact.phone&&t('Телефон: ','Телефон: ')+contact.phone,
    contact.email&&'Email: '+contact.email,
    order.note&&t('Комментарий: ','Пікір: ')+order.note,
    reviewUrl&&t('Посмотреть приглашение и согласовать заказ: ','Шақыруды қарап, тапсырысты келісу: ')+reviewUrl
  ].filter(Boolean).join('\n');
}

export function mountSupportContacts(host){
  host.classList.add('support-contacts');
  host.innerHTML='<h2></h2><p></p><div class="support-links"><a data-messenger="whatsapp" target="_blank" rel="noopener noreferrer"></a><a data-messenger="telegram" target="_blank" rel="noopener noreferrer"></a></div>';
  const render=()=>{
    const kz=document.documentElement.lang==='kk',links=messengerLinks(kz?'Сәлеметсіз бе! Шақыру жасауға көмек керек.':'Здравствуйте! Нужна помощь с приглашением.');
    host.querySelector('h2').textContent=kz?'Көмек керек пе?':'Нужна помощь?';
    host.querySelector('p').textContent=kz?'Шақыру немесе тапсырыс туралы сұрағыңызды жазыңыз.':'Напишите по вопросам приглашения или заказа.';
    for(const name of ['whatsapp','telegram'])decorateMessengerLink(host.querySelector(`[data-messenger="${name}"]`),name,links[name],kz);
  };
  render();new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
}

if(typeof document!=='undefined')document.querySelectorAll('[data-support-contacts]').forEach(mountSupportContacts);
