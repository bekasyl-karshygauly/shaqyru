import {messengerLinks,orderMessage,orderReviewUrl,decorateMessengerLink} from './support-contacts.js';
import {mountClientOrderWorkflow} from './client-order-workflow.js';
import {orderStatus} from './order-model.js';

export function mountOrderDialog({state,save,request,onState,version,designName=()=>'',price=()=>null}){
  const dialog=document.createElement('dialog');dialog.className='order-dialog';dialog.id='order-dialog';dialog.setAttribute('aria-labelledby','order-title');
  const t=(ru,kz)=>state().lang==='kz'?kz:ru;let order=null,previous,editRevision=0,submitting=false;
  dialog.innerHTML='<header><h2 id="order-title"></h2><button class="gh" id="order-close" type="button" aria-label="Закрыть">✕</button></header><p id="order-explanation"></p><p class="order-state" id="order-state" role="status"></p><form id="order-form" novalidate><label for="order-name"></label><input id="order-name" autocomplete="name" maxlength="80" required><label for="order-phone"></label><input id="order-phone" type="tel" autocomplete="tel" maxlength="40"><label for="order-email"></label><input id="order-email" type="email" autocomplete="email" maxlength="254"><label for="order-note"></label><textarea id="order-note" maxlength="1000"></textarea><p id="order-contact-note"></p><div class="order-actions"><button class="go" id="order-submit" type="submit"></button><button class="gh" id="order-refresh" type="button"></button></div><p class="order-error" id="order-error" role="alert"></p></form>';
  const $=s=>dialog.querySelector(s);document.body.append(dialog);
  const priceLine=document.createElement('p');priceLine.id='order-price';priceLine.className='order-price';$('#order-explanation').after(priceLine);
  const messaging=document.createElement('section');messaging.id='order-messengers';messaging.className='order-messengers';
  messaging.innerHTML='<h3></h3><p></p><details><summary></summary><pre class="order-message"></pre></details><div class="support-links"><a id="order-whatsapp" target="_blank" rel="noopener noreferrer"></a><a id="order-telegram" target="_blank" rel="noopener noreferrer"></a></div>';
  dialog.append(messaging);
  const workflow=mountClientOrderWorkflow({dialog,state,getOrder:()=>order,request,version,save,price,commit:j=>{order=j.order||order;onState(j);render()}});
  $('#order-form').addEventListener('input',()=>editRevision++);
  function render(){
    $('#order-title').textContent=t('Согласовать заказ','Тапсырысты келісу');$('#order-explanation').textContent=t('Отправьте заявку организатору. Вместе вы согласуете стоимость, правки и способ оплаты. После публикации получите ссылку для гостей.','Өтінімді ұйымдастырушыға жіберіңіз. Бағасын, өзгерістерді және төлем тәсілін бірге келісесіз. Жарияланғаннан кейін қонақтарға сілтеме беріледі.');
    $('#order-state').textContent=order?.status==='published'?t('Приглашение опубликовано. Гостевая ссылка доступна в редакторе.','Шақыру жарияланды. Қонақтар сілтемесі редакторда қолжетімді.'):order?t('Заявка на согласовании. Ваш контакт передан организатору.','Өтінім келісілуде. Байланыс деректеріңіз ұйымдастырушыға жіберілді.'):t('Сначала предпросмотр, затем согласование и публикация.','Алдымен алдын ала қарау, содан кейін келісу және жариялау.');
    for(const [id,ru,kz] of [['name','Как к вам обращаться','Атыңыз'],['phone','Телефон','Телефон'],['email','Email','Email'],['note','Комментарий к заказу','Тапсырысқа пікір']])dialog.querySelector(`label[for="order-${id}"]`).textContent=t(ru,kz);
    $('#order-contact-note').textContent=t('Укажите телефон или email. Эти данные получит организатор для связи по вашему заказу.','Телефон немесе email көрсетіңіз. Ұйымдастырушы осы тапсырыс бойынша хабарласу үшін оларды алады.');
    $('#order-submit').textContent=order?t('Обновить заявку','Өтінімді жаңарту'):t('Отправить на согласование','Келісуге жіберу');$('#order-submit').hidden=order?.status==='published';$('#order-refresh').textContent=t('Проверить статус','Күйін тексеру');$('#order-close').setAttribute('aria-label',t('Закрыть','Жабу'));
    $('#order-submit').disabled=submitting||!!order?.archivedAt;
    for(const id of ['name','phone','email','note'])$('#order-'+id).readOnly=!!order?.publishedAt;
    if(order&&order.status!=='published')$('#order-state').textContent+=' · '+orderStatus(order.status,state().lang);workflow.render();
    const amount=price();priceLine.textContent=Number.isFinite(amount)?t('Стоимость выбранного дизайна: ','Таңдалған дизайн бағасы: ')+amount.toLocaleString(state().lang==='kz'?'kk-KZ':'ru-RU')+' ₸':'';
    if(order&&messaging.nextElementSibling!==$('#order-form'))$('#order-form').before(messaging);
    else if(!order&&messaging.previousElementSibling!==$('#order-form'))dialog.append(messaging);
    messaging.querySelector('h3').textContent=order?t('Обсудить заявку','Өтінімді талқылау'):t('Связаться с поддержкой','Қолдау қызметіне жазу');
    messaging.querySelector('p').textContent=order?t('Заявка сохранена в кабинете. Чтобы сообщить о ней в WhatsApp или Telegram, выберите мессенджер и нажмите «Отправить» в открывшемся чате. В сообщение войдут указанные вами контакты и комментарий.','Өтінім кабинетте сақталды. WhatsApp немесе Telegram арқылы хабарлау үшін мессенджерді таңдап, ашылған чатта «Жіберу» түймесін басыңыз. Хабарламаға байланыс деректеріңіз бен пікіріңіз қосылады.'):t('Есть вопрос? Напишите нам в удобном мессенджере. Чтобы передать данные заказа, сначала сохраните заявку.','Сұрағыңыз бар ма? Ыңғайлы мессенджерде жазыңыз. Тапсырыс деректерін жіберу үшін алдымен өтінімді сақтаңыз.');
    const text=order?orderMessage(state(),order,designName(),{reviewUrl:orderReviewUrl(state().id,location.origin),price:order.price??amount}):t('Здравствуйте! Нужна помощь с приглашением.','Сәлеметсіз бе! Шақыру жасауға көмек керек.'),links=messengerLinks(text);
    messaging.querySelector('details').hidden=!order;messaging.querySelector('summary').textContent=t('Посмотреть текст сообщения','Хабарлама мәтінін көру');messaging.querySelector('pre').textContent=text;
    for(const name of ['whatsapp','telegram'])decorateMessengerLink($('#order-'+name),name,links[name],state().lang==='kz');
  }
  async function refresh(){if(!state().id)return false;const j=await request('GET','/api/inv/'+state().id+'/status');order=j.order||null;onState(j);if(dialog.open)render();return !!j.paid}
  $('#order-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{const target=previous?.isConnected?previous:document.querySelector('#buy,#gs');target?.focus({preventScroll:true})});
  $('#order-refresh').onclick=async()=>{const b=$('#order-refresh');b.disabled=true;try{await refresh();$('#order-error').textContent=''}catch(e){$('#order-error').textContent=e.message}finally{b.disabled=false}};
  $('#order-form').onsubmit=async e=>{e.preventDefault();if(submitting)return;$('#order-error').textContent='';const contact={name:$('#order-name').value.trim(),phone:$('#order-phone').value.trim(),email:$('#order-email').value.trim()};
    if(!contact.name){$('#order-error').textContent=t('Укажите ваше имя','Атыңызды көрсетіңіз');$('#order-name').focus();return}
    if(!contact.phone&&!contact.email){$('#order-error').textContent=t('Укажите телефон или email для связи','Байланыс үшін телефон немесе email көрсетіңіз');$('#order-phone').focus();return}
    if(!$('#order-form').reportValidity())return;
    submitting=true;const b=$('#order-submit');b.disabled=true;b.textContent=t('Отправляем заявку…','Өтінім жіберілуде…');try{await save();const j=await request('POST','/api/inv/'+state().id+'/order',{version:version(),contact,note:$('#order-note').value,services:workflow.selectedServices(),serviceVersions:workflow.serviceVersions()});order=j.order;onState(j);render();$('#order-state').tabIndex=-1;$('#order-state').focus()}catch(e){$('#order-error').textContent=e.message}finally{submitting=false;b.disabled=false;render()}
  };
  return {refresh,async open(){previous=document.activeElement;$('#order-error').textContent='';render();dialog.showModal();$('#order-name').focus();const before=editRevision;if(state().id){try{await refresh();if(before===editRevision){for(const id of ['name','phone','email'])$('#order-'+id).value=order?.contact?.[id]||'';$('#order-note').value=order?.note||''}}catch(e){$('#order-error').textContent=e.message}}await workflow.open()}};
}
