import {readFile,writeFile,rename,unlink} from 'node:fs/promises';
import crypto from 'node:crypto';
export function telegramEnvText(source,values){
  const remaining=new Map(Object.entries(values)),lines=[];
  for(const line of source.split(/\r?\n/)){
    const key=/^\s*([A-Z_]+)\s*=/.exec(line)?.[1];
    if(Object.hasOwn(values,key)){if(remaining.has(key)){lines.push(key+'='+remaining.get(key));remaining.delete(key)}}else lines.push(line);
  }
  for(const [key,value]of remaining)lines.push(key+'='+value);
  return lines.join(source.includes('\r\n')?'\r\n':'\n');
}
export async function saveTelegramEnv(file,values){
  if(Object.entries(values).some(([key,value])=>!/^TELEGRAM_(BOT_TOKEN|CHAT_ID|BOT_USERNAME)$/.test(key)||/[\r\n\0]/.test(value)))throw Error('INVALID_ENV_VALUES');
  const before=await readFile(file,'utf8'),updated=telegramEnvText(before,values),temporary=file+'.telegram-'+crypto.randomUUID()+'.tmp';
  try{
    await writeFile(temporary,updated,{mode:0o600,flag:'wx'});
    if(await readFile(file,'utf8')!==before)throw Error('ENV_CHANGED');
    await rename(temporary,file);
  }finally{await unlink(temporary).catch(()=>{})}
}
