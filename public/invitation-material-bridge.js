/* One bounded worker and one in-flight job. Older engines keep the existing
   on-main renderer; capability/startup failure never blocks the invitation. */
export function startMaterialWorker({accent,onLost,onRestored,onFailure}){
  if(typeof Worker==='undefined'||typeof OffscreenCanvas==='undefined'||typeof OffscreenCanvas.prototype.transferToImageBitmap!=='function'||typeof createImageBitmap!=='function')return Promise.resolve(null);
  return new Promise(resolve=>{
    let worker,settled=false,closed=false;const jobs=new Map();
    const closeImages=message=>{for(const tile of message.images||[])tile.image?.close()};
    const rejectJobs=()=>{for(const job of jobs.values())job.reject(Error('MATERIAL_CANCELLED'));jobs.clear()};
    const destroy=()=>{if(closed)return;closed=true;clearTimeout(timer);rejectJobs();worker?.terminate()};
    const startupFailure=()=>{if(settled)return;settled=true;destroy();resolve(null)};
    const timer=setTimeout(startupFailure,5000);
    try{
      worker=new Worker(new URL('./invitation-material-worker.js',import.meta.url),{type:'module',name:'invitation-material'});
      worker.onerror=event=>{event.preventDefault();if(!settled)startupFailure();else{destroy();onFailure()}};
      worker.onmessage=event=>{
        const message=event.data;if(closed){closeImages(message);return}
        if(message.type==='unsupported'){startupFailure();return}
        if(message.type==='ready'){
          if(settled)return;settled=true;clearTimeout(timer);
          resolve({maxTextureSize:message.maxTextureSize,paint(job){return new Promise((resolve,reject)=>{if(closed){reject(Error('MATERIAL_CLOSED'));return}jobs.set(job.id,{resolve,reject});worker.postMessage({...job,type:'paint'})})},cancel(){if(closed)return;rejectJobs();worker.postMessage({type:'cancel'})},destroy});return;
        }
        if(message.type==='lost'){rejectJobs();onLost();return}
        if(message.type==='restored'){onRestored();return}
        if(message.type==='fatal'){destroy();onFailure();return}
        const job=jobs.get(message.id);jobs.delete(message.id);
        if(!job){closeImages(message);return}
        if(message.type==='painted')job.resolve(message);else job.reject(Error(message.error==='cancelled'?'MATERIAL_CANCELLED':'MATERIAL_RENDER_FAILED'));
      };
      worker.postMessage({type:'init',accent});
    }catch{startupFailure()}
  });
}
