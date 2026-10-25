// Read-only diagnostics: never print keys, server response bodies or user data.
const env=process.env;
const base=String(env.SUPABASE_URL||'').trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
const service=String(env.SUPABASE_SERVICE_KEY||'').trim();
const anon=String(env.SUPABASE_ANON_KEY||'').trim();
let ready=true;
function report(ok,message){console.log(`${ok?'OK':'НУЖНО'}: ${message}`);if(!ok)ready=false;}
function validOrigin(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash}catch{return false}}
const validBase=validOrigin(base);
report(validBase,validBase?'SUPABASE_URL — корректный адрес проекта':'Задайте корректный SUPABASE_URL');
report(!!service,service?'SUPABASE_SERVICE_KEY — серверный ключ задан':'Добавьте SUPABASE_SERVICE_KEY');
report(!!anon,anon?'SUPABASE_ANON_KEY — публичный ключ Auth задан':'Добавьте публичный ключ SUPABASE_ANON_KEY');
report(validOrigin(env.PUBLIC_URL),validOrigin(env.PUBLIC_URL)?'PUBLIC_URL — адрес сайта без пути задан':'Задайте PUBLIC_URL — адрес сайта без пути');
async function probe(path,key){
  try{const response=await fetch(base+path,{headers:{apikey:key,...(key.startsWith('sb_')?{}:{Authorization:`Bearer ${key}`})},redirect:'error',signal:AbortSignal.timeout(15000)});await response.body?.cancel();return response.status}catch{return 0}
}
if(validBase&&service){
  const code=await probe('/rest/v1/shq_cloud_drafts?select=id&limit=0',service);
  report(code===200,code===200?'Таблица облачных черновиков доступна':code===404?'Выполните migrations/003_accounts.sql в SQL Editor Supabase':`Проверка таблицы не прошла (${code?'HTTP '+code:'сеть или время ожидания'}). Проверьте адрес, ключ и миграцию`);
}
if(validBase&&anon){
  const code=await probe('/auth/v1/settings',anon);
  report(code===200,code===200?'Supabase Auth принимает публичный ключ':`Проверка Auth не прошла (${code?'HTTP '+code:'сеть или время ожидания'})`);
}
console.log('Проверка не изменяет данные и не отправляет письма. Доставку кода нужно проверить отдельным входом.');
console.log(ready?'Подключение готово к проверке входа.':'Подключение пока не готово. Инструкция: ACCOUNT_SETUP.md');
process.exitCode=ready?0:1;
