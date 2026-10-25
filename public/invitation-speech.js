// Never let the browser fall back to an unrelated default (often English).
export function invitationVoice(voices,lang){
  const language=lang==='ru'?'ru':lang==='kz'?'kk':null;if(!language)return null;
  const locale=language==='ru'?'ru-ru':'kk-kz';
  const tag=voice=>String(voice.lang||'').trim().replaceAll('_','-').toLowerCase();
  const score=voice=>(tag(voice)===locale?4:0)+(voice.localService?2:0)+(voice.default?1:0);
  return [...voices].filter(voice=>tag(voice).split('-')[0]===language).sort((a,b)=>score(b)-score(a))[0]||null;
}

export function mountInvitationSpeech(host,{lang,text,label}){
  const synth=window.speechSynthesis;
  if(!synth||!window.SpeechSynthesisUtterance)return ()=>{};
  const button=document.createElement('button');button.type='button';button.className='act-btn';button.textContent='🔊 '+label;
  let active=null,destroyed=false;
  const voices=()=>{try{return synth.getVoices()}catch{return []}};
  const stop=()=>{if(active){active=null;synth.cancel()}};
  const refresh=()=>{
    if(destroyed)return;
    if(invitationVoice(voices(),lang)){if(button.parentNode!==host)host.append(button)}
    else{stop();button.remove()}
  };
  button.onclick=()=>{
    const voice=invitationVoice(voices(),lang);
    if(!voice){refresh();return}
    stop();const utterance=new SpeechSynthesisUtterance(text);
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.9;active=utterance;
    utterance.onend=utterance.onerror=()=>{if(active===utterance)active=null};
    synth.speak(utterance);
  };
  const onPageHide=event=>{stop();if(!event.persisted)destroy()};
  function destroy(){
    if(destroyed)return;destroyed=true;stop();button.remove();
    synth.removeEventListener('voiceschanged',refresh);
    window.removeEventListener('pagehide',onPageHide);window.removeEventListener('pageshow',refresh);
  }
  synth.addEventListener('voiceschanged',refresh);
  window.addEventListener('pagehide',onPageHide);window.addEventListener('pageshow',refresh);
  refresh();return destroy;
}
