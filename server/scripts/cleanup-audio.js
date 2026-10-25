// Lists unused audio older than seven days. Deletion is opt-in via --apply.
const env=process.env;
const base=String(env.SUPABASE_URL||"").replace(/\/rest\/v1\/?$/,"").replace(/\/$/,"");
const key=env.SUPABASE_SERVICE_KEY?.trim(),bucket=env.AUDIO_BUCKET||"shaqyru-audio";
if(!base||!key||!/^[a-z0-9-]+$/.test(bucket))throw new Error("Проверьте настройки Supabase");
const headers={apikey:key,...(key.startsWith("sb_")?{}:{Authorization:`Bearer ${key}`}),"Content-Type":"application/json"};
async function request(url,body,method=body?"POST":"GET"){
  const response=await fetch(base+url,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error("Не удалось прочитать хранилище или базу. Очистка остановлена.");
  return response.json();
}
const used=new Set();
for(let offset=0;;offset+=500){
  const rows=await request(`/rest/v1/shq_invitations?select=data&order=id.asc&limit=500&offset=${offset}`);
  for(const row of rows)if(typeof row.data?.mus==="string")used.add(row.data.mus);
  if(rows.length<500)break;
}
const candidates=[];
async function list(prefix=""){
  for(let offset=0;;offset+=100){
    const rows=await request(`/storage/v1/object/list/${bucket}`,{prefix,limit:100,offset,sortBy:{column:"name",order:"asc"}});
    for(const row of rows){
      if(!row.id){if(!prefix&&/^(?:[a-f0-9]{8}|[a-f0-9]{32})$/.test(row.name))await list(row.name);continue;}
      if(!prefix||!/^audio_[a-f0-9]{16}\.(mp3|m4a|wav|aac|ogg|webm)$/.test(row.name))continue;
      const file=prefix+"/"+row.name,url=`${base}/storage/v1/object/public/${bucket}/${file}`;
      const updated=Date.parse(row.updated_at||row.created_at);
      if(!used.has(url)&&Number.isFinite(updated)&&Date.now()-updated>7*86400000)candidates.push(file);
    }
    if(rows.length<100)break;
  }
}
await list();
console.log(`Неиспользуемых файлов старше 7 дней: ${candidates.length}`);
if(process.argv.includes("--apply")){
  // Recheck references immediately before deletion. Stop if anything has become referenced.
  const recheck=new Set();
  for(let offset=0;;offset+=500){const rows=await request(`/rest/v1/shq_invitations?select=data&order=id.asc&limit=500&offset=${offset}`);for(const row of rows)recheck.add(row.data?.mus);if(rows.length<500)break;}
  const safe=candidates.filter(file=>!recheck.has(`${base}/storage/v1/object/public/${bucket}/${file}`));
  for(let start=0;start<safe.length;start+=100)await request(`/storage/v1/object/${bucket}`,{prefixes:safe.slice(start,start+100)},"DELETE");
  console.log(`Удалено: ${safe.length}`);
}else console.log("Это только проверка. Для удаления добавьте -- --apply.");
