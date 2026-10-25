import {orderStatus,money} from './order-model.js';
export const element=(tag,text='',className='')=>{const e=document.createElement(tag);e.textContent=text;if(className)e.className=className;return e};
export function clearOrderPreview(frame){const key=frame.dataset.orderPreviewKey;if(key)window.__shqOrderPreviews?.delete(key);delete frame.dataset.orderPreviewKey;frame.src='about:blank'}
export function showOrderPreview(frame,data){clearOrderPreview(frame);const nonce=crypto.randomUUID();window.__shqOrderPreviews??=new Map();window.__shqOrderPreviews.set(nonce,data);frame.dataset.orderPreviewKey=nonce;frame.src='/preview?embedded=1#'+nonce;frame.hidden=false}
export function renderOrderHistory(host,events,lang='ru'){
  const kz=lang==='kz',actions={submitted:['Заявка отправлена','Өтінім жіберілді'],resubmitted:['Заявка обновлена','Өтінім жаңартылды'],status:['Изменён статус','Күй өзгерді'],quote:['Предложена стоимость','Баға ұсынылды'],accepted:['Клиент подтвердил цену и вариант','Клиент баға мен нұсқаны растады'],revision:['Добавлена правка','Өзгеріс қосылды'],revisionDone:['Изменено выполнение правки','Өзгерістің орындалуы жаңартылды'],published:['Приглашение опубликовано','Шақыру жарияланды'],archived:['Заказ в архиве','Тапсырыс мұрағатта'],restored:['Заказ восстановлен','Тапсырыс қалпына келтірілді'],rsvpAlerts:['Уведомления об ответах гостей','Қонақ жауаптары туралы хабарламалар']};
  host.replaceChildren();if(!events?.length){host.append(element('li',kz?'Тарих әзірге бос.':'История пока пуста.'));return}
  for(const event of [...events].reverse()){
    const row=element('li'),date=new Date(event.at).toLocaleString(kz?'kk-KZ':'ru-RU');
    row.append(element('strong',(actions[event.action]?.[kz?1:0]||event.action)+(event.amount!==undefined?' · '+money(event.amount,lang):'')),element('small',date+' · '+(event.actor==='admin'?(kz?'Ұйымдастырушы':'Организатор'):(kz?'Клиент':'Клиент'))));
    if(event.status)row.append(element('span',orderStatus(event.status,lang)));if(event.text||event.note)row.append(element('p',event.text||event.note));host.append(row);
    if(typeof event.done==='boolean')row.append(element('span',event.done?(kz?'Орындалды':'Выполнено'):(kz?'Қайта орындауға жіберілді':'Возвращено в работу')));
    if(typeof event.enabled==='boolean')row.append(element('span',event.enabled?(kz?'Қосылды':'Включено'):(kz?'Өшірілді':'Выключено')));
  }
}
