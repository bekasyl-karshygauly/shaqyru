import {test,expect} from '@playwright/test';
const data={names:'Алия & Бек',lang:'ru',date:'2027-06-12',place:'Сад торжеств',addr:'Алматы',sch:'16:00 Церемония\n18:00 Ужин',scene:'garden',sceneDensity:'high',fx:'petals',cover:'/covers/wedding.jpg',ev:0,dsg:0};
test.beforeEach(async({page})=>{
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
});
async function open(page,anim='env'){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(/THREE\.WebGLProgram|shader error|Error compiling|ERROR: 0:\d+/i.test(message.text()))errors.push(message.text())});
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:{...data,anim},preview:false}}));
  await page.goto('/i/12345678');await expect(page.locator('.scroll-controlled')).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>!!window.ScrollTrigger?.getById('invitation-opening'))).toBe(true);
  return errors;
}
async function seek(page,p){
  await page.evaluate(p=>{const t=ScrollTrigger.getById('invitation-opening'),style=document.documentElement.style,old=style.scrollBehavior;style.scrollBehavior='auto';scrollTo({top:t.start+(t.end-t.start)*p,behavior:'auto'});ScrollTrigger.update();style.scrollBehavior=old},p);
  await expect.poll(()=>page.evaluate(()=>ScrollTrigger.getById('invitation-opening').progress)).toBeCloseTo(p,2);
}
const frame=(page,selector)=>page.locator(selector).first().evaluate(el=>{const s=getComputedStyle(el);return {transform:s.transform,opacity:s.opacity,clip:s.clipPath,times:el.getAnimations().map(a=>Math.round(a.currentTime))}});

for(const [anim,part]of Object.entries({env:'.efl',doors:'.door-l',scroll:'.sc-top',box:'.bx-lid',curtain:'.cl',heart:'.ht-l',flip:'.fl',portal:'.pt-core',cinema:'.scene-panel',album:'.scene-panel',iris:'.scene-panel',mosaic:'.scene-panel',polaroid:'.scene-panel',bloom:'.scene-panel',panorama:'.scene-panel',soft:'.scene-panel'})){
  test(`${anim} opens, holds, reverses and survives refresh`,async({page},info)=>{
    const errors=await open(page,anim);await seek(page,.22);const held=await frame(page,'.intro '+part);
    await page.waitForTimeout(90);expect(await frame(page,'.intro '+part)).toEqual(held);
    await seek(page,.7);expect(await frame(page,'.intro '+part)).not.toEqual(held);
    await seek(page,.15);await seek(page,.22);expect(await frame(page,'.intro '+part)).toEqual(held);
    await page.evaluate(()=>ScrollTrigger.refresh());expect(await frame(page,'.intro '+part)).toEqual(held);
    await seek(page,1);await expect(page.locator('.scroll-controlled')).toBeHidden();await expect(page.locator('.inv .nm')).toBeVisible();
    await seek(page,0);await expect(page.locator('.scroll-controlled')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    const ids=await page.evaluate(()=>ScrollTrigger.getAll().map(t=>t.vars.id));expect(new Set(ids).size).toBe(ids.length);
    expect(errors).toEqual([]);
    if(anim==='env'){await seek(page,.36);await page.screenshot({path:`preview-engine-${info.project.name}-opening.png`})}
  });
}

test('worker material cannot block HTML; unsupported worker retains compatible materials',async({page})=>{
  const errors=await open(page,'mosaic');await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await expect.poll(()=>page.locator('canvas[data-webgl-layer="opening"]').evaluateAll(nodes=>{
    const probe=document.createElement('canvas'),context=probe.getContext('2d',{willReadFrequently:true});
    return nodes.some(canvas=>{probe.width=canvas.width;probe.height=canvas.height;context.drawImage(canvas,0,0);const data=context.getImageData(0,0,probe.width,probe.height).data;for(let i=3;i<data.length;i+=28)if(data[i]>0)return true;return false});
  })).toBe(true);
  const backend=await page.locator('[data-webgl-backend]').getAttribute('data-webgl-backend');
  if(backend==='main'){
    await seek(page,.35);await expect.poll(()=>page.locator('[data-webgl-state]').getAttribute('data-webgl-opening')).toBe(await page.locator('.intro').getAttribute('data-progress'));
    expect(await page.locator('[data-webgl-state]').getAttribute('data-webgl-draw-calls')).toBe('1');expect(errors).toEqual([]);return;
  }
  expect(backend).toBe('worker');
  const workers=page.workers().filter(w=>w.url().includes('invitation-material-worker'));expect(workers).toHaveLength(1);
  await workers[0].evaluate(()=>{self.__hold=true;const original=self.createImageBitmap;self.createImageBitmap=function(...args){return self.__hold?new Promise(()=>{}):original.apply(this,args)}});
  // Even a deliberately suspended GPU crop cannot hold a scroll seek or HTML
  // opening. A real second tab/visibility change also cancels its generation.
  await seek(page,.45);const middle=await frame(page,'.intro .scene-panel');await seek(page,.2);expect(await frame(page,'.intro .scene-panel')).not.toEqual(middle);
  await workers[0].evaluate(()=>{self.__hold=false});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))});
  await expect.poll(()=>page.locator('[data-webgl-state]').getAttribute('data-webgl-opening')).toBe(await page.locator('.intro').getAttribute('data-progress'));
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('blocked module worker uses the existing renderer and keeps all opening tracks',async({page})=>{
  await page.addInitScript(()=>{window.Worker=class{constructor(){throw Error('blocked')}}});
  const errors=await open(page,'album');await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await expect(page.locator('[data-webgl-backend="main"]')).toHaveCount(1);
  await seek(page,.35);const middle=await frame(page,'.scene-panel');await seek(page,.7);await seek(page,.35);expect(await frame(page,'.scene-panel')).toEqual(middle);
  expect(errors).toEqual([]);
});

test('material tile crops stay isolated across presentation backends',async({page})=>{
  await page.route('**/__material-probe',r=>r.fulfill({body:'<!doctype html><title>Material crop check</title>',contentType:'text/html'}));await page.goto('/__material-probe');
  const pixels=await page.evaluate(async()=>{
    const {cropMaterialTiles}=await import('/invitation-material-tiles.js');
    const offscreen=typeof OffscreenCanvas!=='undefined',source=offscreen?new OffscreenCanvas(16,8):document.createElement('canvas');source.width=16;source.height=8;const context=source.getContext('2d');
    context.fillStyle='#ff0000';context.fillRect(0,0,8,8);context.fillStyle='#00ff00';context.fillRect(8,0,8,8);
    if(!offscreen)return [0,8].map(x=>{const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const read=canvas.getContext('2d');read.drawImage(source,x,0,8,8,0,0,8,8);return [...read.getImageData(4,4,1,1).data]});
    const image=source.transferToImageBitmap(),results=await cropMaterialTiles(image,[{index:0,x:0,y:0,width:8,height:8},{index:1,x:8,y:0,width:8,height:8}],new Map());
    image.close();return results.map(result=>{
      if(result.status!=='fulfilled')throw result.reason;
      const canvas=document.createElement('canvas');canvas.width=8;canvas.height=8;const bitmap=canvas.getContext('bitmaprenderer');
      if(bitmap)bitmap.transferFromImageBitmap(result.value.image);else{canvas.getContext('2d').drawImage(result.value.image,0,0);result.value.image.close()}
      const probe=document.createElement('canvas');probe.width=8;probe.height=8;const read=probe.getContext('2d');read.drawImage(canvas,0,0);return [...read.getImageData(4,4,1,1).data];
    });
  });
  expect(pixels).toEqual([[255,0,0,255],[0,255,0,255]]);
});

test('uncovered ambient particles resume at the exact clock and reverse after resize',async({page})=>{
  const errors=await open(page,'env');await seek(page,.2);
  const times=()=>page.locator('body>.living-scene i').evaluateAll(nodes=>nodes.map(el=>el.getAnimations().map(a=>Math.round(a.currentTime))));
  const covered=await times();await seek(page,.35);expect(await times()).toEqual(covered);
  await seek(page,.8);expect(await times()).not.toEqual(covered);const shown=await times();await page.waitForTimeout(80);expect(await times()).toEqual(shown);
  await seek(page,.96);await seek(page,.8);expect(await times()).toEqual(shown);
  await page.setViewportSize({width:844,height:390});await seek(page,.6);await page.setViewportSize({width:390,height:844});await seek(page,.8);
  expect(errors).toEqual([]);
});

test('Open button continues smoothly through a pending geometry refresh',async({page})=>{
  const errors=await open(page,'mosaic');
  await page.evaluate(()=>{const seal=document.querySelector('.intro .seal'),advance=seal.onclick;seal.onclick=event=>{requestAnimationFrame(()=>ScrollTrigger.refresh());advance(event)}});
  await page.locator('.intro .seal').click();await expect(page.locator('.intro')).toBeHidden();
  // The overlay finishes at 88% of the runway; let the native button scroll
  // finish its remaining pixels before testing an exact programmatic seek.
  await expect.poll(()=>page.evaluate(()=>!ScrollTrigger.isScrolling())).toBe(true);
  await seek(page,.3);await expect(page.locator('.intro')).toBeVisible();expect(errors).toEqual([]);
});

test('reduced motion, restoration and replay release the old worker',async({page})=>{
  const errors=await open(page,'bloom');await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await seek(page,.5);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.intro')).toHaveCount(0);
  expect(await page.evaluate(()=>ScrollTrigger.getAll().length)).toBe(0);await expect(page.locator('.inv .nm')).toBeVisible();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('.intro')).toHaveCount(1);await seek(page,.4);
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide')));await expect(page.locator('.intro')).toHaveCount(0);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await seek(page,.4);await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  const backend=await page.locator('[data-webgl-backend]').getAttribute('data-webgl-backend');
  expect(page.workers().filter(w=>w.url().includes('invitation-material-worker'))).toHaveLength(backend==='worker'?1:0);expect(errors).toEqual([]);
});
