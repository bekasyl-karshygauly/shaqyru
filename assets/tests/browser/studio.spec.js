import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort())});

test('Homepage and separate editor fit phones, tablets and desktop with a single visual identity',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const route of ['/?design=heritage','/create']){
    await page.goto(route);
    await expect(page.locator('[data-design-choice],#design-compare')).toHaveCount(0);
    for(const width of [320,390,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('input,textarea,select')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.id)}));
      expect(layout.scroll,JSON.stringify({route,...layout})).toBeLessThanOrEqual(width+1);expect(layout.clipped).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
});

test('Homepage has no editor, switches languages, and starts the selected occasion in the editor',async({page})=>{
  await page.goto('/');await expect(page.locator('#names,#pv,#act')).toHaveCount(0);await expect(page.locator('.hero-visual img')).toBeVisible();
  expect(await page.locator('.hero-visual img').evaluate(i=>i.complete&&i.naturalWidth>0)).toBe(true);
  await page.locator('[data-lang=kz]').click();await expect(page.locator('html')).toHaveAttribute('lang','kk');await expect(page.locator('[data-i18n=heroOne]')).toHaveText('Жақындарыңызды жинаңыз.');
  await page.locator('.birthday-card').click();await expect(page).toHaveURL(/\/create\?lang=kz#sec-dsg$/);await expect(page.locator('#ev [data-i="10"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#sec-data h3')).toHaveText('3. Той туралы мәліметтер');
});

test('Returning from home preserves the existing invitation even when another occasion is selected',async({page})=>{
  await page.goto('/create');await page.locator('#names').fill('Мой сохранённый праздник');const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')));
  await page.locator('.brand').click();await expect(page).toHaveURL(/\/$/);await page.locator('.birthday-card').click();
  await expect(page.locator('#names')).toHaveValue('Мой сохранённый праздник');const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')));expect(after.ev).toBe(before.ev);expect(after.dsg).toBe(before.dsg);
});

test('Mobile menu supports keyboard and Escape and FAQ expands',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');const menu=page.locator('.menu-toggle');await menu.focus();await menu.press('Enter');await expect(menu).toHaveAttribute('aria-expanded','true');await expect(page.locator('#site-nav')).toBeVisible();await page.keyboard.press('Escape');await expect(menu).toBeFocused();await expect(menu).toHaveAttribute('aria-expanded','false');
  await page.locator('.faq-list summary').first().click();await expect(page.locator('.faq-list details').first()).toHaveAttribute('open','');
});

test('Template search composes with categories and recovers from no results',async({page})=>{
  await page.goto('/create');await page.locator('#top-lang [data-l=ru]').click();const search=page.locator('#template-search');await search.fill('zzzz');await expect(page.locator('.template-empty')).toBeVisible();await expect(page.locator('#gal .g:visible')).toHaveCount(0);
  await page.locator('#fl [data-f="классика"]').click();await expect(page.locator('#gal .g:visible')).toHaveCount(0);await search.fill('');await expect(page.locator('.template-empty')).toBeHidden();expect(await page.locator('#gal .g:visible').count()).toBeGreaterThan(0);await page.locator('#fl [data-f="все"]').click();await expect(page.locator('#gal .g:visible')).toHaveCount(30);
});

test('Legacy owner links and payment returns reach the new editor',async({page})=>{
  await page.route('**/api/inv/12345678/status',r=>r.fulfill({json:{version:'legacy',paid:false,data:{names:'Восстановленное приглашение',lang:'ru'}}}));
  await page.goto('/#id=12345678&t='+'a'.repeat(48));await expect(page).toHaveURL(/\/create$/);await expect(page.locator('#names')).toHaveValue('Восстановленное приглашение');
  await page.goto('/?payment=return');await expect(page).toHaveURL(/\/create\?payment=return$/);await expect(page.locator('#buy')).toHaveText('Согласовать заказ');
});

test('Reduced motion disables homepage effects and mobile preview scrolls to the invitation',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
  await page.setViewportSize({width:390,height:844});await page.goto('/create');await page.locator('#mt-prev').click();await expect(page.locator('#pv')).toBeInViewport();expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBe(0);
});
