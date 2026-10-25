import {test,expect} from '@playwright/test';

const variants={auto:'.efl,.door-l,.sc-top,.bx-lid,.cl,.ht-l,.fl,.pt-core,.zm',env:'.efl',doors:'.door-l',scroll:'.sc-top',box:'.bx-lid',curtain:'.cl',heart:'.ht-l',flip:'.fl',portal:'.pt-core',cinema:'.scene-panel',album:'.scene-panel',iris:'.scene-panel',mosaic:'.scene-panel',polaroid:'.scene-panel',bloom:'.scene-panel',panorama:'.scene-panel',soft:'.scene-panel'};
const data={names:'Алия & Бек',lang:'ru',date:'2027-06-12',place:'Сад торжеств',addr:'Алматы',sch:'16:00 Церемония\n18:00 Ужин',scene:'garden',cover:'/covers/wedding.jpg',ev:0,dsg:0,anim:'env'};
test.beforeEach(async({page})=>{
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.emulateMedia({reducedMotion:'no-preference'});
});
async function guest(page,anim='env',extra={}){
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:{...data,anim,...extra},preview:false}}));
  await page.goto('/i/12345678');await expect(page.locator('.scroll-controlled')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>!!window.ScrollTrigger?.getById('invitation-opening'))).toBe(true);
}
async function progress(page,value){
  await page.evaluate(p=>{const t=ScrollTrigger.getById('invitation-opening');window.scrollTo({top:t.start+(t.end-t.start)*p,behavior:'instant'});ScrollTrigger.update()},value);
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getById('invitation-opening').progress)).toBeCloseTo(value,2);
}
async function frame(page,selector){return page.locator(selector).first().evaluate(el=>{
  const css=getComputedStyle(el);return {transform:css.transform,opacity:css.opacity,clip:css.clipPath,rotate:css.rotate,times:el.getAnimations().map(a=>Math.round(a.currentTime))};
})}

for(const [anim,part] of Object.entries(variants))test(`Saved opening ${anim} scrubs, holds and reverses`,async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await guest(page,anim);const first=await frame(page,'.intro '+part);
  await progress(page,.42);const middle=await frame(page,'.intro '+part);
  expect(middle).not.toEqual(first);
  await page.waitForTimeout(120);expect(await frame(page,'.intro '+part)).toEqual(middle);
  await page.evaluate(()=>ScrollTrigger.refresh());expect(await frame(page,'.intro '+part)).toEqual(middle);
  expect(await page.locator('.intro').evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.playState==='paused'))).toBe(true);
  await progress(page,.75);await progress(page,.18);await progress(page,.42);
  expect(await frame(page,'.intro '+part)).toEqual(middle);
  await progress(page,1);await expect(page.locator('.scroll-controlled')).toBeHidden();
  await progress(page,0);await expect(page.locator('.scroll-controlled')).toBeVisible();
  expect(await frame(page,'.intro '+part)).toEqual(first);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});

test('Card reveal, parallax and section text share reversible scroll progress',async({page})=>{
  await page.setViewportSize({width:390,height:844});await guest(page,'album');
  await progress(page,.65);const names=await frame(page,'.inv .nm');
  const depth=await page.locator('.bgp').evaluate(el=>getComputedStyle(el).translate);
  await progress(page,.8);expect(await frame(page,'.inv .nm')).not.toEqual(names);
  expect(await page.locator('.bgp').evaluate(el=>getComputedStyle(el).translate)).not.toBe(depth);
  await progress(page,.65);expect(await frame(page,'.inv .nm')).toEqual(names);
  const section=page.locator('#guest-place');
  const range=await section.evaluate(el=>{const st=ScrollTrigger.getAll().find(t=>t.trigger===el.parentElement);return {start:st.start,end:st.end}});
  const at=async p=>{await page.evaluate(({start,end,p})=>{scrollTo({top:start+(end-start)*p,behavior:'instant'});ScrollTrigger.update()},{...range,p});await page.waitForTimeout(40)};
  await at(.4);const half=await frame(page,'#guest-place h3');
  await page.waitForTimeout(180);expect(await frame(page,'#guest-place h3')).toEqual(half);
  await at(.9);expect(Number((await frame(page,'#guest-place h3')).opacity)).toBeGreaterThan(Number(half.opacity));
  await at(.4);expect(await frame(page,'#guest-place h3')).toEqual(half);
  await page.evaluate(()=>ScrollTrigger.refresh());expect(await frame(page,'#guest-place h3')).toEqual(half);
  const ids=await page.evaluate(()=>ScrollTrigger.getAll().map(t=>t.vars.id));expect(new Set(ids).size).toBe(ids.length);
  if(process.env.MOTION_SCREENSHOTS)await page.screenshot({path:'preview-scroll-mobile.jpg',fullPage:false});
});

test('Native wheel, keyboard skip, resize, reduced motion and lifecycle cleanup',async({page})=>{
  await page.setViewportSize({width:1280,height:800});await guest(page,'portal');
  await page.mouse.move(640,400);await page.mouse.wheel(0,240);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(100);
  const first=await frame(page,'.pt-ring');await page.mouse.wheel(0,-240);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);expect(await frame(page,'.pt-ring')).not.toEqual(first);
  await progress(page,.4);const count=await page.evaluate(()=>ScrollTrigger.getAll().length);
  await page.setViewportSize({width:844,height:390});
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(count);
  await page.keyboard.press('Escape');await expect(page.locator('.scroll-controlled')).toBeHidden();
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.intro')).toHaveCount(0);
  expect(await page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(0);
  await expect(page.locator('.inv')).toHaveCSS('opacity','1');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(count);
  await progress(page,.4);await page.emulateMedia({media:'print'});
  await expect(page.locator('.inv .nm')).toHaveCSS('opacity','1');await expect(page.locator('.intro')).toBeHidden();
  await page.emulateMedia({media:'screen'});
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));
  expect(await page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(0);await expect(page.locator('.intro')).toHaveCount(0);
  await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(count);
});

test('Mobile native touch scrolling opens and closes the same scene',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'no-preference'});
  const page=await context.newPage();
  try{
    await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());
    await guest(page,'bloom');const session=await context.newCDPSession(page);
    const swipe=async(from,to)=>{
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:190,y:from}]});
      for(let i=1;i<=12;i++){await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:190,y:from+(to-from)*i/12}]});await page.waitForTimeout(20)}
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    };
    await swipe(700,330);
    await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(150);
    await page.waitForTimeout(250);
    const down=await page.evaluate(()=>ScrollTrigger.getById('invitation-opening').progress);
    expect(down).toBeGreaterThan(.15);expect(down).toBeLessThan(1);
    const opening=await frame(page,'.scene-panel');
    await swipe(330,650);
    await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getById('invitation-opening').progress)).toBeLessThan(down);
    expect(await frame(page,'.scene-panel')).not.toEqual(opening);
    expect(await page.locator('.intro').evaluate(el=>getComputedStyle(el).touchAction)).toContain('pan-y');
    if(process.env.MOTION_SCREENSHOTS)await page.screenshot({path:'preview-scroll-touch.jpg'});
  }finally{await context.close()}
});

test('Full preview replays the scroll scene without duplicate controllers',async({page:preview})=>{
  await preview.setViewportSize({width:390,height:844});await preview.goto('/');
  const nonce=await preview.evaluate(data=>{const nonce=crypto.randomUUID();sessionStorage.setItem('shq-preview:'+nonce,JSON.stringify({...data,anim:'mosaic'}));return nonce},data);
  await preview.goto('/preview#'+nonce);
  await expect(preview.locator('.inv')).toBeVisible();await expect(preview.locator('.intro')).toHaveCount(0);
  await preview.getByRole('button',{name:'Проверить анимацию'}).click();
  await expect(preview.locator('.scene-mosaic')).toBeVisible();await progress(preview,.45);
  if(process.env.MOTION_SCREENSHOTS)await preview.screenshot({path:'preview-scroll-opening-half.jpg'});
  await preview.keyboard.press('Escape');await expect(preview.locator('.intro')).toBeHidden();
  const count=await preview.evaluate(()=>ScrollTrigger.getAll().length);
  await preview.getByRole('button',{name:'Проверить анимацию'}).click();
  await expect(preview.locator('.intro')).toBeVisible();expect(await preview.evaluate(()=>ScrollTrigger.getAll().length)).toBe(count);
  expect(await preview.locator('#guest-place').evaluate(el=>el.getAnimations().filter(a=>a.animationName==='vUp').length)).toBe(1);
  await expect(preview.locator('.intro .seal')).toBeFocused();
  await preview.locator('.intro .seal').click();await expect(preview.locator('.intro')).toBeHidden();
  await preview.close();
});

test('Small Kazakh invitation retains automatic zoom and responsive scroll geometry',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await guest(page,'auto',{dsg:2,lang:'kz'});await expect(page.locator('.intro-zoom')).toBeVisible();
  await expect(page.locator('.scroll-opening-hint')).toContainText('сырғытыңыз');
  const first=await frame(page,'.zm');await progress(page,.42);const half=await frame(page,'.zm');expect(half).not.toEqual(first);
  const profile=await page.evaluate(async()=>{
    const trigger=ScrollTrigger.getById('invitation-opening'),samples=[];
    for(let i=1;i<=30;i++){
      await new Promise(requestAnimationFrame);const start=performance.now();
      scrollTo({top:trigger.end*(.42+i/30*.4),behavior:'instant'});ScrollTrigger.update();
      samples.push(performance.now()-start);
    }
    const sorted=[...samples].sort((a,b)=>a-b);
    return {samples:samples.length,meanMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:Math.max(...samples)};
  });
  await test.info().attach('scroll-update-profile',{body:JSON.stringify(profile),contentType:'application/json'});
  console.log('Scroll update profile (desktop Chromium, 320px emulation):',JSON.stringify(profile));
  await progress(page,.42);expect(await frame(page,'.zm')).toEqual(half);
  await page.setViewportSize({width:740,height:320});await page.evaluate(()=>ScrollTrigger.refresh());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(740);
  await progress(page,1);await expect(page.locator('.intro')).toBeHidden();
  await progress(page,0);expect(await frame(page,'.zm')).toEqual(first);
});
