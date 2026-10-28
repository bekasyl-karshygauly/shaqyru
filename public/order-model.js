export const ORDER_STATUSES={submitted:['Новая заявка','Жаңа өтінім'],accepted:['Принята','Қабылданды'],processing:['В обработке','Дайындалуда'],discussion:['Обсуждение','Талқылау'],changes:['Нужны правки','Өзгерістер қажет'],ready:['Готово к публикации','Жариялауға дайын'],rejected:['Отклонена','Қабылданбады'],published:['Опубликовано','Жарияланды']};
export const orderStatus=(status,lang='ru')=>ORDER_STATUSES[status]?.[lang==='kz'?1:0]||status;
export const money=(amount,lang='ru')=>Number.isInteger(amount)?amount.toLocaleString(lang==='kz'?'kk-KZ':'ru-RU')+' ₸':(lang==='kz'?'Келісім бойынша':'По согласованию');
export const serviceName=(service,lang='ru')=>lang==='kz'?service.name_kz:service.name_ru;
