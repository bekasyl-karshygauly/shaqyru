import {validInvitationSlug} from './invitation-links.js';
import {decorateMessengerLink} from './support-contacts.js';
import {eventInstant} from './event-tools.js';
import {orderStatus} from './order-model.js';
import {clientStatusText} from './client-notification-model.js';

export function guestDeliveryUrl(id,path,origin=location.origin){
  if(!/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(id||''))return '';
  const fallback='/i/'+id;
  try{const url=new URL(path||fallback,origin);const valid=url.pathname===fallback||validInvitationSlug(url.pathname.slice(1));return new URL(url.origin===origin&&valid?url.pathname:fallback,origin).href}catch{return new URL(fallback,origin).href}
}
export function deliveryClosed(data={}){const at=data.closeAt&&eventInstant(data.closeAt.slice(0,10),data.closeAt.slice(11,16),data.zone||'Asia/Almaty');return !!data.closed||!!(at&&at<=new Date())}

// Shared readiness and guest sharing; this never publishes or sends a message.
export function mountInvitationDelivery(host,{admin=false,openLink,onRefresh,onOrder}={}){
  host.classList.add('invitation-delivery');
  host.innerHTML='<div class="delivery-heading"><span class="delivery-badge" aria-hidden="true"></span><h2 data-delivery-heading tabindex="-1"></h2></div><p data-delivery-description></p><ol class="delivery-steps"></ol><div data-delivery-share><label></label><input data-delivery-url type="url" readonly autocomplete="off"><p class="delivery-instruction"></p><div class="delivery-actions"><button class="gh" type="button" data-delivery-copy></button><a data-delivery-whatsapp target="_blank" rel="noopener noreferrer"></a><a data-delivery-telegram target="_blank" rel="noopener noreferrer"></a></div></div><div class="delivery-owner-actions"><button class="gh" type="button" data-delivery-refresh></button><button class="gh" type="button" data-delivery-order></button></div><p data-delivery-status role="status" aria-live="polite"></p>';
  const $=selector=>host.querySelector(selector),field=$('[data-delivery-url]'),copy=$('[data-delivery-copy]'),feedback=$('[data-delivery-status]');
  field.id=host.id+'-url';$('label').htmlFor=field.id;
  const guestLink=openLink||document.createElement('a');guestLink.className='gh';guestLink.target='_blank';guestLink.rel='noopener noreferrer';guestLink.dataset.deliveryOpen='';$('.delivery-actions').append(guestLink);
  let current={},url='',copying=false,refreshing=false,lastState='';
  const t=(ru,kz)=>current.lang==='kz'?kz:ru;
  function update(next){
    current=next;url=guestDeliveryUrl(next.id,next.path);
    host.setAttribute('aria-label',admin?t('Отправка гостям','Қонақтарға жіберу'):t('Готовность приглашения','Шақырудың дайындығы'));
    const published=!!next.published&&!!url,closed=published&&deliveryClosed(next.data),phase=published?(closed?'closed':'published'):next.checking?'checking':next.order?'submitted':'draft';
    host.dataset.deliveryState=phase;host.hidden=admin&&!published;
    const changed=lastState!==phase;lastState=phase;if(changed)feedback.textContent='';
    const labels={draft:[t('Черновик приглашения','Шақыру нобайы'),t('Заполните данные и нажмите «Согласовать заказ». После публикации здесь появится ссылка для гостей.','Деректерді толтырып, «Тапсырысты келісу» түймесін басыңыз. Жарияланғаннан кейін қонақтарға сілтеме осы жерде пайда болады.')],submitted:[t('Заявка на согласовании','Өтінім келісілуде'),t('Приглашение ещё не опубликовано. Согласуйте условия с организатором; после публикации можно отправлять ссылку гостям.','Шақыру әлі жарияланбаған. Шарттарды ұйымдастырушымен келісіңіз; жарияланғаннан кейін қонақтарға сілтемені жіберуге болады.')],checking:[t('Проверяем готовность приглашения…','Шақырудың дайындығын тексеріп жатырмыз…'),t('Проверяем статус на сервере. Предпросмотр сам по себе не означает публикацию.','Сервердегі күйін тексеріп жатырмыз. Алдын ала қарау жарияланғанын білдірмейді.')],published:[t('Приглашение готово к отправке','Шақыру жіберуге дайын'),t('Опубликовано. Отправляйте гостям ссылку ниже: по ней откроются приглашение, анимация и форма ответа.','Жарияланды. Төмендегі сілтемені қонақтарға жіберіңіз: ол шақыруды, анимацияны және жауап нысанын ашады.')],closed:[t('Опубликовано · доступ закрыт','Жарияланды · қолжетімділік жабық'),t('Сначала откройте доступ гостям в настройках приглашения. Сейчас гости не смогут открыть эту ссылку.','Алдымен шақыру баптауларында қонақтарға қолжетімділікті ашыңыз. Қазір қонақтар бұл сілтемені аша алмайды.')]};
    $('[data-delivery-heading]').textContent=labels[phase][0];$('[data-delivery-description]').textContent=labels[phase][1];$('.delivery-badge').textContent=published&&!closed?'✓':phase==='checking'?'…':'•';
    if(phase==='submitted'&&next.order?.status&&next.order.status!=='submitted'){$('[data-delivery-heading]').textContent=orderStatus(next.order.status,next.lang);$('[data-delivery-description]').textContent=clientStatusText(next.order.status,next.lang,next.order.rejectionReason)}
    if(next.error){$('[data-delivery-heading]').textContent=t('Не удалось проверить готовность','Дайындығын тексеру мүмкін болмады');$('[data-delivery-description]').textContent=next.error}
    if(published&&!closed&&next.dirty){$('[data-delivery-heading]').textContent=t('Опубликовано · правки сохраняются','Жарияланды · өзгерістер сақталуда');$('[data-delivery-description]').textContent=t('Гостям доступна сохранённая версия. Дождитесь сохранения последних правок перед отправкой.','Қонақтарға сақталған нұсқа қолжетімді. Жібермес бұрын соңғы өзгерістердің сақталуын күтіңіз.')}
    const steps=$('.delivery-steps');steps.hidden=admin;steps.replaceChildren();for(const [index,label]of [t('Создать приглашение','Шақыру жасау'),t('Организатор публикует','Ұйымдастырушы жариялайды'),t('Отправить гостям','Қонақтарға жіберу')].entries()){const item=document.createElement('li');item.textContent=label;if(index===(published?2:next.order?1:0))item.setAttribute('aria-current','step');steps.append(item)}
    $('[data-delivery-share]').hidden=!published;field.value=published?url:'';$('label').textContent=t('Ссылка для гостей','Қонақтарға арналған сілтеме');
    $('.delivery-instruction').textContent=t('Скопируйте ссылку или выберите мессенджер. В открывшемся чате выберите гостей и нажмите «Отправить».','Сілтемені көшіріңіз немесе мессенджерді таңдаңыз. Ашылған чатта қонақтарды таңдап, «Жіберу» түймесін басыңыз.');
    copy.textContent=t('Скопировать ссылку','Сілтемені көшіру');copy.disabled=copying||closed;
    const message=t('Приглашаем вас на праздник','Сізді мерекеге шақырамыз')+(next.names?' — '+next.names:'');
    for(const [name,href]of [['whatsapp','https://wa.me/?text='+encodeURIComponent(message+'\n'+url)],['telegram','https://t.me/share/url?url='+encodeURIComponent(url)+'&text='+encodeURIComponent(message)]]){const link=$('[data-delivery-'+name+']');link.hidden=closed;if(published&&!closed)decorateMessengerLink(link,name,href,next.lang==='kz');else link.removeAttribute('href')}
    guestLink.hidden=!published||closed;if(published)guestLink.setAttribute('href',openLink?new URL(url).pathname:url);else guestLink.removeAttribute('href');if(!openLink)guestLink.textContent=t('Открыть как гость ↗','Қонақ ретінде ашу ↗');
    $('[data-delivery-refresh]').hidden=!onRefresh||!next.id;$('[data-delivery-refresh]').textContent=t('Проверить статус','Күйін тексеру');$('[data-delivery-refresh]').disabled=refreshing;
    $('[data-delivery-order]').hidden=!onOrder||published;$('[data-delivery-order]').textContent=next.order?t('Открыть заявку','Өтінімді ашу'):t('Согласовать заказ','Тапсырысты келісу');
    $('.delivery-owner-actions').hidden=$('[data-delivery-refresh]').hidden&&$('[data-delivery-order]').hidden;
  }
  copy.onclick=async()=>{if(copying||!url||deliveryClosed(current.data))return;copying=true;copy.disabled=true;const copied=url;try{if(!navigator.clipboard?.writeText)throw Error('clipboard unavailable');await navigator.clipboard.writeText(copied);if(url===copied)feedback.textContent=t('Ссылка скопирована. Отправьте её гостям в сообщении.','Сілтеме көшірілді. Оны қонақтарға хабарлама арқылы жіберіңіз.')}catch{if(url===copied){field.focus();field.select();feedback.textContent=t('Скопируйте выделенную ссылку и отправьте её гостям.','Белгіленген сілтемені көшіріп, қонақтарға жіберіңіз.')}}finally{copying=false;copy.disabled=deliveryClosed(current.data)}};
  $('[data-delivery-refresh]').onclick=async()=>{if(refreshing||!onRefresh)return;refreshing=true;update(current);try{await onRefresh();feedback.textContent=t('Статус обновлён.','Күйі жаңартылды.')}catch(error){feedback.textContent=error.message}finally{refreshing=false;update(current)}};
  $('[data-delivery-order]').onclick=async()=>{try{await onOrder?.()}catch(error){feedback.textContent=error.message}};
  update({});return {update};
}
