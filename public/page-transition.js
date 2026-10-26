// Runs in <head> so the arrival curtain is ready before the first paint.
(()=>{
  const root=document.documentElement,key='shq-editor-transition',motion=matchMedia('(prefers-reduced-motion: reduce)');
  let navigating=false,navigationTimer,revealTimer,watchdog,observer,trigger,revealFrame=0,navigationFrame=0,revealQueued=false,destination='';
  const clear=()=>{root.removeAttribute('data-page-transition');clearTimeout(revealTimer);clearTimeout(watchdog);cancelAnimationFrame(revealFrame);cancelAnimationFrame(navigationFrame);revealQueued=false;observer?.disconnect()};
  function reveal(){
    if(revealQueued||root.dataset.pageTransition==='reveal')return;
    observer?.disconnect();clearTimeout(watchdog);revealQueued=true;
    // Commit the covered editor's layout before its compositor fade starts.
    revealFrame=requestAnimationFrame(()=>{revealFrame=requestAnimationFrame(()=>{
      revealFrame=0;revealQueued=false;root.dataset.pageTransition='reveal';
      // animationend owns completion; the timeout is only crash recovery.
      revealTimer=setTimeout(clear,motion.matches?700:1800);
    })});
  }
  function navigate(){if(!navigating||!destination)return;clearTimeout(navigationTimer);const target=destination;destination='';location.assign(target)}
  root.addEventListener('animationend',event=>{
    if(event.target!==root||event.pseudoElement!=='::before')return;
    if(event.animationName==='editor-cover-out'&&root.dataset.pageTransition==='reveal')clear();
    else if(event.animationName==='editor-cover-in'&&root.dataset.pageTransition==='leave')navigate();
  });
  try{
    const pending=JSON.parse(sessionStorage.getItem(key)||'null');sessionStorage.removeItem(key);
    if(location.pathname==='/create'&&pending?.url===location.href&&Date.now()-pending.at<6000){
      root.dataset.pageTransition='enter';
      const ready=()=>{if(root.dataset.pageTransition!=='enter')return;const app=document.getElementById('app');if(app&&!app.inert)reveal()};
      observer=new MutationObserver(ready);observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['inert']});
      watchdog=setTimeout(reveal,3000);
      document.addEventListener('DOMContentLoaded',ready,{once:true});
    }
  }catch{}
  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||location.pathname==='/create')return;
    const link=e.target.closest?.('a[href]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self'))return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!=='/create')return;
    if(navigating){e.preventDefault();return}
    try{sessionStorage.setItem(key,JSON.stringify({url:url.href,at:Date.now()}))}catch{return}
    e.preventDefault();navigating=true;destination=url.href;trigger=link;trigger.setAttribute('aria-busy','true');root.dataset.pageTransition='leave';
    // Let the first covered frame paint even on a busy mobile main thread.
    navigationFrame=requestAnimationFrame(()=>{navigationFrame=0;navigationTimer=setTimeout(navigate,motion.matches?700:1200)});
    // Recover the page if the navigation is cancelled or fails before committing.
    watchdog=setTimeout(()=>{clear();navigating=false;trigger?.removeAttribute('aria-busy')},4500);
  });
  window.addEventListener('pageshow',e=>{if(e.persisted){clear();clearTimeout(navigationTimer);navigating=false;trigger?.removeAttribute('aria-busy');try{sessionStorage.removeItem(key)}catch{}}});
  motion.addEventListener('change',()=>{if(root.dataset.pageTransition==='reveal'){clearTimeout(revealTimer);revealTimer=setTimeout(clear,motion.matches?700:1800)}});
})();
