/* One native scroll owner. Existing CSS/WAAPI keyframes are paused and sought;
   GSAP owns their clocks, never the same elements' transform/opacity. */
import {mountInvitationWebGL} from './invitation-webgl.js';
const clamp=n=>Math.max(0,Math.min(1,n));
let scrollEnginesSleeping=false;
function sleepIdleScrollEngines(gsap,ST){
  if(ST.getAll().length)return;
  if(!scrollEnginesSleeping){ST.disable(false);scrollEnginesSleeping=true}
  gsap.ticker.sleep();
}
// Respect the preference as soon as this module is loaded, before the guest
// API finishes and visible HTML is mounted. The already queued global RAF can
// finish once without leaving background work on the static invitation.
if(typeof window!=='undefined'&&window.gsap&&window.ScrollTrigger&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)sleepIdleScrollEngines(window.gsap,window.ScrollTrigger);
// `auto` is supported by older WebKit as well. Temporarily overriding the
// site's smooth anchor scrolling makes replay/skip an actual synchronous seek.
function scrollImmediately(top){
  const style=document.documentElement.style;
  const value=style.getPropertyValue('scroll-behavior'),priority=style.getPropertyPriority('scroll-behavior');
  style.setProperty('scroll-behavior','auto','important');
  try{window.scrollTo({top,behavior:'auto'})}
  finally{if(value)style.setProperty('scroll-behavior',value,priority);else style.removeProperty('scroll-behavior')}
}
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
    const end=Number(animation.effect.getComputedTiming().endTime);
    return {animation,timing,end:Number.isFinite(end)?Math.max(0,end):Infinity,time:0};
  });
  return {
    duration:Math.max(1,...tracks.filter(t=>t.timing.iterations!==Infinity).map(t=>Number(t.timing.delay)+Number(t.timing.duration)*t.timing.iterations)),
    seek(time){for(const track of tracks){
      // Finished entrances keep their last frame without invalidating text and
      // decorations on every later scroll tick. Infinite tracks stay reversible.
      const next=Math.min(Math.max(0,time),track.end);
      if(next!==track.time){track.animation.currentTime=next;track.time=next}
    }},
    destroy(){for(const {animation} of tracks)animation.cancel()}
  };
}

export function mountInvitationScroll({host,card,state,opening=true,onActivate=()=>{},onProgress=()=>{}}){
  const gsap=window.gsap,ST=window.ScrollTrigger;
  if(!gsap||!ST){
    if(opening)showIntro(state,()=>playIn(card,state));
    return {replay(){showIntro(state,onActivate,{manual:true})},destroy(){}};
  }
  // The plugin already ignores mobile toolbar-only resize by default. Avoid a
  // redundant config() call: this bundled version clears its stored sync timer
  // handle when syncInterval is omitted, preventing disable() from stopping it.
  gsap.registerPlugin(ST);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const idleWhenReduced=()=>{
    // This standalone invitation is the GSAP owner. Reverting its media
    // context removes every trigger, but ScrollTrigger's global iOS RAF fix
    // and GSAP's ticker otherwise continue even on a static reduced page.
    // Never suspend the engine while another scroll owner still has triggers.
    if(!reduced.matches||ST.getAll().length)return;
    sleepIdleScrollEngines(gsap,ST);
  };
  // ScrollTrigger refreshes in this event too; sleep after that final work,
  // including when the preference is changed while the page is already open.
  gsap.addEventListener('matchMedia',idleWhenReduced);
  let wantOpening=opening,active=null,destroyed=false;
  const media=gsap.matchMedia();
  function build(){
    if(destroyed)return;
    media.add('(prefers-reduced-motion: no-preference)',()=>{
      if(scrollEnginesSleeping){
        ST.enable();scrollEnginesSleeping=false;gsap.ticker.wake();
        // enable() installs its matchMedia refresh listener again. Keep our
        // idle check last so a later preference change cannot wake the ticker.
        gsap.removeEventListener('matchMedia',idleWhenReduced);gsap.addEventListener('matchMedia',idleWhenReduced);
      }
      const animations=[],cleanups=[],wrappers=[];
      let root=null,runway=null,pin=null,openingTrigger=null,refreshFrame=0,refreshWanted=false,alive=true,materials=null,advancing=false,advanceTween=null;
      const advanceClock={progress:0};
      const stopAdvance=()=>{advancing=false;advanceTween?.kill();advanceTween=null;document.documentElement.classList.remove('invitation-opening-advance')};
      // The button moves the native scroll position over a deliberate duration.
      // Existing ScrollTriggers still own every visual clock, including shaders.
      const seekAdvance=()=>{if(!advancing||!openingTrigger)return;window.scrollTo({top:openingTrigger.start+(openingTrigger.end-openingTrigger.start)*advanceClock.progress,behavior:'auto'});ST.update()};
      let seal=null,motionSwitch=null,flap=null,rootHidden=null,flapLayer=null,rootProgress='';
      const originalClasses=card.className;
      const html=document.documentElement,ownsNativeClass=!html.classList.contains('invitation-scroll-native');
      html.classList.add('invitation-scroll-native');
      host.classList.add('scroll-motion');
      // Float and entrance use different nodes; shimmer keeps its original property.
      for(const ornament of card.querySelectorAll('.inv.an .or')){
        const inner=document.createElement('span');inner.className='scroll-decor-float';
        while(ornament.firstChild)inner.append(ornament.firstChild);
        ornament.append(inner);wrappers.push(()=>{while(inner.firstChild)ornament.insertBefore(inner.firstChild,inner);inner.remove()});
      }
      let disposeOpening=()=>{},rootTracks=null,uncoverAt=0;
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
          // Hidden paper/ambient tracks need not invalidate dozens of layers
          // behind the opaque opening. Seek their exact clock once uncovered.
          const fade=root.getAnimations().find(a=>a.effect?.target===root&&a.effect.getKeyframes().some(f=>Number(f.opacity)===0));
          if(fade)uncoverAt=Math.max(0,Number(fade.effect.getTiming().delay)||0);
          seal=root.querySelector('.seal');seal.disabled=false;
          motionSwitch=root.querySelector('.scene-motion');flap=root.querySelector('.efl');
          const advance=()=>{
            if(!openingTrigger)return;
            onActivate();stopAdvance();advancing=true;
            advanceClock.progress=clamp((window.scrollY-openingTrigger.start)/Math.max(1,openingTrigger.end-openingTrigger.start));
            html.classList.add('invitation-opening-advance');
            advanceTween=gsap.to(advanceClock,{progress:1,duration:Math.max(.35,2.4*(1-advanceClock.progress)),ease:'power1.inOut',onUpdate:seekAdvance,onComplete:()=>{stopAdvance();if(refreshWanted&&!refreshFrame)refreshFrame=requestAnimationFrame(flushRefresh)}});
          };
          const skip=()=>{stopAdvance();scrollImmediately(openingTrigger?.end||0);ST.update();host.focus({preventScroll:true})};
          seal.onclick=advance;root.querySelector('.intro-skip').onclick=skip;
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
      let ambientDuration=1,lastProgress=null;
      const covered=()=>!!rootTracks&&clock.opening<uncoverAt;
      const syncMaterials=()=>{
        const value={opening:rootTracks?clamp(clock.opening/rootTracks.duration):1,card:clamp(clock.card/cardTracks.duration),depth:clamp(ambientClock.time/ambientDuration),covered:covered()};
        if(lastProgress&&value.opening===lastProgress.opening&&value.card===lastProgress.card&&value.depth===lastProgress.depth&&value.covered===lastProgress.covered&&ambientClock.time===lastProgress.ambientTime)return;
        lastProgress={...value,ambientTime:ambientClock.time};
        materials?.update(value);onProgress(lastProgress);
      };
      const sync=()=>{
        cardTracks.seek(clock.card);
        if(!covered())ambientTracks.seek(ambientClock.time);
        syncMaterials();
        if(!root)return;
        rootTracks.seek(clock.opening);
        const p=clamp(clock.opening/rootTracks.duration),hidden=p>=.999;
        const progress=p.toFixed(5);if(progress!==rootProgress){root.dataset.progress=progress;rootProgress=progress}
        if(hidden!==rootHidden){
          rootHidden=hidden;root.inert=hidden;host.inert=!hidden;
          root.style.visibility=hidden?'hidden':'visible';root.setAttribute('aria-hidden',String(hidden));
          if(motionSwitch&&!hidden)motionSwitch.checked=true;
          if(hidden&&root.contains(document.activeElement))host.focus({preventScroll:true});
        }
        const layer=p<.35?'3':'0';if(flap&&layer!==flapLayer){flap.style.zIndex=layer;flapLayer=layer}
      };
      const distance=()=>Math.round(Math.max(864,document.documentElement.clientHeight*2));
      const sizeRunway=()=>{if(runway)runway.style.height=`${card.offsetHeight+distance()}px`};
      sizeRunway();
      let layoutViewport={width:document.documentElement.clientWidth,height:document.documentElement.clientHeight},resizeProgress=null;
      const beforeRefresh=()=>{
        const width=document.documentElement.clientWidth,height=document.documentElement.clientHeight,ratio=height/layoutViewport.height;
        // GSAP's media refresh can already have reverted trigger.progress to
        // zero here, while the native scroll offset is still the user's frame.
        const progress=openingTrigger?clamp((window.scrollY-openingTrigger.start)/Math.max(1,openingTrigger.end-openingTrigger.start)):1;
        if(root&&openingTrigger&&progress<1&&(width!==layoutViewport.width||ratio<.75||ratio>1.25))resizeProgress=progress;
        layoutViewport={width,height};
      };
      const afterRefresh=()=>{
        if(!alive||!openingTrigger)return;
        // WebKit applies the old absolute scroll offset to the new, shorter
        // landscape runway. Preserve the held opening frame after remeasure.
        if(resizeProgress!==null){const progress=resizeProgress;resizeProgress=null;scrollImmediately(openingTrigger.start+(openingTrigger.end-openingTrigger.start)*progress);ST.update()}
        // The same normalized button progress survives a late remeasure.
        // The next tick uses the new bounds without restarting or accelerating.
        seekAdvance();
      };
      ST.addEventListener('refreshInit',beforeRefresh);ST.addEventListener('refresh',afterRefresh);
      cleanups.push(()=>{ST.removeEventListener('refreshInit',beforeRefresh);ST.removeEventListener('refresh',afterRefresh)});
      // A pixel of native scrolling advances decoration time by only 3ms. The
      // previous fixed 30s clock raced through petals on short phone pages.
      ambientDuration=Math.max(1,(host.getBoundingClientRect().bottom+window.scrollY-document.documentElement.clientHeight)*3);
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
        invalidateOnRefresh:true,
        onRefresh:self=>{
          const duration=Math.max(1,(self.end-self.start)*3);
          if(duration!==ambientDuration){ambientDuration=duration;self.animation?.invalidate()}
          refreshTracks(self,()=>{if(!covered())ambientTracks.seek(ambientClock.time);syncMaterials()});
        }
      }});
      depth.fromTo(ambientClock,{time:0},{time:()=>ambientDuration,duration:1,onUpdate:()=>{if(!covered())ambientTracks.seek(ambientClock.time);syncMaterials()}},0);
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
      // Late image/font/layout changes must not remeasure and reset timelines
      // in the middle of an inertial touch scroll. Coalesce them at scrollEnd.
      const flushRefresh=()=>{refreshFrame=0;if(!alive||!refreshWanted||advancing||ST.isScrolling())return;refreshWanted=false;ST.refresh()};
      const refresh=()=>{refreshWanted=true;if(!refreshFrame)refreshFrame=requestAnimationFrame(flushRefresh)};
      const scrollEnded=()=>{if(!advancing&&refreshWanted&&!refreshFrame)refreshFrame=requestAnimationFrame(flushRefresh)};
      const interruptKey=e=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key))stopAdvance()};
      ST.addEventListener('scrollEnd',scrollEnded);
      window.addEventListener('wheel',stopAdvance,{passive:true});window.addEventListener('touchstart',stopAdvance,{passive:true});
      window.addEventListener('keydown',interruptKey);
      let dimensions=null;
      const observer=new ResizeObserver(entries=>{
        const rect=entries[0].contentRect,key=`${Math.round(rect.width*2)}:${Math.round(rect.height*2)}`;
        if(dimensions===null){dimensions=key;return}
        if(key!==dimensions){dimensions=key;refresh()}
      });observer.observe(host);
      host.addEventListener('load',refresh,true);window.addEventListener('afterprint',refresh);
      document.fonts?.ready.then(()=>{if(alive)refresh()});
      // A single shader owner receives the very same clocks as the existing
      // keyframes. It does not own a timeline, a ScrollTrigger or DOM transforms.
      materials=mountInvitationWebGL({host,card,state,openingRoot:root});
      lastProgress=null;sync();ST.refresh();ST.update();
      active={replay(){stopAdvance();scrollImmediately(0);ST.update();seal?.focus({preventScroll:true})}};
      return ()=>{
        alive=false;stopAdvance();active=null;materials?.destroy();observer.disconnect();cancelAnimationFrame(refreshFrame);host.inert=false;
        host.removeEventListener('load',refresh,true);window.removeEventListener('afterprint',refresh);
        ST.removeEventListener('scrollEnd',scrollEnded);
        window.removeEventListener('wheel',stopAdvance);window.removeEventListener('touchstart',stopAdvance);
        window.removeEventListener('keydown',interruptKey);
        if(ownsNativeClass)html.classList.remove('invitation-scroll-native');
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
  build();idleWhenReduced();
  return {
    replay(){
      if(matchMedia('(prefers-reduced-motion: reduce)').matches){showIntro(state,onActivate,{manual:true});return}
      if(!wantOpening){media.revert();wantOpening=true;build()}
      active?.replay();
    },
    destroy(){destroyed=true;suspend();gsap.removeEventListener('matchMedia',idleWhenReduced);window.removeEventListener('pagehide',suspend);window.removeEventListener('pageshow',resume)}
  };
}
