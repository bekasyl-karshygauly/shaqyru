import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());await page.goto('/create');await page.locator('#top-lang [data-l="ru"]').click()});
test('Wizard keeps existing settings and checks navigate back to missing fields',async({page})=>{
  await page.locator('#names').fill('Сохранённое имя');await page.locator('#wizard-toggle').click();await expect(page.locator('#sec-ev')).toBeVisible();await expect(page.locator('#sec-data')).toBeHidden();
  await page.locator('#wizard-next').click();await expect(page.locator('#sec-dsg')).toBeVisible();await page.locator('#wizard-next').click();await expect(page.locator('#names')).toHaveValue('Сохранённое имя');await page.locator('#date').fill('');await page.locator('#time').fill('');
  await page.locator('#wizard-next').click();await expect(page.locator('#invitation-check')).toContainText('Укажите дату');await page.getByRole('button',{name:'Укажите дату',exact:true}).click();await expect(page.locator('#date')).toBeFocused();await expect(page.locator('#sec-data')).toBeVisible();
  await page.locator('#wizard-toggle').click();await expect(page.locator('#sec-ev')).toBeVisible();await expect(page.locator('#sec-style')).toBeVisible();await expect(page.locator('#names')).toHaveValue('Сохранённое имя');
});
test('Review is advisory and localized; old date is detected',async({page})=>{
  await page.locator('#date').fill('2000-01-01');await page.locator('#check-invitation').click();await expect(page.locator('#invitation-check')).toContainText('Дата уже прошла');await expect(page.locator('#pvw')).toBeEnabled();
  await page.locator('#top-lang [data-l="kz"]').click();await page.locator('#check-invitation').click();await expect(page.locator('#invitation-check')).toContainText('Күні өтіп кетті');
});
test('Photo crop, rotation, cancel and malformed uploads preserve the draft',async({page})=>{
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=200;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,100,100);x.fillStyle='blue';x.fillRect(0,100,100,100);return c.toDataURL('image/png').split(',')[1]});
  await page.locator('#photo').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(page.locator('#photo-editor')).toBeVisible();const before=await page.locator('#photo-canvas').evaluate(c=>c.toDataURL());await page.locator('#photo-rotate').click();const rotated=await page.locator('#photo-canvas').evaluate(c=>c.toDataURL());expect(rotated).not.toBe(before);
  await page.locator('#photo-zoom').fill('2');await page.locator('#photo-x').fill('0.5');await page.locator('#photo-apply').click();await expect(page.locator('#photo-editor')).toBeHidden();const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).photo);expect(saved).toMatch(/^data:image\/jpeg;base64,/);
  await page.locator('#photo').setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#photo-cancel').click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).photo)).toBe(saved);
  await page.locator('#photo').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not a picture')});await expect(page.locator('#photo-feedback')).toContainText('файл повреждён');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).photo)).toBe(saved);
  await page.locator('#photo').setInputFiles({name:'unsafe.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await expect(page.locator('#photo-feedback')).toContainText('JPEG, PNG или WebP');
});
test('Wizard and photo dialog fit a narrow mobile viewport',async({page})=>{
  await page.setViewportSize({width:320,height:800});await page.locator('#wizard-toggle').click();await page.locator('#wizard-next').click();await page.locator('#wizard-next').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=10;return c.toDataURL('image/png').split(',')[1]});await page.locator('#photo').setInputFiles({name:'small.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await expect(page.locator('#photo-editor')).toBeVisible();const box=await page.locator('#photo-editor').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(321);await page.keyboard.press('Escape');await expect(page.locator('#photo-editor')).toBeHidden();
});
