export async function telegramRequest(token,method,body={},fetchImpl=fetch){
  if(!token)throw Object.assign(new Error('TELEGRAM_NOT_CONFIGURED'),{retry:false});
  let response,json;
  try{response=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)})}
  catch{throw Object.assign(new Error('NETWORK_OR_TIMEOUT'),{retry:true})}
  try{json=await response.json()}catch{throw Object.assign(new Error('INVALID_PROVIDER_RESPONSE'),{retry:true})}
  if(!response.ok||json.ok!==true)throw Object.assign(new Error('PROVIDER_'+(Number(json.error_code)||response.status)),{retry:response.status===429||response.status>=500,retryAfter:Number(json.parameters?.retry_after)||0});
  return json.result;
}
export function telegramErrorMessage(error){
  return error.message==='PROVIDER_401'?'Telegram отклонил токен бота. Проверьте токен от BotFather.':error.message==='PROVIDER_403'?'Бот не может написать в этот чат. Откройте бота и нажмите «Запустить».':error.message==='PROVIDER_409'?'Бот уже получает сообщения в другом приложении. Его подключение не изменено.':error.message==='TELEGRAM_NOT_CONFIGURED'?'Сначала подключите токен Telegram-бота.':'Не удалось связаться с Telegram. Проверьте подключение и настройки бота.';
}
