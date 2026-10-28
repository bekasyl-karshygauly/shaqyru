import {CLIENT_NOTIFICATION_CONSENT,normalizeWhatsAppPhone} from './public/client-notification-model.js';
import {problem} from './order-domain.js';

export function clientNotificationPreferences(previous={},requested,contact={},ready=false){
  if(requested!==undefined&&typeof requested!=='boolean')throw problem(400,'Некорректная настройка уведомлений WhatsApp.');
  const old=previous.whatsapp,phone=normalizeWhatsAppPhone(contact.phone);
  const retained=old?.enabled===true&&old.phone===phone&&old.consentVersion===CLIENT_NOTIFICATION_CONSENT&&!!old.consentedAt;
  if(requested===undefined)return retained?{whatsapp:old}:{whatsapp:{enabled:false}};
  if(!requested)return {whatsapp:{enabled:false}};
  if(!phone)throw problem(400,'Для WhatsApp укажите номер с кодом страны, например +7 700 123 45 67.');
  if(retained)return {whatsapp:old};
  if(!ready)throw problem(503,'Автоматические уведомления WhatsApp пока не подключены. Заявку можно отправить без них.');
  return {whatsapp:{enabled:true,phone,consentedAt:new Date().toISOString(),consentVersion:CLIENT_NOTIFICATION_CONSENT}};
}
