// A contact number alone never subscribes a customer to automated messages.
export const CLIENT_NOTIFICATION_CONSENT='order-status-v1';
export function normalizeWhatsAppPhone(value){
  const input=String(value||'').trim();
  if(!/^\+?[\d\s()\-]+$/.test(input))return '';
  const digits=input.replace(/\D/g,'');
  return /^[1-9]\d{7,14}$/.test(digits)?digits:'';
}
export function clientStatusText(status,lang='ru',reason=''){
  const kz=lang==='kz',labels={
    submitted:['Заявка получена. Ожидайте рассмотрения.','Өтінім алынды. Қарастыруды күтіңіз.'],
    accepted:['Ваша заявка принята.','Өтініміңіз қабылданды.'],
    processing:['Ваше приглашение в работе.','Шақыруыңыз дайындалып жатыр.'],
    discussion:['Нужно согласовать детали заказа.','Тапсырыс мәліметтерін келісу қажет.'],
    changes:['По приглашению обрабатываются правки.','Шақыруға өзгерістер енгізіліп жатыр.'],
    ready:['Приглашение подготовлено и ожидает публикации.','Шақыру дайын, жариялануды күтуде.'],
    rejected:['Заявка отклонена.','Өтінім қабылданбады.'],
    published:['Приглашение опубликовано. Можно отправлять ссылку гостям.','Шақыру жарияланды. Сілтемені қонақтарға жіберуге болады.']
  };
  const text=labels[status]?.[kz?1:0]||(kz?'Тапсырыс күйі жаңартылды.':'Статус заказа обновлён.');
  return text+(status==='rejected'&&reason?' '+String(reason).replace(/[\r\n\t]+/g,' ').slice(0,500):'');
}
