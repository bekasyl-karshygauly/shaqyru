import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {telegramRequest,telegramErrorMessage} from '../telegram-bot.js';
import {saveTelegramEnv} from './telegram-env.js';

function secret(){
  if(!process.stdin.isTTY)throw Error('TTY_REQUIRED');
  process.stdout.write('Токен от BotFather (ввод скрыт): ');
  return new Promise((resolve,reject)=>{
    let value='';const wasRaw=process.stdin.isRaw;process.stdin.setRawMode(true);process.stdin.resume();
    const finish=()=>{process.stdin.off('data',input);process.stdin.setRawMode(!!wasRaw);process.stdin.pause();process.stdout.write('\n')};
    const input=data=>{for(const c of data.toString()){
      if(c==='\r'||c==='\n'){finish();resolve(value.trim());return}
      if(c==='\u0003'){finish();reject(Error('CANCELLED'));return}
      if(c==='\u007f'||c==='\b'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b')}}
      else if(/[A-Za-z0-9_:-]/.test(c)){value+=c;process.stdout.write('*')}
    }};process.stdin.on('data',input);
  });
}
async function main(){
  console.log('Подключение Telegram к Шақыру. Токен не выводится и сохраняется только в .env.');
  const token=process.env.TELEGRAM_BOT_TOKEN?.trim()||await secret();
  if(!/^\d{5,20}:[A-Za-z0-9_-]{20,}$/.test(token))throw Error('INVALID_TOKEN');
  const bot=await telegramRequest(token,'getMe');
  if(!bot?.is_bot||!bot.username)throw Error('INVALID_TOKEN');
  console.log('Бот: @'+bot.username);
  let chatId=process.env.TELEGRAM_CHAT_ID;
  if(!/^-?\d+$/.test(chatId||'')){
    const webhook=await telegramRequest(token,'getWebhookInfo');
    if(webhook?.url)throw Error('EXISTING_WEBHOOK');
    if(!process.argv.includes('--pair'))throw Error('PAIR_REQUIRED');
    const code='shq_'+crypto.randomBytes(12).toString('hex');
    console.log('Откройте ссылку со своего Telegram-аккаунта и нажмите «Запустить»:\nhttps://t.me/'+bot.username+'?start='+code);
    console.log('Ожидаю подтверждение до 2 минут. Существующий webhook и чужие сообщения не меняются.');
    const until=Date.now()+120000;
    while(Date.now()<until){
      const updates=await telegramRequest(token,'getUpdates',{timeout:5,limit:100});
      const message=updates.map(u=>u.message).find(m=>m?.text?.trim()==='/start '+code&&m.chat?.type==='private'&&m.from?.id===m.chat?.id&&!m.from?.is_bot);
      if(message){chatId=String(message.chat.id);console.log('Подтверждён ваш личный чат'+(message.from.username?' @'+message.from.username:''));break}
      await new Promise(r=>setTimeout(r,1000));
    }
    if(!chatId)throw Error('PAIR_TIMEOUT');
  }
  const file=path.join(path.dirname(fileURLToPath(import.meta.url)),'..','.env');
  await saveTelegramEnv(file,{TELEGRAM_BOT_TOKEN:token,TELEGRAM_CHAT_ID:chatId,TELEGRAM_BOT_USERNAME:bot.username});
  await telegramRequest(token,'sendMessage',{chat_id:chatId,text:'Шақыру · Telegram подключён.\nЭто тестовое сообщение владельцу сайта. Перезапустите сервер, чтобы включить сохранённые настройки.'});
  console.log('Настройки сохранены. Telegram принял тестовое сообщение. Теперь перезапустите сервер сайта.');
}
main().catch(error=>{
  const messages={INVALID_TOKEN:'Проверьте токен, выданный BotFather.',EXISTING_WEBHOOK:'У бота уже настроен webhook другого приложения. Я его не менял. Укажите TELEGRAM_CHAT_ID вручную либо подключите отдельного бота.',PAIR_REQUIRED:'Для привязки личного чата запустите npm run telegram:connect -- --pair, только если этот бот сейчас не работает в другом приложении. Иначе укажите TELEGRAM_CHAT_ID вручную.',PAIR_TIMEOUT:'Подтверждение не получено. Повторите команду и нажмите «Запустить» по новой ссылке.',TTY_REQUIRED:'Запустите эту команду в интерактивном терминале или заполните TELEGRAM_BOT_TOKEN в локальном .env.',CANCELLED:'Подключение отменено.',ENV_CHANGED:'.env изменился во время подключения. Повторите команду.'};
  console.error(messages[error.message]||telegramErrorMessage(error));process.exitCode=1;
});
