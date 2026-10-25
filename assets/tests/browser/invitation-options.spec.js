import {test,expect} from '@playwright/test';
test.beforeEach(async({page,context})=>{test.setTimeout(45000);await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());await page.emulateMedia({reducedMotion:'reduce'})});
test('compare A/B persists photos and animation, applies only styling and restores focus',async({page})=>{
  await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await page.locator('#intro-upload').setInputFiles('public/covers/wedding.jpg');await expect(page.locator('.intro-feedback')).toContainText('добавлено');
  await page.locator('#compare-save').click();await expect(page.locator('.compare-tools [role=status]')).toContainText('Вариант A сохранён');
  const original=await page.locator('#cac').inputValue();await page.locator('#cac').fill('#126688');await page.locator('#names').fill('Новый текст сохраняется');await page.locator('#animg [data-a="mosaic"]').click();
  await page.reload();await page.locator('#compare-open').click();await expect(page.locator('.compare-dialog')).toBeVisible();
  const frames=page.locator('.compare-frame');await expect(frames).toHaveCount(2);
  await expect(page.frameLocator('.compare-frame').first().locator('.nm')).toContainText('Новый текст сохраняется');
  await expect(page.locator('.compare-actions button').filter({hasText:'Показать открытие'}).first()).toBeEnabled();
  await page.locator('.compare-actions button').filter({hasText:'Показать открытие'}).first().click();
  await expect(page.frameLocator('.compare-frame').first().locator('.intro')).toBeVisible();
  await page.getByRole('button',{name:'Выбрать A',exact:true}).click();await expect(page.locator('#cac')).toHaveValue(original);await expect(page.locator('#names')).toHaveValue('Новый текст сохраняется');await expect(page.locator('#animg [data-a="auto"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#compare-open')).toBeFocused();
  await page.setViewportSize({width:320,height:800});await page.locator('#compare-open').click();expect(await page.locator('.compare-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await page.keyboard.press('Escape');await expect(page.locator('.compare-dialog')).not.toBeVisible();
});
test('author enables both languages and preview switches text without changing design',async({page})=>{
  await page.goto('/create?lang=ru');await page.locator('.language-editor summary').click();await page.locator('#guest-bilingual').check();await page.locator('#translation-text').fill('Қош келдіңіз, достар!');
  await page.locator('#names').fill('Айгерім & Арман');await page.reload();await page.locator('.language-editor summary').click();await expect(page.locator('#translation-text')).toHaveValue('Қош келдіңіз, достар!');
  const popup=page.waitForEvent('popup');await page.setViewportSize({width:1200,height:900});await page.locator('#pvw').click();const guest=await popup;await guest.getByRole('link',{name:'Қазақша',exact:true}).click();await expect(guest.locator('html')).toHaveAttribute('lang','kk');await expect(guest.locator('.cw')).toContainText('Қош келдіңіз, достар!');await expect(guest.locator('.cw')).toContainText('Айгерім & Арман');await guest.getByRole('link',{name:'Русский',exact:true}).click();await expect(guest.locator('html')).toHaveAttribute('lang','ru');await guest.close();
});
test('guest language switch keeps unsubmitted RSVP; QR prints only the personal guest link',async({page})=>{
  let sent;await page.route('**/api/i/**',r=>r.fulfill({json:{data:{lang:'ru',bilingual:true,translations:{kz:{text:'Қош келдіңіз!'}},rsvpQuestions:['children','diet','transfer'],anim:'soft'},preview:false,rsvpDetailsReady:true}}));await page.route('**/api/rsvp/**',r=>{sent=r.request().postDataJSON();return r.fulfill({json:{ok:true}})});
  await page.goto('/i/12345678?g=aaaaaaaaaa');await page.locator('#guest-name').fill('Алия');await page.locator('#guest-note').fill('Спасибо!');await page.locator('.cnt-btn').last().click();await page.locator('#rsvp-diet').fill('Без орехов');await page.locator('#rsvp-transfer').check();await page.getByRole('link',{name:'Қазақша',exact:true}).click();
  await expect(page.locator('#guest-name')).toHaveValue('Алия');await expect(page.locator('#guest-note')).toHaveValue('Спасибо!');await expect(page.locator('.cnt-val')).toHaveText('2');await expect(page.locator('#rsvp-diet')).toHaveValue('Без орехов');await expect(page.locator('#rsvp-transfer')).toBeChecked();
  await page.getByRole('button',{name:'QR / Басып шығару',exact:true}).click();await expect(page.locator('.qr-art svg')).toBeVisible();await expect(page.locator('.qr-url')).toHaveText(/\/i\/12345678\?g=aaaaaaaaaa$/);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'SVG жүктеу',exact:true}).click();expect((await download).suggestedFilename()).toBe('invitation-qr.svg');
  await page.evaluate(()=>{window.print=()=>{window.qrPrinted=getComputedStyle(document.querySelector('.qr-print-card')).display;window.qrOtherHidden=getComputedStyle(document.querySelector('#vg')).display}});await page.emulateMedia({media:'print'});await page.locator('.qr-actions button').nth(1).evaluate(b=>b.click());expect(await page.evaluate(()=>window.qrPrinted)).toBe('block');expect(await page.evaluate(()=>window.qrOtherHidden)).toBe('none');await page.emulateMedia({media:'screen'});await page.keyboard.press('Escape');
  await page.locator('.rsvp-yes').click();await expect(page.locator('.rsvp-success')).toBeVisible();expect(sent.name).toBe('Алия');expect(sent.cnt).toBe(2);expect(sent.details.diet).toBe('Без орехов');
});
