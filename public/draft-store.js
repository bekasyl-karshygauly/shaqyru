let dbPromise;
function database(){return dbPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('shaqyru-library',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function run(mode,operation){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('drafts',mode),request=operation(tx.objectStore('drafts'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Не удалось сохранить приглашение'))})}
export const draftKey=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value)?value:crypto.randomUUID();
export const readDraft=key=>run('readonly',s=>s.get(key));
export const listDrafts=()=>run('readonly',s=>s.getAll());
export const saveDraft=(key,data)=>run('readwrite',s=>s.put({key,data:{...data,_localKey:key},updated:Date.now()}));
export function copyDraft(data){const {id,tok,paid,paidTier,_dirty,_serverVersion,_localKey,closed,closeAt,...rest}=data;return {...rest,names:(data.names?data.names+' — копия':'Новое приглашение').slice(0,80),paid:0,closed:false,closeAt:'',_dirty:true}}
