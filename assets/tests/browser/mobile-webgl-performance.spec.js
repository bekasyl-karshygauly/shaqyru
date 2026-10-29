import {test,expect} from '@playwright/test';

const data={names:'Алия & Бек',lang:'ru',date:'2027-06-12',place:'Сад торжеств',addr:'Алматы',scene:'garden',cover:'/covers/wedding.jpg',ev:0,dsg:0,anim:'mosaic'};

async function installProbe(page){
  await page.addInitScript(()=>{
    // This probe verifies the retained compatible renderer. Dedicated engine
    // tests separately verify off-main rendering and one worker ownership.
    window.Worker=undefined;
    const seen=new WeakSet();window.__materialGpuDraws=0;
    for(const prototype of [HTMLCanvasElement.prototype,window.OffscreenCanvas?.prototype].filter(Boolean)){
      const getContext=prototype.getContext;
      prototype.getContext=function(kind,...args){
        const context=getContext.call(this,kind,...args);
        if(kind==='webgl2'&&context&&!seen.has(context)){
          seen.add(context);
          for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
            const draw=context[name];context[name]=function(...values){window.__materialGpuDraws++;return draw.apply(this,values)};
          }
        }
        return context;
      };
    }
  });
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.route('**/api/i/**',r=>r.fulfill({json:{data,preview:false}}));
}

async function state(page){
  return page.evaluate(()=>{
    const host=document.querySelector('[data-webgl-state]');
    return {gpuDraws:window.__materialGpuDraws,frames:Number(host?.dataset.webglFrame),
      calls:Number(host?.dataset.webglDrawCalls),width:Number(host?.dataset.webglAtlasWidth),height:Number(host?.dataset.webglAtlasHeight)};
  });
}

async function seek(page,value){
  await page.evaluate(p=>{const trigger=ScrollTrigger.getById('invitation-opening');scrollTo({top:trigger.start+(trigger.end-trigger.start)*p,behavior:'instant'});ScrollTrigger.update()},value);
  await expect.poll(()=>page.evaluate(()=>{
    const host=document.querySelector('[data-webgl-state]'),intro=document.querySelector('.intro');
    return host?.dataset.webglState==='ready'&&host.dataset.webglOpening===intro?.dataset.progress;
  })).toBe(true);
  // Let the final async bitmap transfer settle before counting complete frames.
  await page.waitForTimeout(80);
}

test('Mosaic material paints all visible flaps in one draw per changed frame',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await installProbe(page);await page.goto('/i/12345678');
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await seek(page,.18);const before=await state(page);
  expect(await page.locator('canvas[data-webgl-layer="opening"]').count()).toBeGreaterThan(8);
  for(const value of [.34,.56,.23,.44])await seek(page,value);
  // A real network image load can schedule the one deferred geometry refresh
  // at scrollEnd. Let that legitimate final frame settle before testing idle.
  await expect.poll(()=>page.locator('.intro img,.inv img').evaluateAll(images=>images.every(image=>image.complete))).toBe(true);
  await expect.poll(()=>page.evaluate(()=>!ScrollTrigger.isScrolling())).toBe(true);
  await page.waitForTimeout(150);
  const after=await state(page);
  expect(after.frames).toBeGreaterThan(before.frames);
  expect(after.gpuDraws-before.gpuDraws).toBe(after.frames-before.frames);
  expect(after.calls).toBe(1);
  expect(after.width*after.height).toBeLessThanOrEqual(360000);
  await page.waitForTimeout(120);expect(await state(page)).toEqual(after);
  expect(errors).toEqual([]);
  await test.info().attach('mobile-atlas-draw-budget',{body:JSON.stringify({before,after}),contentType:'application/json'});
});

test('Real mobile dvh panel resizing does not reallocate every material surface',async({browser})=>{
  const context=await browser.newContext({viewport:{width:390,height:740},isMobile:true,hasTouch:true,deviceScaleFactor:3,reducedMotion:'no-preference'});
  const page=await context.newPage();
  try{
    await installProbe(page);await page.goto('/i/12345678');
    await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);await seek(page,.35);
    const before=await state(page),stageHeight=await page.locator('.scene-stage').evaluate(node=>node.clientHeight);
    const sizes=await page.locator('canvas[data-webgl-layer]').evaluateAll(nodes=>nodes.map(node=>[node.width,node.height]));
    // This changes CSS 66dvh and triggers the actual surface ResizeObserver.
    // 740px starts below the stage's max-height cap, so the assertion cannot
    // pass just because the CSS box happened to keep the same dimensions.
    await page.setViewportSize({width:390,height:700});
    await expect.poll(()=>page.locator('.scene-stage').evaluate(node=>node.clientHeight)).toBeLessThan(stageHeight-20);
    await expect.poll(async()=>(await state(page)).frames).toBeGreaterThan(before.frames);
    await page.waitForTimeout(80);const after=await state(page);
    expect([after.width,after.height]).toEqual([before.width,before.height]);
    expect(await page.locator('canvas[data-webgl-layer]').evaluateAll(nodes=>nodes.map(node=>[node.width,node.height]))).toEqual(sizes);
    await seek(page,.52);expect((await state(page)).calls).toBe(1);
    // A large viewport change must still allocate the appropriate new atlas.
    await page.setViewportSize({width:700,height:390});await seek(page,.4);
    await expect.poll(async()=>{const current=await state(page);return current.width!==before.width||current.height!==before.height}).toBe(true);
  }finally{await context.close()}
});

test('Returning to the page can paint the latest scroll while an old crop is suspended',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{
    const create=window.createImageBitmap;window.__blockedMaterialCrops=[];
    window.createImageBitmap=function(...args){
      if(!window.__holdMaterialCrop)return create.apply(this,args);
      return new Promise((resolve,reject)=>window.__blockedMaterialCrops.push(()=>create.apply(this,args).then(resolve,reject)));
    };
  });
  await installProbe(page);await page.goto('/i/12345678');
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);await seek(page,.25);
  const before=await state(page);
  await page.evaluate(()=>{
    window.__holdMaterialCrop=true;
    const trigger=ScrollTrigger.getById('invitation-opening');
    scrollTo({top:trigger.start+(trigger.end-trigger.start)*.47,behavior:'instant'});ScrollTrigger.update();
  });
  await expect.poll(()=>page.evaluate(()=>window.__blockedMaterialCrops.length)).toBeGreaterThan(0);
  await page.evaluate(()=>{
    Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
    window.__holdMaterialCrop=false;delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(async()=>(await state(page)).frames).toBeGreaterThan(before.frames);
  await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>document.querySelector('[data-webgl-state]').dataset.webglOpening===document.querySelector('.intro').dataset.progress)).toBe(true);
  await page.evaluate(()=>{for(const release of window.__blockedMaterialCrops.splice(0))release()});
  await page.waitForTimeout(80);await expect(page.locator('[data-webgl-state="ready"]')).toHaveCount(1);
});
