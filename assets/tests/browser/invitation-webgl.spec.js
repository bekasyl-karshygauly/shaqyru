import {test,expect} from '@playwright/test';

const invitation={names:'Алия & Бек',lang:'ru',date:'2027-06-12',place:'Сад торжеств',addr:'Алматы',sch:'16:00 Церемония\n18:00 Ужин',scene:'garden',cover:'/covers/wedding.jpg',ev:0,dsg:0,anim:'env'};
const layers='canvas[data-webgl-layer]';
test.describe.configure({timeout:45000});

async function intercept(page){
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:invitation,preview:false}}));
}
async function guest(page,anim='env'){
  await intercept(page);
  if(anim!==invitation.anim)await page.route('**/api/i/**',r=>r.fulfill({json:{data:{...invitation,anim},preview:false}}));
  await page.goto('/i/12345678');
  await expect.poll(()=>page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches||!!window.ScrollTrigger?.getById('invitation-opening'))).toBe(true);
}
async function ready(page){
  // This assertion deliberately fails when the test browser only exercised fallback.
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await expect.poll(()=>page.locator(layers).count()).toBeGreaterThan(1);
}
async function progress(page,value){
  await page.evaluate(p=>{const t=ScrollTrigger.getById('invitation-opening');scrollTo({top:t.start+(t.end-t.start)*p,behavior:'instant'});ScrollTrigger.update()},value);
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getById('invitation-opening').progress)).toBeCloseTo(value,2);
  // The shared render is coalesced once per browser frame after GSAP updates.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect.poll(()=>page.evaluate(()=>{
    const host=document.querySelector('[data-webgl-state]'),opening=document.querySelector('.intro');
    return host?.dataset.webglState!=='ready'||host?.dataset.webglOpening===opening?.dataset.progress;
  })).toBe(true);
}
async function frame(page){
  return page.locator(layers).evaluateAll(canvases=>{const probe=document.createElement('canvas'),context=probe.getContext('2d',{willReadFrequently:true});return canvases.map(canvas=>{
    probe.width=canvas.width;probe.height=canvas.height;context.drawImage(canvas,0,0);
    const bytes=context.getImageData(0,0,canvas.width,canvas.height).data;
    let hash=2166136261,visible=0;
    for(let i=0;i<bytes.length;i+=16){
      for(let c=0;c<4;c++)hash=Math.imul(hash^bytes[i+c],16777619);
      if(bytes[i+3]>0)visible++;
    }
    return {layer:canvas.dataset.webglLayer,width:canvas.width,height:canvas.height,hash:hash>>>0,visible,
      opening:Number(canvas.dataset.opening),card:Number(canvas.dataset.card),depth:Number(canvas.dataset.depth)};
  })});
}
async function renderFrame(page){
  return page.evaluate(()=>[...document.querySelectorAll('[data-webgl-frame]')].map(el=>el.dataset.webglFrame));
}
async function triggerIds(page){
  return page.evaluate(()=>ScrollTrigger.getAll().map(t=>t.vars.id).sort());
}
async function expectOnlyExistingTriggers(page){
  const ids=await triggerIds(page),sections=await page.locator('.scroll-section-track').count();
  expect(ids).toEqual(['invitation-opening','invitation-depth',...Array.from({length:sections},(_,i)=>'invitation-section-'+i)].sort());
}
function errors(page){
  const failures=[];page.on('pageerror',e=>failures.push(e.message));
  page.on('console',message=>{if(/THREE\.WebGLProgram|VALIDATE_STATUS|shader error|Error compiling|ERROR: 0:\d+/i.test(message.text()))failures.push(message.text())});
  return failures;
}

test('Real GLSL pixels follow the existing opening clock, hold and reverse',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});
  const failures=errors(page);await guest(page);await ready(page);await expectOnlyExistingTriggers(page);
  await progress(page,.32);const first=await frame(page);
  expect(first.some(surface=>surface.layer==='paper')).toBe(true);
  expect(first.some(surface=>surface.layer==='opening')).toBe(true);
  expect(first.some(surface=>surface.layer==='atmosphere')).toBe(true);
  expect(first.filter(surface=>surface.visible>0).length).toBeGreaterThan(1);
  expect(first.every(surface=>[surface.opening,surface.card,surface.depth].every(n=>Number.isFinite(n)&&n>=0&&n<=1))).toBe(true);
  const opening=await page.locator('.intro .efl').evaluate(el=>getComputedStyle(el).transform);
  await page.waitForTimeout(180);expect(await frame(page)).toEqual(first);
  const restingFrame=await renderFrame(page);await page.waitForTimeout(180);expect(await renderFrame(page)).toEqual(restingFrame);
  await progress(page,.68);const second=await frame(page);
  expect(second.map(surface=>surface.hash)).not.toEqual(first.map(surface=>surface.hash));
  expect(second.some(surface=>surface.opening>first[0].opening)).toBe(true);
  expect(await page.locator('.intro .efl').evaluate(el=>getComputedStyle(el).transform)).not.toBe(opening);
  await progress(page,.85);await progress(page,.12);await progress(page,.32);
  expect(await frame(page)).toEqual(first);
  expect(await page.locator('.intro .efl').evaluate(el=>getComputedStyle(el).transform)).toBe(opening);
  expect(await page.locator('.intro').evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState==='paused'))).toBe(true);
  await expectOnlyExistingTriggers(page);expect(failures).toEqual([]);
  await test.info().attach('shader-frame-proof',{body:JSON.stringify({first,second}),contentType:'application/json'});
  await progress(page,1);await expect(page.locator('.inv .nm')).toBeVisible();
});

test('Shader canvases do not intercept opening controls, guest fields or RSVP',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:390,height:844});
  let response=null;await page.route('**/api/rsvp/**',async r=>{response=r.request().postDataJSON();await r.fulfill({json:{ok:true}})});
  await guest(page,'album');await ready(page);
  expect(await page.locator(layers).evaluateAll(nodes=>nodes.every(canvas=>getComputedStyle(canvas).pointerEvents==='none'&&canvas.getAttribute('aria-hidden')==='true'))).toBe(true);
  await page.locator('.intro .intro-skip').click();await expect(page.locator('.intro')).toBeHidden();
  await page.locator('#guest-name').fill('Тестовый гость');await page.locator('#guest-note').fill('Будем вдвоём');
  await page.getByRole('button',{name:'Увеличить количество гостей'}).click();await page.locator('.rsvp-yes').click();
  await expect(page.locator('.rsvp-success')).toBeVisible();
  expect(response).toMatchObject({name:'Тестовый гость',note:'Будем вдвоём',status:'yes',cnt:2});
  await expectOnlyExistingTriggers(page);
});

test('High density mobile touch, rotation and resize retain bounded surfaces',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await context.newPage();const failures=errors(page);
  try{
    await guest(page,'bloom');await ready(page);const ids=await triggerIds(page);
    const session=await context.newCDPSession(page);
    const swipe=async(from,to)=>{
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:from}]});
      for(let i=1;i<=10;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:from+(to-from)*i/10}]});await page.waitForTimeout(20)}
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    await swipe(700,350);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
    await page.waitForTimeout(250);const down=await frame(page);
    await swipe(350,690);await expect.poll(async()=>Math.max(...(await frame(page)).map(s=>s.opening))).toBeLessThan(Math.max(...down.map(s=>s.opening)));
    for(const viewport of [{width:844,height:390},{width:320,height:740},{width:390,height:844}]){
      await page.setViewportSize(viewport);await page.evaluate(()=>ScrollTrigger.refresh());await progress(page,.4);
      const surfaces=await frame(page);expect(surfaces.length).toBeLessThanOrEqual(16);
      expect(surfaces.every(surface=>surface.width>0&&surface.height>0)).toBe(true);
      expect(surfaces.reduce((sum,s)=>sum+s.width*s.height,0)).toBeLessThanOrEqual(1_200_000);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      expect(await triggerIds(page)).toEqual(ids);
    }
    expect(failures).toEqual([]);
  }finally{await context.close()}
});

test('Reduced motion can toggle without duplicate GPU layers or lost HTML content',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await guest(page);
  await expect(page.locator('.inv .nm')).toBeVisible();await expect(page.locator(layers)).toHaveCount(0);
  expect(await page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(0);
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);await progress(page,.4);
  const count=await page.locator(layers).count(),ids=await triggerIds(page);
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator(layers)).toHaveCount(0);
  await expect(page.locator('.inv .nm')).toBeVisible();await expect(page.locator('.inv')).toHaveCSS('opacity','1');
  await page.emulateMedia({reducedMotion:'no-preference'});await ready(page);await progress(page,.4);
  await expect(page.locator(layers)).toHaveCount(count);expect(await triggerIds(page)).toEqual(ids);
  await expectOnlyExistingTriggers(page);
});

test('Hidden tabs, print and restored pages do not leave active hidden shader scenes',async({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await guest(page,'polaroid');await ready(page);await progress(page,.4);
  const count=await page.locator(layers).count(),ids=await triggerIds(page);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'))});
  await expect(page.locator('[data-webgl-state="suspended"]')).toHaveCount(1);
  const hidden=await renderFrame(page);await progress(page,.55);await page.waitForTimeout(150);expect(await renderFrame(page)).toEqual(hidden);
  await page.evaluate(()=>{delete document.hidden;delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'))});await ready(page);
  await page.emulateMedia({media:'print'});
  await expect(page.locator('.intro')).toBeHidden();await expect(page.locator('.inv .nm')).toBeVisible();
  expect(await page.locator(layers).evaluateAll(nodes=>nodes.every(n=>n.getClientRects().length===0||getComputedStyle(n).display==='none'||getComputedStyle(n).visibility==='hidden'))).toBe(true);
  const printed=await renderFrame(page);await page.waitForTimeout(150);expect(await renderFrame(page)).toEqual(printed);
  await page.emulateMedia({media:'screen'});await ready(page);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(page.locator(layers)).toHaveCount(0);expect(await page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await ready(page);await progress(page,.4);await expect(page.locator(layers)).toHaveCount(count);expect(await triggerIds(page)).toEqual(ids);
});

test('WebGL creation failure preserves the complete invitation and does not retry forever',async({page})=>{
  await page.addInitScript(()=>{
    window.__webglAttempts=0;
    window.Worker=undefined;
    for(const prototype of [HTMLCanvasElement.prototype,window.OffscreenCanvas?.prototype].filter(Boolean)){const original=prototype.getContext;prototype.getContext=function(kind,...args){if(/^(webgl2?|experimental-webgl)$/.test(kind)){window.__webglAttempts++;return null}return original.call(this,kind,...args)}}
  });
  await page.emulateMedia({reducedMotion:'no-preference'});const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await guest(page,'doors');await expect(page.locator('[data-webgl-state="fallback"]')).toHaveCount(1);
  await progress(page,.3);const doors=await page.locator('.door-l').evaluate(el=>getComputedStyle(el).transform);
  await progress(page,.6);expect(await page.locator('.door-l').evaluate(el=>getComputedStyle(el).transform)).not.toBe(doors);
  await progress(page,1);await expect(page.locator('.inv .nm')).toBeVisible();await expect(page.locator('#guest-name')).toBeEnabled();
  const attempts=await page.evaluate(()=>window.__webglAttempts);expect(attempts).toBeGreaterThan(0);expect(attempts).toBeLessThanOrEqual(8);
  await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__webglAttempts)).toBe(attempts);
  await expectOnlyExistingTriggers(page);expect(failures).toEqual([]);
});

test('Browsers without OffscreenCanvas keep the bounded compatible material path',async({page})=>{
  await page.addInitScript(()=>{window.OffscreenCanvas=undefined});
  await page.emulateMedia({reducedMotion:'no-preference'});const failures=errors(page);
  await guest(page);await ready(page);await progress(page,.3);
  expect(await page.locator(layers).evaluateAll(nodes=>nodes.every(n=>n.dataset.webglPresentation==='2d'))).toBe(true);
  expect((await frame(page)).some(surface=>surface.visible>0)).toBe(true);
  await progress(page,1);await expect(page.locator('.inv .nm')).toBeVisible();await expectOnlyExistingTriggers(page);expect(failures).toEqual([]);
});

test('GPU context loss clears the overlay and restoration uses the latest scroll position',async({page})=>{
  await page.addInitScript(()=>{
    window.__webglContexts=[];
    window.Worker=undefined;
    for(const prototype of [HTMLCanvasElement.prototype,window.OffscreenCanvas?.prototype].filter(Boolean)){const original=prototype.getContext;prototype.getContext=function(kind,...args){const value=original.call(this,kind,...args);if(/^(webgl2?|experimental-webgl)$/.test(kind)&&value&&!window.__webglContexts.includes(value))window.__webglContexts.push(value);return value}}
  });
  await page.emulateMedia({reducedMotion:'no-preference'});const failures=[];page.on('pageerror',e=>failures.push(e.message));
  await guest(page,'mosaic');await ready(page);await progress(page,.35);const ids=await triggerIds(page);
  const available=await page.evaluate(()=>{const gl=window.__webglContexts[0];window.__lostContext=gl?.getExtension('WEBGL_lose_context');return !!window.__lostContext});
  expect(available).toBe(true);
  await page.evaluate(()=>window.__lostContext.loseContext());await expect(page.locator('[data-webgl-state="fallback"]')).toHaveCount(1);
  await progress(page,.6);await expect(page.locator('.intro')).toBeVisible();
  expect((await frame(page)).every(surface=>surface.visible===0)).toBe(true);
  const stopped=await renderFrame(page);await page.waitForTimeout(150);expect(await renderFrame(page)).toEqual(stopped);
  await page.evaluate(()=>window.__lostContext.restoreContext());await ready(page);
  await expect.poll(async()=>(await frame(page)).some(surface=>surface.visible>0)).toBe(true);
  const restored=await frame(page);expect(restored.every(surface=>surface.opening>.35)).toBe(true);
  await progress(page,.2);await progress(page,.6);expect(await frame(page)).toEqual(restored);
  expect(await triggerIds(page)).toEqual(ids);expect(failures).toEqual([]);
});
