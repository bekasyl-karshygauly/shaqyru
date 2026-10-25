import {test,expect} from '@playwright/test';
const styles=['cinema','album','iris','mosaic','polaroid','bloom','panorama','soft'];
test.beforeEach(async({context})=>{await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort())});

test('Custom intro photo, crop and animation persist and reach the guest preview',async({page})=>{
  await page.goto('/create?lang=ru');
  await page.locator('#intro-upload').setInputFiles('public/covers/wedding.jpg');
  await expect(page.locator('.intro-feedback')).toHaveText('Фото заставки добавлено');
  await page.locator('#intro-x').fill('27');await page.locator('#intro-y').fill('65');
  await page.locator('#animg [data-a="album"]').click();
  await expect(page.locator('.photo-intro .scene-image img')).toHaveAttribute('src',/^data:image\/jpeg/);
  await page.keyboard.press('Escape');await page.reload();
  await expect(page.locator('#intro-x')).toHaveValue('27');await expect(page.locator('#intro-y')).toHaveValue('65');
  await expect(page.locator('#animg [data-a="album"]')).toHaveAttribute('aria-pressed','true');
  const popupPromise=page.waitForEvent('popup');await page.locator('#pvw').click();const guest=await popupPromise;
  await guest.getByRole('button',{name:'Проверить анимацию'}).click();
  await expect(guest.locator('.scene-album')).toBeVisible();await expect(guest.locator('.scene-image img')).toHaveAttribute('src',/^data:image\/jpeg/);
  await expect(guest.locator('.scene-image img')).toHaveCSS('object-position','27% 65%');await guest.keyboard.press('Escape');
  await page.locator('#intro-upload').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('bad image')});
  await expect(page.locator('.intro-feedback')).toContainText('Не удалось');await expect(page.locator('.intro-thumbnail')).toHaveAttribute('src',/^data:image\/jpeg/);
  await page.locator('.intro-remove').click();await page.reload();await expect(page.locator('.intro-remove')).toBeDisabled();
});

test('All new openings animate, close, and support reduced motion and keyboard cancellation',async({page})=>{
  test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/create?lang=ru');await page.emulateMedia({reducedMotion:'no-preference'});
  for(const id of styles){
    await page.locator(`#animg [data-a="${id}"]`).click();await expect(page.locator(`.scene-${id}`)).toBeVisible();
    await expect(page.locator('.photo-intro .seal')).toBeFocused();await test.step(`Play ${id}`,async()=>{await page.locator('.photo-intro .seal').click({timeout:5000})});
    expect(await page.evaluate(()=>document.querySelector('.photo-intro').getAnimations({subtree:true}).length)).toBeGreaterThan(1);
    await expect(page.locator('.photo-intro')).toHaveCount(0);await expect(page.locator(`#animg [data-a="${id}"]`)).toBeFocused();
  }
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#animg [data-a="soft"]').click();
  await expect(page.locator('.scene-motion')).toBeChecked();await page.locator('.scene-motion').uncheck();await page.locator('.photo-intro .seal').click();await expect(page.locator('.photo-intro')).toHaveCount(0);
  await page.locator('#animg [data-a="iris"]').click();await page.locator('.scene-motion').check();await page.locator('.photo-intro .seal').click();await page.keyboard.press('Escape');await expect(page.locator('.photo-intro')).toHaveCount(0);
  await page.locator('#anim-filter [data-group="Кино"]').click();await expect(page.locator('#animg button')).toHaveCount(2);await expect(page.locator('#animation-count')).toContainText('Диафрагма');
  expect(errors).toEqual([]);
});

test('Every photo opening moves when explicitly previewed with reduced motion enabled',async({page})=>{
  test.setTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});
  await page.setViewportSize({width:390,height:844});await page.goto('/create?lang=ru');
  for(const id of styles){
    const choice=page.locator(`#animg [data-a="${id}"]`);await choice.click();
    await expect(page.locator('.scene-motion')).toBeChecked();await page.locator('.photo-intro .seal').click();
    await expect.poll(()=>page.locator('.scene-panel').first().evaluate(el=>el.getAnimations().some(a=>a.playState==='running'&&a.currentTime>0))).toBe(true);
    // Check rendered movement, not merely the presence of an overlay.
    await expect.poll(()=>page.locator('.scene-panel').first().evaluate((el,kind)=>{
      const css=getComputedStyle(el);return kind==='soft'?Number(css.opacity)<1:kind==='iris'?css.clipPath!=='circle(150% at 50% 50%)':css.transform!=='none'&&css.transform!=='matrix(1, 0, 0, 1, 0, 0)';
    },id)).toBe(true);
    await expect(page.locator('.intro')).toHaveCount(0);await expect(choice).toBeFocused();
  }
});

const classicParts={auto:'.efl,.door-l,.sc-top,.bx-lid,.cl,.ht-l,.fl,.pt-core,.zm',env:'.efl',doors:'.door-l',scroll:'.sc-top',box:'.bx-lid',curtain:'.cl',heart:'.ht-l',flip:'.fl',portal:'.pt-core'};
for(const reducedMotion of ['no-preference','reduce'])test(`All classic openings animate and replay (${reducedMotion})`,async({page})=>{
  test.setTimeout(60000);await page.emulateMedia({reducedMotion});await page.setViewportSize({width:1280,height:720});await page.goto('/create?lang=ru');
  for(const [id,part] of Object.entries(classicParts)){
    const choice=page.locator(`#animg [data-a="${id}"]`);await choice.click();
    await expect(page.locator('.intro')).toBeVisible();
    expect(await page.locator('.intro').evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})).toEqual({x:0,y:0,width:1280,height:720});
    const moving=page.locator('.intro').locator(part);
    await page.locator('.intro .seal').click();
    await expect.poll(()=>moving.evaluate(el=>el.getAnimations().some(a=>a.transitionProperty==='transform'&&a.playState==='running'&&a.currentTime>0))).toBe(true);
    await expect(moving).not.toHaveCSS('transform','none');
    await expect(page.locator('.intro')).toHaveCount(0);await expect(choice).toBeFocused();
  }
  // Cancelling an active preview must not leave a timer that steals focus from its replacement.
  await page.locator('#animg [data-a="env"]').click();await page.locator('.intro .seal').click();await page.keyboard.press('Escape');
  await page.locator('#animg [data-a="doors"]').click();await page.waitForTimeout(2600);
  await expect(page.locator('.intro .seal')).toBeFocused();await page.keyboard.press('Escape');
  await expect(page.locator('#animg [data-a="doors"]')).toBeFocused();
});

test('Classic guest opening still respects reduced motion on automatic visits',async({page})=>{
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:{names:'Гости',lang:'ru',anim:'env'},preview:false}}));
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/i/12345678');
  await expect(page.locator('.inv')).toBeVisible();await expect(page.locator('.intro')).toHaveCount(0);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.reload();
  await expect(page.locator('.intro-env')).toBeVisible();await page.locator('.intro .seal').click();
  await expect.poll(()=>page.locator('.efl').evaluate(el=>el.getAnimations().some(a=>a.playState==='paused'&&a.currentTime>0))).toBe(true);
  await expect(page.locator('.intro')).toBeHidden();
  await page.evaluate(()=>{scrollTo({top:0,behavior:'instant'});ScrollTrigger.update()});
  await expect(page.locator('.intro')).toBeVisible();
});

test('Automatic zoom opening moves on mobile and can be stopped during playback',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  await page.goto('/create?lang=ru');await page.locator('#gal [data-i="2"]').click();
  await page.locator('#animg [data-a="auto"]').click();await page.locator('.intro .seal').click();
  await expect.poll(()=>page.locator('.zm').evaluate(el=>el.getAnimations().some(a=>a.transitionProperty==='transform'&&a.playState==='running'))).toBe(true);
  await page.locator('.intro-skip').click();await expect(page.locator('.intro')).toHaveCount(0);
  await expect(page.locator('#animg [data-a="auto"]')).toBeFocused();
});

test('Guest receives the saved opening and reduced motion skips automatic overlays',async({page})=>{
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:{names:'Фото гостя',lang:'ru',anim:'mosaic',introPhoto:'/covers/kyz_uzatu.jpg',introX:32,introY:71},preview:false}}));
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/i/12345678');await expect(page.locator('.scene-mosaic')).toBeVisible();await expect(page.locator('.scene-image img')).toHaveAttribute('src','/covers/kyz_uzatu.jpg');
  await page.keyboard.press('Escape');await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await expect(page.locator('.inv')).toBeVisible();await expect(page.locator('.intro')).toHaveCount(0);
});

test('Motion demo accepts a photo and remembers the selected scene on a narrow screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/invitation-motion.html');
  await page.locator('#intro-upload').setInputFiles('public/covers/kyz_uzatu.jpg');await expect(page.locator('.intro-feedback')).toContainText('добавлено');
  await page.locator('[data-scene="polaroid"]').click();await expect(page.locator('.scene-polaroid')).toBeVisible();await page.locator('.intro-skip').click();
  await page.reload();await expect(page.locator('[data-scene="polaroid"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('.intro-thumbnail')).toHaveAttribute('src',/^data:image\/jpeg/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
