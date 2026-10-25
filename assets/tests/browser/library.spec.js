import {test,expect} from '@playwright/test';
test('separate drafts and copies retain their own content',async({page})=>{
  await page.goto('/create?lang=ru');await page.locator('#names').fill('Первый праздник');
  await page.locator('#library-link').click();await expect(page.locator('.draft-item h2')).toHaveText('Первый праздник');
  await page.getByRole('button',{name:'+ Новое приглашение',exact:true}).click();await page.locator('#names').fill('Второй праздник');
  await page.locator('#library-link').click();await expect(page.locator('.draft-item')).toHaveCount(2);
  const first=page.locator('.draft-item').filter({has:page.getByRole('heading',{name:'Первый праздник',exact:true})});await first.getByRole('button',{name:'Создать копию'}).click();await expect(page.locator('.draft-item')).toHaveCount(3);
  await page.locator('.draft-item').filter({has:page.getByRole('heading',{name:'Первый праздник — копия',exact:true})}).getByRole('link',{name:'Редактировать'}).click();await expect(page.locator('#names')).toHaveValue('Первый праздник — копия');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')));expect(saved.id).toBeUndefined();expect(saved.tok).toBeUndefined();
  await page.locator('#library-link').click();await first.getByRole('link',{name:'Редактировать'}).click();await expect(page.locator('#names')).toHaveValue('Первый праздник');
});
test('copy of a published invitation drops owner access and guest list',async({page})=>{
  await page.goto('/library.html');
  await page.evaluate(async()=>{const {saveDraft}=await import('/draft-store.js');await saveDraft('11111111-1111-4111-8111-111111111111',{id:'12345678',tok:'a'.repeat(48),names:'Той',paid:1,paidTier:4,closed:true,closeAt:'2027-01-01T10:00',_serverVersion:'v1'})});
  await page.route('**/api/inv/12345678/guests',route=>{expect(route.request().headers()['x-owner-token']).toBe('a'.repeat(48));return route.fulfill({json:[{name:'Арман',status:'yes',cnt:2}]})});
  await page.reload();await page.getByRole('button',{name:'Ответы гостей'}).click();await expect(page.locator('.draft-responses')).toContainText('Придут: 2');
  await page.getByRole('button',{name:'Создать копию'}).click();const copy=page.locator('.draft-item').filter({has:page.getByRole('heading',{name:'Той — копия',exact:true})});await expect(copy.getByRole('button',{name:'Ответы гостей'})).toHaveCount(0);await copy.getByRole('link',{name:'Редактировать'}).click();
  await expect(page.locator('#names')).toHaveValue('Той — копия');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')));expect(saved.id).toBeUndefined();expect(saved.tok).toBeUndefined();expect(saved.paid).toBe(0);expect(saved.closed).toBe(false);expect(saved._serverVersion).toBeNull();
});
