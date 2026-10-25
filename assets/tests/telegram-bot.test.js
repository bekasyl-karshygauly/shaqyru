import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {telegramRequest,telegramErrorMessage} from '../telegram-bot.js';
import {createOrderNotifications} from '../order-notifications.js';
import {telegramEnvText,saveTelegramEnv} from '../scripts/telegram-env.js';

test('Telegram errors never expose the token or raw provider response',async()=>{
  const token='PRIVATE_TOKEN';
  await assert.rejects(telegramRequest(token,'getMe',{},async()=>{throw Error('https://api.telegram.org/bot'+token)}),{message:'NETWORK_OR_TIMEOUT'});
  for(const code of [401,403,409,429])await assert.rejects(telegramRequest(token,'getMe',{},async()=>Response.json({ok:false,error_code:code,description:token,parameters:{retry_after:30}},{status:code})),e=>{assert.equal(e.message,'PROVIDER_'+code);assert.ok(!telegramErrorMessage(e).includes(token));assert.equal(e.retry,code===429);return true});
  await assert.rejects(telegramRequest(token,'getMe',{},async()=>new Response('not json')),{message:'INVALID_PROVIDER_RESPONSE'});
});

test('test message checks the bot and sends only to the configured owner, including on localhost',async()=>{
  const requests=[],service=createOrderNotifications({env:{TELEGRAM_BOT_TOKEN:'PRIVATE_TOKEN',TELEGRAM_CHAT_ID:'123456',PUBLIC_URL:'http://localhost:3108'},sb:async()=>[],inv:async()=>null,fetchImpl:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return Response.json({ok:true,result:url.endsWith('/getMe')?{is_bot:true,username:'ShagyruTestBot'}:{message_id:123}})}});
  assert.deepEqual(await service.testTelegram(),{ok:true,username:'ShagyruTestBot'});assert.equal(requests.length,2);assert.equal(requests[1].body.chat_id,'123456');assert.match(requests[1].body.text,/публичный HTTPS/);assert.ok(!requests[1].body.text.includes('localhost'));assert.equal(requests[1].body.reply_markup,undefined);
  assert.ok(!JSON.stringify(await service.status()).includes('PRIVATE_TOKEN'));
  await service.runOnce();assert.equal(requests.length,2,'real jobs stay paused until the site has a public origin');
});

test('incomplete configuration cannot send a test message',async()=>{
  let called=false;const service=createOrderNotifications({env:{TELEGRAM_BOT_TOKEN:'PRIVATE_TOKEN'},sb:async()=>[],inv:async()=>null,fetchImpl:async()=>{called=true}});
  await assert.rejects(service.testTelegram(),e=>e.status===503);assert.equal(called,false);
});

test('Telegram setup preserves unrelated env values, removes duplicate keys and writes only allowed values',async()=>{
  const source='# private configuration\r\nADMIN_KEY=KEEP_ME\r\nTELEGRAM_BOT_TOKEN=old\r\nTELEGRAM_BOT_TOKEN=duplicate\r\nPUBLIC_URL=http://localhost:3108\r\n';
  const values={TELEGRAM_BOT_TOKEN:'123456:example_test_token',TELEGRAM_CHAT_ID:'1234',TELEGRAM_BOT_USERNAME:'ExampleBot'},result=telegramEnvText(source,values);
  assert.ok(result.includes('ADMIN_KEY=KEEP_ME\r\n'));assert.ok(result.includes('PUBLIC_URL=http://localhost:3108\r\n'));assert.equal(result.match(/TELEGRAM_BOT_TOKEN=/g).length,1);assert.ok(!result.includes('duplicate'));
  const dir=await mkdtemp(path.join(os.tmpdir(),'shaqyru-telegram-'));try{const file=path.join(dir,'.env');await writeFile(file,source);await saveTelegramEnv(file,values);assert.equal(await readFile(file,'utf8'),result);assert.deepEqual(await readdir(dir),['.env']);await assert.rejects(saveTelegramEnv(file,{ADMIN_KEY:'change'}));await assert.rejects(saveTelegramEnv(file,{TELEGRAM_BOT_TOKEN:'x\nADMIN_KEY=change'}));assert.equal(await readFile(file,'utf8'),result)}finally{await rm(dir,{recursive:true,force:true})}
});
