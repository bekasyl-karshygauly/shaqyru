import {showOrderPreview,clearOrderPreview} from "/order-components.js";
import {mountAdminWorkflow} from "/admin-workflow.js";
import {orderStatus} from "/order-model.js";
import {mountInvitationDelivery,deliveryClosed} from './invitation-delivery.js';
const $=s=>document.querySelector(s),status=$('#admin-status');let key='',offset=0,nextOffset=null,current=null,trigger=null,requestId=0,detailGeneration=0,busy=null;
const linkedId=new URLSearchParams(location.hash.slice(1)).get('order');let pendingOrder=/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(linkedId||'')?linkedId:null;
const deliveryPanel=mountInvitationDelivery($('#admin-delivery-panel'),{admin:true,openLink:$('#admin-guest-link')});
function renderPreview(){showOrderPreview($('#admin-preview'),current.data,{published:!!current.order.publishedAt&&current.order.status==='published'})}
async function api(path,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(path,{...options,headers:{'Content-Type':'application/json','x-admin-key':key},cache:'no-store',signal:controller.signal});
    let j;try{j=JSON.parse(await r.text())}catch{throw Object.assign(new Error('Сервер вернул некорректный ответ. Обновите заявку и проверьте её статус перед повторной публикацией.'),{status:r.status})}
    if(!r.ok)throw Object.assign(new Error(j?.error||'Не удалось выполнить действие. Обновите заявку и повторите.'),{status:r.status,conflict:j?.conflict});return j;
  }catch(error){if(error.status!==undefined)throw error;throw new Error(controller.signal.aborted?'Сервер не ответил за 20 секунд. Обновите заявку и проверьте её статус.':'Не удалось связаться с сервером. Проверьте подключение и обновите заявку.')}
  finally{clearTimeout(timer)}
}
function sameDetail(active,generation){return current?.id===active.id&&detailGeneration===generation&&$('#admin-detail').open}
function validOrder(order){return !!order&&typeof order==='object'&&!Array.isArray(order)&&['services','revisions','history'].every(field=>order[field]==null||Array.isArray(order[field]))}
function checkedDetail(result,id){if(!result||result.id!==id||!result.data||typeof result.data!=='object'||Array.isArray(result.data)||!validOrder(result.order)||typeof result.version!=='string')throw new Error('Не удалось загрузить корректные данные заявки. Обновите заявку ещё раз.');return result}
function detailFeedback(message,{error=false,focus=false,reveal=false}={}){const feedback=$('#admin-detail-status');feedback.textContent=message;feedback.classList.toggle('order-error',error);if(focus)feedback.focus({preventScroll:true});if(focus||reveal)feedback.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'})}
function syncBusy(){const active=busy?.generation===detailGeneration,publishing=active&&busy.kind==='publish',button=$('#admin-publish');if(publishing&&!button.hasAttribute('data-busy-width')){button.style.width=button.offsetWidth+'px';button.setAttribute('data-busy-width','')}else if(!publishing){button.style.width='';button.removeAttribute('data-busy-width')}button.disabled=!!active;button.textContent=publishing?'Публикуем…':'Опубликовать приглашение';button.setAttribute('aria-busy',String(!!publishing));$('#admin-detail-refresh').disabled=!!active}
function publicationHint(order){
  if(order.publishedAt)return 'Приглашение опубликовано. Ссылка и способы отправки гостям показаны ниже.';
  if(order.archivedAt)return 'Заказ в архиве. Сначала восстановите его в блоке «Работа с заказом».';
  if(order.revisions?.some(revision=>!revision.doneAt))return 'Перед публикацией отметьте выполненными все правки клиента в блоке «Работа с заказом».';
  if(order.needsAgreement)return 'Условия заказа изменились. Предложите итоговую стоимость и дождитесь нового подтверждения клиента.';
  if(!order.quote&&order.services?.some(service=>service.price===null))return 'Для услуг «По согласованию» предложите итоговую стоимость и дождитесь подтверждения клиента.';
  if(order.quote&&!order.approval?.current)return 'Клиенту нужно подтвердить предложенную стоимость и текущий вариант приглашения. После подтверждения обновите заявку.';
  return 'После публикации гости смогут открыть приглашение по ссылке и отправить ответ.';
}
const text=(tag,value,cls)=>{const e=document.createElement(tag);e.textContent=value;if(cls)e.className=cls;return e};
function badge(order){return orderStatus(order?.status||'submitted')+(order?.archivedAt?' · Архив':'')}
async function load(){const id=++requestId;$('#admin-refresh').disabled=true;status.textContent='Загружаем заявки…';try{
  const filter=$('#order-filter').value,j=await api(`/api/admin/list?status=${filter}&offset=${offset}&archived=${$('#admin-archived').checked}`);if(id!==requestId)return;
  $('#ls').replaceChildren();for(const item of j.items){const row=text('article','','order-item'),info=document.createElement('div');info.append(text('h2',item.names||'Приглашение без имён'),text('span',badge(item.order),'order-badge '+(item.order.status==='published'?'published':'')),text('p',item.order.contact.name+' · '+(item.order.contact.phone||item.order.contact.email)),text('p','Отправлено '+new Date(item.order.submittedAt).toLocaleString('ru-RU')));const open=text('button','Открыть заявку','gh');open.type='button';open.onclick=()=>openOrder(item.id,open);row.append(info,open);$('#ls').append(row)}
  if(!j.items.length)$('#ls').append(text('p',offset?'На этой странице нет заявок. Вернитесь назад.':'Заявок пока нет. Они появятся после нажатия клиентом «Согласовать заказ».'));
  nextOffset=j.nextOffset;$('#admin-prev').disabled=offset===0;$('#admin-next').disabled=nextOffset===null;$('#admin-range').textContent=j.items.length?`${offset+1}–${offset+j.items.length}`:'0 заявок';$('#admin-orders').hidden=false;status.textContent='Список обновлён';void workflow.refreshStats();
}catch(e){if(id===requestId)status.textContent=e.message}finally{if(id===requestId)$('#admin-refresh').disabled=false}}
async function openOrder(id,button){const generation=++detailGeneration;busy=null;if(button)button.disabled=true;trigger=button||$('#admin-refresh');try{const result=checkedDetail(await api('/api/admin/orders/'+id),id);if(generation!==detailGeneration)return;current=result;renderDetail();renderPreview();detailFeedback('');history.replaceState(null,'','#order='+id);if(!$('#admin-detail').open)$('#admin-detail').showModal();$('#admin-close').focus()}catch(e){if(generation===detailGeneration)status.textContent=e.message}finally{if(button)button.disabled=false}}
function renderDetail(){const o=current.order,contact=o.contact||{};$('#admin-detail-title').textContent=current.data.names||'Заявка';$('#admin-detail-state').textContent=badge(o)+(Number.isFinite(o.price)?' · '+o.price.toLocaleString('ru-RU')+' ₸':'');$('#admin-contact').textContent=`Клиент: ${contact.name||'не указано'}\nТелефон: ${contact.phone||'не указан'}\nEmail: ${contact.email||'не указан'}`;$('#admin-note').textContent=o.note?'Комментарий: '+o.note:'Без комментария';$('#admin-publish').hidden=o.status==='published';$('#admin-guest-link').hidden=o.status!=='published';$('#admin-guest-link').href=current.guestPath||'/i/'+current.id;
  const labels={pending:'Ожидает подключения или отправки',processing:'Отправляется',retry:'Повторная попытка запланирована',sent:'Принято сервисом',failed:'Не удалось отправить'},seen=new Set();$('#admin-delivery').replaceChildren();
  for(const n of current.notifications||[]){const kind=n.kind||'order',group=kind+':'+n.channel;if(seen.has(group))continue;seen.add(group);$('#admin-delivery').append(text('p',(kind==='rsvp'?'Ответы гостей · ':'Заявка · ')+(n.channel==='telegram'?'Telegram':'WhatsApp')+': '+(labels[n.status]||n.status)))}
  $('#admin-retry-alerts').hidden=!(current.notifications||[]).some(n=>n.status==='failed');$('#admin-publication-hint').textContent=publicationHint(o);deliveryPanel.update({published:o.status==='published'&&!!o.publishedAt,id:current.id,path:current.guestPath,names:current.data.names,data:current.data,lang:'ru'});workflow.render(current);syncBusy();
}
async function loadNotificationSettings(){try{const c=await api('/api/admin/notifications');if(!key)return;$('#admin-notifications-status').textContent=['Telegram: '+(c.telegram?.configured?'настройки сохранены, проверьте отправку':'нужны бот и ID чата'),'WhatsApp: '+(c.whatsapp?.configured?'настроен':'нужно подключить WhatsApp Business'),!c.publicUrl?'Автоматическая отправка ожидает публичного HTTPS-адреса сайта. Тест Telegram доступен после подключения бота.':'',!c.queueReady?'Очередь уведомлений недоступна. Проверьте миграцию базы.':'',c.lastError||''].filter(Boolean).join('\n');$('#admin-telegram-test').disabled=!c.telegram?.configured;const link=$('#admin-telegram-bot');link.hidden=!c.telegram?.username;if(c.telegram?.username)link.href='https://t.me/'+c.telegram.username}catch(e){$('#admin-notifications-status').textContent=e.message}}
$('#admin-telegram-test').onclick=async()=>{const button=$('#admin-telegram-test'),feedback=$('#admin-telegram-test-status');button.disabled=true;button.setAttribute('aria-busy','true');feedback.textContent='Отправляем проверочное сообщение…';try{const j=await api('/api/admin/notifications/telegram/test',{method:'POST',body:'{}'});if(key){feedback.textContent='Telegram принял тестовое сообщение. Проверьте личный чат с ботом.';if(/^[A-Za-z0-9_]{5,32}$/.test(j.username||'')){const link=$('#admin-telegram-bot');link.href='https://t.me/'+j.username;link.hidden=false}}}catch(e){if(key)feedback.textContent=e.message}finally{button.disabled=!key;button.removeAttribute('aria-busy')}};
$('#admin-login').onsubmit=async e=>{e.preventDefault();key=$('#k').value;$('#ld').disabled=true;await load();$('#ld').disabled=false;if(!$('#admin-orders').hidden){$('#admin-login').hidden=true;$('#k').value='';void loadNotificationSettings();if(pendingOrder){const id=pendingOrder;pendingOrder=null;await openOrder(id)}}};
$('#admin-refresh').onclick=load;$('#order-filter').onchange=()=>{offset=0;load()};$('#admin-archived').onchange=()=>{offset=0;load()};$('#admin-prev').onclick=()=>{offset=Math.max(0,offset-20);load()};$('#admin-next').onclick=()=>{if(nextOffset!==null){offset=nextOffset;load()}};
$('#admin-lock').onclick=()=>{key='';requestId++;workflow.lock();$('#admin-orders').hidden=true;$('#admin-login').hidden=false;$('#ls').replaceChildren();$('#admin-telegram-test').disabled=true;$('#admin-telegram-test-status').textContent='';status.textContent='Кабинет закрыт';$('#k').focus()};
$('#admin-close').onclick=()=>$('#admin-detail').close();$('#admin-detail').addEventListener('close',()=>{detailGeneration++;busy=null;current=null;workflow.closed();clearOrderPreview($('#admin-preview'));history.replaceState(null,'',location.pathname+location.search);(trigger?.isConnected?trigger:$('#admin-refresh'))?.focus({preventScroll:true})});
$('#admin-retry-alerts').onclick=async()=>{const active=current,button=$('#admin-retry-alerts');if(!active)return;button.disabled=true;try{await api('/api/admin/orders/'+active.id+'/notifications/retry',{method:'POST',body:'{}'});if(current?.id===active.id){$('#admin-detail-status').textContent='Повторная отправка поставлена в очередь. При неподключённом мессенджере сообщение будет ожидать подключения.';button.hidden=true}}catch(e){if(current?.id===active.id)$('#admin-detail-status').textContent=e.message}finally{button.disabled=false}};
$('#admin-play').onclick=()=>$('#admin-preview').contentDocument?.querySelector('[data-test-intro]')?.click();
$('#admin-publish').onclick=async()=>{
  if(busy||!current)return;
  const active=current,generation=detailGeneration,operation={generation,kind:'publish'};busy=operation;syncBusy();detailFeedback('Публикуем приглашение…',{reveal:true});
  try{
    const j=await api('/api/admin/orders/'+active.id+'/publish',{method:'POST',body:JSON.stringify({version:active.version})});
    if(j?.published!==true||!validOrder(j.order)||j.order.status!=='published'||!j.order.publishedAt||typeof j.version!=='string')throw new Error('Сервер не подтвердил публикацию. Обновите заявку и проверьте её статус.');
    if(!sameDetail(active,generation)){status.textContent='Приглашение опубликовано. Обновите список заявок.';void load();return}
    current={...current,order:j.order,version:j.version,guestPath:j.guestPath||current.guestPath};renderDetail();renderPreview();detailFeedback(deliveryClosed(current.data)?'Приглашение опубликовано. Доступ для гостей пока закрыт.':'Приглашение опубликовано. Гостевая ссылка готова.',{reveal:true});if(!$('#admin-guest-link').hidden)$('#admin-guest-link').focus();void load();
  }catch(error){if(sameDetail(active,generation))detailFeedback(error.conflict?'Клиент изменил приглашение. Нажмите «Обновить заявку», проверьте актуальный вариант и повторите публикацию.':error.message,{error:true,focus:true})}
  finally{if(busy===operation){busy=null;syncBusy()}}
};
$('#admin-detail-refresh').onclick=async()=>{
  if(busy||!current)return;
  const active=current,generation=detailGeneration,operation={generation,kind:'refresh'};busy=operation;syncBusy();detailFeedback('Обновляем заявку…');
  try{const result=checkedDetail(await api('/api/admin/orders/'+active.id),active.id);if(!sameDetail(active,generation))return;current=result;renderDetail();renderPreview();detailFeedback('Заявка обновлена. Проверьте текущий вариант и условия публикации.');}
  catch(error){if(sameDetail(active,generation))detailFeedback(error.message,{error:true,focus:true})}
  finally{if(busy===operation){busy=null;syncBusy()}}
};
setInterval(()=>{if(key&&!document.hidden&&!$('#admin-detail').open)load()},30000);

async function updateWorkflow(path,body){if(busy||!current)return;const active=current,generation=detailGeneration,operation={generation,kind:'workflow'};busy=operation;syncBusy();try{const j=await api('/api/admin/orders/'+active.id+'/'+path,{method:'POST',body:JSON.stringify({...body,version:active.version})});if(sameDetail(active,generation)){current={...current,order:j.order,version:j.version};renderDetail()}void load();return sameDetail(active,generation)?j:undefined}finally{if(busy===operation){busy=null;syncBusy()}}}
const workflow=mountAdminWorkflow({api,getCurrent:()=>current,change:updateWorkflow});
