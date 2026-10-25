/* One native scroll owner. Existing CSS/WAAPI keyframes are paused and sought;
   GSAP owns their clocks, never the same elements' transform/opacity. */
import {mountInvitationWebGL} from './invitation-webgl.js';
const clamp=n=>Math.max(0,Math.min(1,n));
// ScrollTrigger suppresses callbacks while refreshing. Re-render numeric clocks
// and explicitly seek their WAAPI tracks after restoring the saved progress.
function refreshTracks(trigger,render){
  const animation=trigger.animation;if(!animation)return;
  const progress=trigger.progress;
  animation.totalProgress(0,true);animation.totalProgress(progress,true);render();
}

function seekable(animations){
  const tracks=animations.map(animation=>{
    const timing=animation.effect.getTiming();
    animation.pause();animation.effect.updateTiming({fill:'both'});animation.currentTime=0;
    return {animation,timing};
  });
  return {
    duration:Math.max(1,...tracks.filter(t=>t.timing.iterations!==Infinity).map(t=>Number(t.timing.delay)+Number(t.timing.duration)*t.timing.iterations)),
    seek(time){for(const {animation} of tracks)animation.currentTime=time},
    destroy(){for(const {animation} of tracks)animation.cancel()}
  };
}

export function mountInvitationScroll({host,card,state,opening=true,onActivate=()=>{}}){
  const gsap=window.gsap,ST=window.ScrollTrigger;
  if(!gsap||!ST){
    if(opening)showIntro(state,()=>playIn(card,state));
    return {replay(){showIntro(state,onActivate,{manual:true})},destroy(){}};
  }
  gsap.registerPlugin(ST);ST.config({ignoreMobileResize:true});
  let wantOpening=opening,active=null,destroyed=false;
  const media=gsap.matchMedia();
  function build(){
    if(destroyed)return;
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      const animations=[],cleanups=[],wrappers=[];
      let root=null,runway=null,pin=null,openingTrigger=null,refreshFrame=0,alive=true,materials=null;
      const originalClasses=card.className;
      host.classList.add('scroll-motion');
      // Float and entrance use different nodes; shimmer keeps its original property.
      for(const ornament of card.querySelectorAll('.inv.an .or')){
        const inner=document.createElement('span');inner.className='scroll-decor-float';
        while(ornament.firstChild)inner.append(ornament.firstChild);
        ornament.append(inner);wrappers.push(()=>{while(inner.firstChild)ornament.insertBefore(inner.firstChild,inner);inner.remove()});
      }
      let disposeOpening=()=>{},rootTracks=null;
      if(wantOpening){
        runway=document.createElement('div');runway.className='invitation-scroll-runway';
        pin=document.createElement('div');pin.className='invitation-scroll-pin';
        card.before(runway);runway.append(pin);pin.append(card);
        showIntro(state,undefined,{controlled:scene=>{
          root=scene.element;disposeOpening=scene.dispose;root.classList.add('scroll-controlled');
          root.removeAttribute('aria-modal');root.setAttribute('role','region');
          const hint=document.createElement('p');hint.className='scroll-opening-hint';
          hint.textContent=state.lang==='kz'?'Ашу үшін жоғары сырғытыңыз · Қайтарсаңыз, қайта жабылады':'Листайте вверх, чтобы открыть · Назад — чтобы закрыть';
          root.append(hint);
          // Individual rotate retains the portal spin alongside its expansion.
          for(const ring of root.querySelectorAll('.pt-ring')){
            const spin=ring.getAnimations()[0];if(!spin)continue;
            const timing=spin.effect.getTiming();ring.style.animation='none';
            ring.animate([{rotate:'0deg'},{rotate:'360deg'}],timing);
          }
          void root.offsetWidth;scene.start();void root.offsetWidth;
          rootTracks=seekable([...root.getAnimations({subtree:true})]);animations.push(rootTracks);
          const seal=root.querySelector('.seal');seal.disabled=false;
          const advance=()=>{onActivate();window.scrollTo({top:openingTrigger?.end||0,behavior:'smooth'})};
          const skip=()=>{window.scrollTo({top:openingTrigger?.end||0,behavior:'instant'});ST.update();host.focus({preventScroll:true})};
          seal.onclick=advance;root.querySelector('.intro-skip').onclick=skip;
          const motionSwitch=root.querySelector('.scene-motion');
          if(motionSwitch)motionSwitch.onchange=()=>{if(!motionSwitch.checked)skip()};
          const escape=e=>{if(e.key==='Escape'&&!root.inert){e.preventDefault();skip()}};
          document.addEventListener('keydown',escape);cleanups.push(()=>document.removeEventListener('keydown',escape));
        }});
      }
      const particles=playIn(card,state,{controlled:true});
      void card.offsetWidth;
      const cardAnimations=card.getAnimations({subtree:true});
      const cardTracks=seekable(cardAnimations.filter(a=>a.effect.getTiming().iterations!==Infinity));
      const ambientTracks=seekable(cardAnimations.filter(a=>a.effect.getTiming().iterations===Infinity));
      animations.push(cardTracks,ambientTracks);
      const clock={opening:0,card:0},ambientClock={time:0};
      const syncMaterials=()=>materials?.update({opening:rootTracks?clamp(clock.opening/rootTracks.duration):1,card:clamp(clock.card/cardTracks.duration),depth:clamp(ambientClock.time/30000)});
      const sync=()=>{
        cardTracks.seek(clock.card);
        syncMaterials();
        if(!root)return;
        rootTracks.seek(clock.opening);
        const p=clamp(clock.opening/rootTracks.duration),hidden=p>=.999;
        root.dataset.progress=p.toFixed(5);root.inert=hidden;host.inert=!hidden;
        root.style.visibility=hidden?'hidden':'visible';root.setAttribute('aria-hidden',String(hidden));
        const motionSwitch=root.querySelector('.scene-motion');if(motionSwitch&&!hidden)motionSwitch.checked=true;
        const flap=root.querySelector('.efl');if(flap)flap.style.zIndex=p<.35?'3':'0';
        if(hidden&&root.contains(document.activeElement))host.focus({preventScroll:true});
      };
      const distance=()=>Math.round(Math.max(540,document.documentElement.clientHeight*1.25));
      const sizeRunway=()=>{if(runway)runway.style.height=`${card.offsetHeight+distance()}px`};
      sizeRunway();
      const tl=gsap.timeline({defaults:{ease:'none'},onUpdate:sync,scrollTrigger:{
        id:'invitation-opening',trigger:runway||card,start:wantOpening?0:'top 85%',
        end:()=>wantOpening?distance():'+=360',scrub:true,onRefreshInit:sizeRunway,onRefresh:self=>refreshTracks(self,sync)
      }});
      if(rootTracks)tl.fromTo(clock,{opening:0},{opening:rootTracks.duration,duration:.88},0);
      tl.fromTo(clock,{card:0},{card:cardTracks.duration,duration:rootTracks ? .5 : 1},rootTracks ? .5 : 0);
      openingTrigger=tl.scrollTrigger;
      // Ambient card effects continue with subsequent scrolling, rather than
      // freezing permanently at the end of the short opening range.
      const depth=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{
        id:'invitation-depth',trigger:host,start:0,end:'bottom bottom',scrub:true,
        onRefresh:self=>refreshTracks(self,()=>{ambientTracks.seek(ambientClock.time);syncMaterials()})
      }});
      depth.fromTo(ambientClock,{time:0},{time:30000,duration:1,onUpdate:()=>{ambientTracks.seek(ambientClock.time);syncMaterials()}},0);
      // Individual translate composes with the existing transform keyframes.
      for(const [selector,pixels] of [['.bgp',18],['.rg,.or',-10]]){
        const nodes=card.querySelectorAll(selector);nodes.forEach(n=>n.classList.add('scroll-depth'));
        if(nodes.length)depth.fromTo(nodes,{'--scroll-depth':'0px'},{'--scroll-depth':pixels+'px',duration:1},0);
        cleanups.push(()=>nodes.forEach(n=>n.classList.remove('scroll-depth')));
      }
      let sectionIndex=0;
      for(const section of host.querySelectorAll('.gl,.guest-hero')){
        // Measure an unanimated parent: the section's WAAPI translate must not
        // shift its own trigger bounds during a resize/font/image refresh.
        const track=document.createElement('div');track.className='scroll-section-track';
        section.before(track);track.append(section);
        wrappers.push(()=>{track.before(section);track.remove()});
        void section.offsetWidth;
        const entrance=seekable(section.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity));animations.push(entrance);
        section.dataset.motionReveal='';const value={time:0};
        const reveal=gsap.timeline({defaults:{ease:'none'},scrollTrigger:{
          id:'invitation-section-'+sectionIndex++,trigger:track,start:'top 96%',end:'top 62%',scrub:true,
          onRefresh:self=>refreshTracks(self,()=>entrance.seek(value.time))
        }});
        reveal.fromTo(value,{time:0},{time:entrance.duration,duration:1,onUpdate:()=>entrance.seek(value.time)},0);
        const text=section.querySelectorAll('h3,.place-name,.place-addr');
        if(text.length)reveal.fromTo(text,{opacity:.12,y:14},{opacity:1,y:0,duration:.8,stagger:.08},.1);
        cleanups.push(()=>delete section.dataset.motionReveal);
      }
      // The atmosphere layer moves; its original particle animations remain inside.
      const atmosphere=document.querySelector('.living-scene');
      if(atmosphere)depth.fromTo(atmosphere,{y:0},{y:-28,duration:1},0);
      const refresh=()=>{cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(()=>ST.refresh())};
      let dimensions='';
      const observer=new ResizeObserver(entries=>{
        const rect=entries[0].contentRect,key=`${rect.width}:${rect.height}`;
        if(key!==dimensions){dimensions=key;refresh()}
      });observer.observe(host);
      host.addEventListener('load',refresh,true);window.addEventListener('afterprint',refresh);
      document.fonts?.ready.then(()=>{if(alive)refresh()});
      // A single shader owner receives the very same clocks as the existing
      // keyframes. It does not own a timeline, a ScrollTrigger or DOM transforms.
      materials=mountInvitationWebGL({host,card,state,openingRoot:root});
      sync();ST.refresh();ST.update();
      active={replay(){window.scrollTo({top:0,behavior:'instant'});ST.update();root?.querySelector('.seal').focus({preventScroll:true})}};
      return ()=>{
        alive=false;active=null;materials?.destroy();observer.disconnect();cancelAnimationFrame(refreshFrame);host.inert=false;
        host.removeEventListener('load',refresh,true);window.removeEventListener('afterprint',refresh);
        for(const cleanup of cleanups)cleanup();for(const a of animations)a.destroy();
        particles?.remove();disposeOpening();card.className=originalClasses;
        if(runway){runway.before(card);runway.remove()}
        for(const unwrap of wrappers)unwrap();host.classList.remove('scroll-motion');
        // A cancelled CSSAnimation does not restart merely because a new owner
        // reads getAnimations(). Reset the CSS names before a replay/remount.
        host.classList.add('scroll-motion-reset');void host.offsetWidth;host.classList.remove('scroll-motion-reset');
      };
    });
  }
  const suspend=()=>{media.revert();active=null};
  const resume=e=>{if(e.persisted)build()};
  window.addEventListener('pagehide',suspend);window.addEventListener('pageshow',resume);
  build();
  return {
    replay(){
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){showIntro(state,onActivate,{manual:true});return}
      if(!wantOpening){media.revert();wantOpening=true;build()}
      active?.replay();
    },
    destroy(){destroyed=true;suspend();window.removeEventListener('pagehide',suspend);window.removeEventListener('pageshow',resume)}
  };
}
