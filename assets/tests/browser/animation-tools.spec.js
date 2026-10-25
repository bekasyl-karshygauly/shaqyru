import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());
  await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.emulateMedia({reducedMotion:'reduce'});
});
async function choose(page,id){await page.locator(`#animg [data-a="${id}"]`).click();await expect(page.locator('.photo-intro')).toBeVisible();await page.keyboard.press('Escape')}
test('favorites persist; trying another opening does not change the invitation',async({page})=>{
  await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await page.locator('#names').fill('Арман и Айгерім');
  await choose(page,'album');await page.locator('.animation-favorite-current').click();
  await choose(page,'cinema');await page.locator('.animation-favorite-current').click();
  await page.locator('.animation-shortlist summary').click();await expect(page.locator('.animation-saved')).toHaveCount(2);
  const album=page.locator('[data-saved-animation="album"]');
  await album.locator('[data-action="preview"]').click();await expect(page.locator('.scene-album')).toBeVisible();await page.keyboard.press('Escape');
  await expect(album.locator('[data-action="preview"]')).toBeFocused();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).anim)).toBe('cinema');
  await expect(page.locator('#animg [data-a="cinema"]')).toHaveAttribute('aria-pressed','true');
  await album.locator('[data-action="choose"]').click();await expect(album.locator('[data-action="choose"]')).toBeFocused();
  await expect(page.locator('#animg [data-a="album"]')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#names')).toHaveValue('Арман и Айгерім');
  await page.reload();await page.locator('.animation-shortlist summary').click();await expect(page.locator('.animation-saved')).toHaveCount(2);await expect(page.locator('#animg [data-a="album"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#animation-only-favorites').check();await expect(page.locator('#animg .anb')).toHaveCount(2);
  await page.locator('#animation-search').fill('несуществующая анимация');await expect(page.locator('.animation-no-results')).toBeVisible();
  await page.locator('#animation-search').fill('');await page.locator('[data-saved-animation="album"] [data-action="remove"]').click();await expect(page.locator('[data-saved-animation="cinema"] [data-action="remove"]')).toBeFocused();
  await page.locator('[data-saved-animation="cinema"] [data-action="remove"]').click();await expect(page.locator('.animation-shortlist summary')).toBeFocused();await expect(page.locator('.animation-empty')).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).anim)).toBe('album');
});
test('search combines with categories and uses both languages on narrow screens',async({page})=>{
  await page.setViewportSize({width:320,height:800});await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await page.locator('#animation-search').fill('альбом');await expect(page.locator('#animg .anb')).toHaveCount(1);await expect(page.locator('#animg [data-a="album"]')).toBeVisible();
  await page.locator('#anim-filter [data-group="Кино"]').click();await expect(page.locator('#anim-filter [data-group="Кино"]')).toBeFocused();await expect(page.locator('.animation-no-results')).toBeVisible();
  await page.locator('#animation-search').fill('');await expect(page.locator('#animg .anb')).toHaveCount(2);
  await page.locator('#anim-filter [data-group="Все"]').click();await page.locator('#top-lang [data-l="kz"]').click();await expect(page.getByLabel('Анимацияны табу',{exact:true})).toBeVisible();
  await page.locator('#animation-search').fill('альбом');await expect(page.locator('#animg .anb')).toHaveCount(1);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)}
});
test('blocked storage keeps favorites usable and explains that they are temporary',async({page})=>{
  await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='shq-favorite-animations')throw new DOMException('Blocked','QuotaExceededError');return original.call(this,key,value)}});
  await page.locator('.animation-favorite-current').click();await expect(page.locator('.animation-tools-status')).toContainText('до закрытия страницы');
  await page.locator('.animation-shortlist summary').click();await expect(page.locator('.animation-saved')).toHaveCount(1);
});
