import {orderMessage,orderReviewUrl,SUPPORT} from './public/support-contacts.js';
import {PRICE,TIER} from './validate.js';
import {telegramRequest,telegramErrorMessage} from './telegram-bot.js';

export function notificationConfig(env){
  let publicUrl=false;
  try{const u=new URL(env.PUBLIC_URL);publicUrl=u.protocol==='https:'&&!u.username&&!u.password&&!/^(localhost|127\.|\[::1\])/.test(u.hostname)}catch{}
  return {publicUrl,telegram:{configured:!!(env.TELEGRAM_BOT_TOKEN&&/^-?\d+$/.test(env.TELEGRAM_CHAT_ID||'')),tokenPresent:!!env.TELEGRAM_BOT_TOKEN,chatPresent:/^-?\d+$/.test(env.TELEGRAM_CHAT_ID||''),username:/^[A-Za-z0-9_]{5,32}$/.test(env.TELEGRAM_BOT_USERNAME||'')?env.TELEGRAM_BOT_USERNAME:null},whatsapp:{configured:!!(env.WHATSAPP_ACCESS_TOKEN&&/^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID||'')&&/^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION||'')&&env.WHATSAPP_ORDER_TEMPLATE&&env.WHATSAPP_TEMPLATE_LANGUAGE)}};
}

export function createOrderNotifications({env,sb,inv,fetchImpl=fetch}){
  let running=false,timer=null,lastError=null;
  const config=notificationConfig(env),channels=['telegram','whatsapp'].filter(c=>config.publicUrl&&config[c].configured);
  async function post(url,body,headers={}){
    let response;
    try{response=await fetchImpl(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})}
    catch{throw Object.assign(new Error('NETWORK_OR_TIMEOUT'),{retry:true})}
    let json;try{json=await response.json()}catch{throw Object.assign(new Error('INVALID_PROVIDER_RESPONSE'),{retry:true})}
    if(!response.ok||json.ok===false||json.error){const status=response.status;throw Object.assign(new Error('PROVIDER_'+(Number(json.error_code||json.error?.code)||status)),{retry:status===429||status>=500,retryAfter:Number(json.parameters?.retry_after)||0})}
    return json;
  }
  async function deliver(job){
    const i=await inv(job.inv);if(!i?.data._order)throw Object.assign(new Error('ORDER_MISSING'),{retry:false});
    const order=i.data._order,price=order.price??PRICE[TIER[i.data.dsg]],reviewUrl=orderReviewUrl(i.id,env.PUBLIC_URL),guest=job.kind==='rsvp'?job.payload:null;
    const guestStatus=guest?(guest.status==='yes'?'Придёт · '+guest.cnt+' чел.':'Не придёт'):'';
    if(job.channel==='telegram'){
      const text=guest?`Шақыру · Ответ гостя\n${i.data.names||'Приглашение'}\n${guest.name}: ${guestStatus}\n${reviewUrl}`:'Шақыру · Заявка клиента\n'+orderMessage({...i.data,id:i.id},order,'',{reviewUrl,price});
      const result=await telegramRequest(env.TELEGRAM_BOT_TOKEN,'sendMessage',{chat_id:env.TELEGRAM_CHAT_ID,text:text.slice(0,4000),link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:[[{text:'Посмотреть приглашение и согласовать',url:reviewUrl}]]}},fetchImpl);
      if(!result?.message_id)throw Object.assign(new Error('MISSING_PROVIDER_ID'),{retry:true});return String(result.message_id);
    }
    const fields=guest?[i.id,i.data.names||'Приглашение',guest.name,guestStatus,reviewUrl]:[i.id,i.data.names||order.contact.name,price.toLocaleString('ru-RU')+' ₸',order.contact.phone||order.contact.email,reviewUrl];
    const json=await post('https://graph.facebook.com/'+env.WHATSAPP_API_VERSION+'/'+env.WHATSAPP_PHONE_NUMBER_ID+'/messages',{messaging_product:'whatsapp',to:SUPPORT.whatsapp,type:'template',template:{name:guest?env.WHATSAPP_RSVP_TEMPLATE:env.WHATSAPP_ORDER_TEMPLATE,language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE},components:[{type:'body',parameters:fields.map(text=>({type:'text',text:String(text).replace(/[\r\n\t]+/g,' ').slice(0,500)}))}]}},{Authorization:'Bearer '+env.WHATSAPP_ACCESS_TOKEN});
    if(!json.messages?.[0]?.id)throw Object.assign(new Error('MISSING_PROVIDER_ID'),{retry:true});return json.messages[0].id;
  }
  async function runOnce(){
    if(running||!channels.length)return;running=true;
    try{
      const jobs=await sb('/rpc/shq_claim_order_notifications',{method:'POST',body:{p_channels:channels,p_limit:4,p_rsvp_whatsapp:!!env.WHATSAPP_RSVP_TEMPLATE}});
      for(const job of jobs){
        let update;
        try{const provider_id=await deliver(job);update={status:'sent',provider_id,sent_at:new Date().toISOString(),last_error:null}}
        catch(e){const retry=e.retry!==false&&job.attempts<6;update={status:retry?'retry':'failed',last_error:/^[A-Z_0-9]+$/.test(e.message)?e.message:'SEND_FAILED',available_at:new Date(Date.now()+Math.max(e.retryAfter||0,Math.min(3600,30*2**job.attempts))*1000).toISOString()}}
        await sb('/shq_order_notifications?id=eq.'+job.id+'&lease=eq.'+job.lease+'&status=eq.processing',{method:'PATCH',body:{...update,locked_until:null,lease:null}});
      }
      lastError=null;
    }catch{lastError='Не удалось обработать очередь уведомлений. Проверьте базу данных и настройки сервера.'}finally{running=false}
  }
  return {
    config,
    async testTelegram(){
      if(!config.telegram.configured)throw Object.assign(new Error('Сначала сохраните токен бота и ID своего чата на сервере.'),{status:503});
      try{
        const bot=await telegramRequest(env.TELEGRAM_BOT_TOKEN,'getMe',{},fetchImpl);
        if(!bot?.is_bot||!bot.username)throw Error('INVALID_PROVIDER_RESPONSE');
        const result=await telegramRequest(env.TELEGRAM_BOT_TOKEN,'sendMessage',{chat_id:env.TELEGRAM_CHAT_ID,text:'Шақыру · Проверка Telegram\nБот подключён к уведомлениям о заявках.'+(config.publicUrl?'\nКабинет: '+new URL('/admin',env.PUBLIC_URL).href:'\nДля рабочих ссылок добавьте публичный HTTPS-адрес сайта в настройках сервера.'),link_preview_options:{is_disabled:true}},fetchImpl);
        if(!result?.message_id)throw Error('INVALID_PROVIDER_RESPONSE');
        return {ok:true,username:bot.username};
      }catch(e){throw Object.assign(new Error(telegramErrorMessage(e)),{status:503})}
    },
    kick(){if(channels.length)void runOnce()},
    start(){if(channels.length&&!timer){timer=setInterval(()=>void runOnce(),20000);timer.unref();void runOnce()}},
    stop(){clearInterval(timer);timer=null},
    runOnce,
    async status(){let queueReady=false;try{await sb('/shq_order_notifications?select=id&limit=0');queueReady=true}catch{}return {...config,queueReady,lastError}},
    async forOrder(id){try{return await sb('/shq_order_notifications?inv=eq.'+id+'&select=id,channel,kind,status,attempts,last_error,created_at,sent_at&order=created_at.desc&limit=12')}catch{return []}},
    async retry(id){await sb('/shq_order_notifications?inv=eq.'+id+'&status=eq.failed',{method:'PATCH',body:{status:'pending',attempts:0,last_error:null,available_at:new Date().toISOString()}});this.kick()}
  };
}
