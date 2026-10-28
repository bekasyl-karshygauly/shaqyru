import {normalizeWhatsAppPhone,clientStatusText} from './public/client-notification-model.js';
import {validInvitationSlug} from './public/invitation-links.js';
import {isClosed} from './invitation-access.js';

const invitationId=/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/;
const statuses=new Set(['submitted','accepted','processing','discussion','changes','ready','rejected','published']);
const MAX_AGE=7*24*3600000;
const safeText=value=>String(value??'').replace(/[\r\n\t]+/g,' ').slice(0,500);

function publicOrigin(value){
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!/^(localhost\.?|127\..*|0\.0\.0\.0|\[::1\])$/i.test(url.hostname)?url.origin:null}catch{return null}
}

export function clientNotificationConfig(env={}){
  const enabled=env.WHATSAPP_CLIENT_NOTIFICATIONS_ENABLED==='1';
  const credentials=!!(env.WHATSAPP_ACCESS_TOKEN&&/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||'')&&/^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION||''));
  const template=/^[a-z0-9_]{1,512}$/.test(env.WHATSAPP_CLIENT_STATUS_TEMPLATE||'')&&/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(env.WHATSAPP_CLIENT_TEMPLATE_LANGUAGE||'');
  return {enabled,configured:enabled&&credentials&&template,publicUrl:!!publicOrigin(env.PUBLIC_URL)};
}

// A separate outbox keeps customer recipients isolated from organizer alerts.
// Provider acceptance is not proof of delivery; retries have at-least-once semantics.
export function createClientNotifications({env={},sb,inv,links,fetchImpl=fetch}){
  const config=clientNotificationConfig(env),origin=publicOrigin(env.PUBLIC_URL),active=config.configured&&config.publicUrl;
  let running=false,timer=null,lastError=null;
  const kz=/^kk(?:_|$)/.test(env.WHATSAPP_CLIENT_TEMPLATE_LANGUAGE||'');

  async function guestUrl(id){
    const fallback='/i/'+id;let path=fallback;
    try{path=await links?.path(id)||fallback}catch{}
    try{const url=new URL(path,origin),valid=url.pathname===fallback||validInvitationSlug(url.pathname.slice(1));return new URL(url.origin===origin&&valid?url.pathname:fallback,origin).href}catch{return new URL(fallback,origin).href}
  }

  async function deliver(job){
    if(job.channel!=='whatsapp'||!invitationId.test(job.inv||'')||!statuses.has(job.order_status))return {skip:'INVALID_EVENT'};
    const created=Date.parse(job.created_at);
    if(!Number.isFinite(created)||created<Date.now()-MAX_AGE)return {skip:'EVENT_EXPIRED'};
    const i=await inv(job.inv),order=i?.data?._order;
    if(!order)return {skip:'ORDER_MISSING'};
    const consent=order.notifications?.whatsapp,phone=normalizeWhatsAppPhone(consent?.phone);
    if(consent?.enabled!==true||consent.consentVersion!=='order-status-v1')return {skip:'CONSENT_REVOKED'};
    if(!phone||phone!==job.recipient||normalizeWhatsAppPhone(job.recipient)!==job.recipient)return {skip:'RECIPIENT_CHANGED'};
    const consentAt=Date.parse(consent.consentedAt),jobConsentAt=Date.parse(job.consented_at);
    if(!Number.isFinite(consentAt)||!Number.isFinite(jobConsentAt)||consentAt!==jobConsentAt)return {skip:'CONSENT_CHANGED'};
    if(order.status!==job.order_status)return {skip:'STATUS_SUPERSEDED'};
    if(order.status==='published'&&!order.publishedAt)return {skip:'PUBLICATION_MISSING'};
    const closedPublication=order.status==='published'&&isClosed(i);
    let detail=kz?'Нақтылау қажет болса, осы хабарламаға жауап беріңіз.':'Если нужны уточнения, ответьте на это сообщение.';
    if(order.status==='published')detail=closedPublication?(kz?'Қонақтарға қолжетімділік жабық. Ұйымдастырушымен хабарласыңыз.':'Доступ гостям закрыт. Свяжитесь с организатором.'):(kz?'Қонақтарға арналған сілтеме: ':'Гостевая ссылка: ')+await guestUrl(i.id);
    const statusText=closedPublication?(kz?'Шақыру жарияланды.':'Приглашение опубликовано.'):clientStatusText(order.status,kz?'kz':'ru',order.rejectionReason);
    const fields=[i.id,i.data.names||(kz?'Шақыру':'Приглашение'),statusText,detail];
    const body={messaging_product:'whatsapp',to:phone,type:'template',template:{name:env.WHATSAPP_CLIENT_STATUS_TEMPLATE,language:{code:env.WHATSAPP_CLIENT_TEMPLATE_LANGUAGE},components:[{type:'body',parameters:fields.map(value=>({type:'text',text:safeText(value)}))}]}};
    let response,json;
    try{response=await fetchImpl('https://graph.facebook.com/'+env.WHATSAPP_API_VERSION+'/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})}catch{throw Object.assign(new Error('NETWORK_OR_TIMEOUT'),{retry:true})}
    try{json=await response.json()}catch{throw Object.assign(new Error('INVALID_PROVIDER_RESPONSE'),{retry:true})}
    if(!response.ok||json.error){
      const retryAfter=Number(response.headers?.get?.('retry-after')||json.parameters?.retry_after)||0;
      throw Object.assign(new Error('PROVIDER_'+(Number(json.error?.code)||response.status)),{retry:response.status===429||response.status>=500||json.error?.is_transient===true,retryAfter:Math.max(0,Math.min(86400,retryAfter))});
    }
    const providerId=json.messages?.[0]?.id;
    if(typeof providerId!=='string'||!providerId||providerId.length>512)throw Object.assign(new Error('MISSING_PROVIDER_ID'),{retry:true});
    return {providerId};
  }

  async function runOnce(){
    if(!active||running)return;running=true;
    try{
      const jobs=await sb('/rpc/shq_claim_client_notifications',{method:'POST',body:{p_limit:4}});
      if(!Array.isArray(jobs))throw Error('INVALID_QUEUE_RESPONSE');
      for(const job of jobs){
        let update;
        try{const result=await deliver(job);update=result.skip?{status:'skipped',last_error:result.skip}:{status:'sent',provider_id:result.providerId,sent_at:new Date().toISOString(),last_error:null}}
        catch(error){const retry=error.retry!==false&&Number(job.attempts)<6;update={status:retry?'retry':'failed',last_error:/^[A-Z_0-9]+$/.test(error.message)?error.message:'SEND_FAILED',available_at:new Date(Date.now()+Math.max(error.retryAfter||0,Math.min(3600,30*2**Number(job.attempts||1)))*1000).toISOString()}}
        await sb('/shq_client_notifications?id=eq.'+encodeURIComponent(job.id)+'&lease=eq.'+encodeURIComponent(job.lease)+'&status=eq.processing',{method:'PATCH',body:{...update,locked_until:null,lease:null}});
      }
      lastError=null;
    }catch{lastError='Не удалось обработать уведомления клиентам. Проверьте очередь и настройки сервера.'}finally{running=false}
  }

  const kick=()=>{if(active)void runOnce()};
  return {
    config,runOnce,kick,
    start(){if(active&&!timer){timer=setInterval(kick,20000);timer.unref();kick()}},
    stop(){clearInterval(timer);timer=null},
    async status(){let queueReady=false;try{await sb('/shq_client_notifications?select=id&limit=0');queueReady=true}catch{}return {...config,queueReady,lastError}},
    async forOrder(id){if(!invitationId.test(id||''))return [];try{return await sb('/shq_client_notifications?inv=eq.'+id+'&select=id,channel,order_status,status,attempts,last_error,created_at,sent_at&order=created_at.desc&limit=12')}catch{return []}},
    async retry(id){if(!invitationId.test(id||''))return;await sb('/shq_client_notifications?inv=eq.'+id+'&status=eq.failed',{method:'PATCH',body:{status:'pending',attempts:0,last_error:null,available_at:new Date().toISOString()}});kick()}
  };
}
