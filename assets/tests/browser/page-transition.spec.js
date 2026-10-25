import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort())});
test('create link animates both pages, preserves the draft and clears the curtain on back',async({page})=>{
  const phases=[];await page.exposeFunction('recordTransition',phase=>phases.push(phase));
  await page.addInitScript(()=>{new MutationObserver(records=>{for(const r of records)if(r.attributeName==='data-page-transition'){const phase=r.target.getAttribute('data-page-transition');if(phase)window.recordTransition(phase)}}).observe(document,{subtree:true,attributes:true,attributeFilter:['data-page-transition']})});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');await page.locator('#names').fill('Сохранённые имена');await page.goto('/');
  await page.locator('.hero-actions .primary-link').click();await expect(page).toHaveURL(/\/create\?lang=ru$/);await expect(page.locator('#names')).toHaveValue('Сохранённые имена');
  await expect.poll(()=>phases.includes('leave')&&phases.includes('enter')&&phases.includes('reveal')).toBe(true);await expect(page.locator('html')).not.toHaveAttribute('data-page-transition');
  await page.goBack();await expect(page).toHaveURL(/\/$/);await expect(page.locator('html')).not.toHaveAttribute('data-page-transition');await expect(page.locator('.hero-actions .primary-link')).not.toHaveAttribute('aria-busy');
});
test('reduced motion keeps a real opacity transition without moving artwork',async({page})=>{
  const frames=[];await page.exposeFunction('recordFade',frame=>frames.push(frame));
  await page.addInitScript(()=>{
    new MutationObserver(()=>{
      const root=document.documentElement,phase=root?.dataset.pageTransition;
      if(phase!=='leave'&&phase!=='reveal')return;
      const cover=getComputedStyle(root,'::before'),art=getComputedStyle(root,'::after');
      window.recordFade({phase,name:cover.animationName,duration:cover.animationDuration,transform:cover.transform,art:art.display});
    }).observe(document,{subtree:true,attributes:true,attributeFilter:['data-page-transition']});
  });
  await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await page.locator('.hero-actions .primary-link').click();await expect(page.locator('#names')).toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-page-transition');
  await expect.poll(()=>frames.some(f=>f.phase==='leave')&&frames.some(f=>f.phase==='reveal')).toBe(true);
  for(const phase of ['leave','reveal']){
    const frame=frames.find(f=>f.phase===phase);
    expect(frame.name).toBe(phase==='leave'?'editor-cover-in':'editor-cover-out');
    expect(parseFloat(frame.duration)).toBeGreaterThan(0);
    expect(frame.transform).toBe('none');expect(frame.art).toBe('none');
  }
});
test('unavailable session storage never blocks navigation',async({page})=>{
  await page.goto('/');await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='shq-editor-transition')throw Error('Storage unavailable');return set.call(this,k,v)}});await page.locator('.hero-actions .primary-link').click();await expect(page.locator('#names')).toBeVisible();await expect(page.locator('html')).not.toHaveAttribute('data-page-transition');
});
test('opening in a new tab leaves the current page and transition state untouched',async({page})=>{
  await page.goto('/');await page.locator('.hero-actions .primary-link').evaluate(a=>a.target='_blank');const popup=page.waitForEvent('popup');await page.locator('.hero-actions .primary-link').click();const editor=await popup;await expect(editor.locator('#names')).toBeVisible();await expect(page).toHaveURL(/\/$/);await expect(page.locator('html')).not.toHaveAttribute('data-page-transition');await editor.close();
});
