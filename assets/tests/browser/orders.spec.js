import {test,expect} from '@playwright/test';
import {PRICE,TIER} from '../../validate.js';
const id='abcdef0123456789abcdef0123456789';
async function fixture(context){let data={lang:'ru',names:'Арман и Айгерім',anim:'polaroid'},order=null,version='v1',published=false;const state={conflict:false,publishes:0,deliveryFailed:false,retries:0};
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  await context.route('**/api/**',async r=>{const path=new URL(r.request().url()).pathname,method=r.request().method(),body=r.request().postDataJSON();
    if(path==='/api/config')return r.fulfill({json:{orderMode:'manual',paymentsReady:false,rsvpDetailsReady:true}});
    if(path.startsWith('/api/account/'))return r.fulfill({json:{configured:false,storageReady:false,user:null}});
    if(path.startsWith('/api/admin/')&&r.request().headers()['x-admin-key']!=='test-admin')return r.fulfill({status:403,json:{error:'Нет доступа к кабинету'}});
    if(path==='/api/admin/notifications')return r.fulfill({json:{publicUrl:false,queueReady:true,telegram:{configured:false},whatsapp:{configured:false}}});
    if(path==='/api/admin/list')return r.fulfill({json:{items:order&&(!published||new URL(r.request().url()).searchParams.get('status')!=='submitted')?[{id,names:data.names,order}]:[],nextOffset:null}});
    if(path.endsWith('/publish')){if(state.conflict)return r.fulfill({status:409,json:{error:'Конфликт версий',conflict:true}});state.publishes++;published=true;order={...order,status:'published',publishedAt:new Date().toISOString()};version='published-v';return r.fulfill({json:{published:true,order,version}})}
    if(path.endsWith('/notifications/retry')){state.deliveryFailed=false;state.retries++;return r.fulfill({json:{ok:true}})}
    if(path==='/api/admin/orders/'+id)return r.fulfill({json:{id,data,order,version,notifications:state.deliveryFailed?[{channel:'telegram',status:'failed'}]:[]}});
    if(path==='/api/inv'&&method==='POST'){data=body.data;return r.fulfill({json:{id,tok:'a'.repeat(48),version,paid:false}})}
    if(path==='/api/inv/'+id&&method==='PUT'){data=body.data;version='saved-v';return r.fulfill({json:{version,paid:published,order}})}
    if(path.endsWith('/order')){order={status:'submitted',submittedAt:new Date().toISOString(),contact:body.contact,note:body.note,price:PRICE[TIER[data.dsg||0]]};version='submitted-v';return r.fulfill({json:{order,version}})}
    if(path.endsWith('/status'))return r.fulfill({json:{data,order,version,paid:published,paidTier:published?4:0}});
    if(path.endsWith('/guests'))return r.fulfill({json:[]});
    return r.fulfill({json:{}});
  });return state;
}
test('client submits contact and preview; organizer reviews and publishes; client receives guest links',async({page,context})=>{
  await fixture(context);await page.goto('/create?lang=ru');await page.locator('#names').fill('Арман и Айгерім');await page.locator('#buy').click();
  await expect(page.locator('#order-dialog')).toBeVisible();await expect(page.locator('#order-price')).toContainText('2 490');await expect(page.locator('#order-whatsapp')).toHaveText('WhatsApp');await expect(page.locator('#order-telegram svg')).toHaveCount(1);await expect(page.locator('#order-messengers details')).toBeHidden();await expect(page.locator('#order-telegram')).toHaveAttribute('href',/^https:\/\/t.me\/Bekasyl\?text=/);await page.locator('#order-submit').click();await expect(page.locator('#order-name')).toBeFocused();
  await page.locator('#order-name').fill('Айгерім');await page.locator('#order-phone').fill('+7 700 123 45 67');await page.locator('#order-note').fill('Согласуем детали праздника');await page.locator('#order-submit').click();await expect(page.locator('#order-state')).toContainText('на согласовании');
  for(const [selector,recipient]of [['#order-whatsapp','https://wa.me/77788562088'],['#order-telegram','https://t.me/Bekasyl']]){const link=new URL(await page.locator(selector).getAttribute('href'));expect(link.origin+link.pathname).toBe(recipient);expect(link.searchParams.get('text')).toContain('Айгерім');expect(link.searchParams.get('text')).toContain('/admin#order='+id);expect(link.searchParams.get('text')).toContain('Стоимость:');expect(link.searchParams.get('text')).toContain('Согласуем детали праздника');expect(link.searchParams.get('text')).not.toContain('a'.repeat(48))}
  await page.locator('#order-messengers summary').click();await expect(page.locator('.order-message')).toContainText('Согласуем детали праздника');await page.locator('#order-messengers summary').click();await page.locator('#order-telegram').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-order-messengers.jpg'});await page.keyboard.press('Escape');await expect(page.locator('#buy')).toHaveText('Заявка отправлена');
  const admin=await context.newPage();await admin.goto('/admin#order='+id);await admin.locator('#k').fill('wrong');await admin.locator('#ld').click();await expect(admin.locator('#admin-status')).toContainText('Нет доступа');
  await admin.locator('#k').fill('test-admin');await admin.locator('#ld').click();await expect(admin.locator('#admin-login')).toBeHidden();await expect(admin.locator('#admin-detail')).toBeVisible();await expect(admin.locator('#admin-contact')).toContainText('Айгерім');await expect(admin.frameLocator('#admin-preview').locator('.nm')).toHaveText('Арман и Айгерім');
  await admin.locator('#admin-publish').click();await expect(admin.locator('#admin-detail-status')).toContainText('опубликовано');await expect(admin.locator('#admin-publish')).toBeHidden();await expect(admin.locator('#admin-guest-link')).toHaveAttribute('href','/i/'+id);await admin.keyboard.press('Escape');
  await page.locator('#buy').click();await page.locator('#order-refresh').click();await expect(page.locator('#order-state')).toContainText('опубликовано');await page.keyboard.press('Escape');await expect(page.locator('#gs')).toBeVisible();await page.locator('#gs').click();await expect(page.locator('#gl')).toContainText('Общая ссылка');
  await admin.locator('#order-filter').selectOption('published');await expect(admin.locator('.order-item')).toHaveCount(1);await admin.screenshot({path:'preview-manual-orders.jpg',fullPage:false});await admin.close();
});

test('design prices match the selected tier in gallery, footer, order and messenger text',async({page,context})=>{
  await fixture(context);await page.goto('/create?lang=ru');
  await expect(page.locator('#gal .g')).toHaveCount(30);await expect(page.locator('#gal .g').first()).toContainText('2 490 ₸');
  await page.locator('#gal [data-i="19"]').click();await expect(page.locator('#pr')).toHaveText('8 990 ₸');await page.locator('#buy').click();await expect(page.locator('#order-price')).toContainText('8 990 ₸');
  await page.locator('#order-name').fill('Клиент');await page.locator('#order-email').fill('client@example.com');await page.locator('#order-submit').click();await expect(page.locator('#order-state')).toContainText('на согласовании');
  const text=new URL(await page.locator('#order-telegram').getAttribute('href')).searchParams.get('text');expect(text).toContain('Стоимость: 8 990 ₸');expect(text).toContain('Дизайн: Изумруд');
});

test('admin can retry a failed alert while publication still requires approval',async({page,context})=>{
  const state=await fixture(context);await page.goto('/create?lang=ru');await page.locator('#buy').click();await page.locator('#order-name').fill('Клиент');await page.locator('#order-email').fill('client@example.com');await page.locator('#order-submit').click();await expect(page.locator('#order-state')).toContainText('на согласовании');
  state.deliveryFailed=true;await page.goto('/admin#order='+id);await page.locator('#k').fill('test-admin');await page.locator('#ld').click();
  await expect(page.locator('#admin-delivery')).toContainText('Не удалось отправить');await page.locator('#admin-retry-alerts').click();await expect(page.locator('#admin-detail-status')).toContainText('поставлена в очередь');await expect(page.locator('#admin-retry-alerts')).toBeHidden();expect(state.retries).toBe(1);expect(state.publishes).toBe(0);await expect(page.locator('#admin-publish')).toBeVisible();
});
test('narrow order form preserves input on failure, supports Kazakh and admin refuses a stale publication',async({page,context})=>{
  const state=await fixture(context);await page.setViewportSize({width:390,height:844});await page.goto('/create?lang=ru');await page.locator('#buy').click();await page.locator('#order-name').fill('Клиент');await page.locator('#order-email').fill('client@example.com');
  await page.route('**/api/inv/*/order',r=>r.fulfill({status:503,json:{error:'Сервер временно недоступен'}}));await page.locator('#order-submit').click();await expect(page.locator('#order-error')).toContainText('временно недоступен');await expect(page.locator('#order-name')).toHaveValue('Клиент');await expect(page.locator('#order-email')).toHaveValue('client@example.com');await page.unroute('**/api/inv/*/order');
  await page.locator('#order-submit').click();await page.keyboard.press('Escape');
  await page.locator('#top-lang [data-l="kz"]').click();await expect(page.locator('[data-support-contacts] h2')).toHaveText('Көмек керек пе?');await page.locator('#buy').click();await expect(page.locator('#order-title')).toHaveText('Тапсырысты келісу');await expect(page.locator('#order-name')).toHaveValue('Клиент');expect(new URL(await page.locator('#order-telegram').getAttribute('href')).searchParams.get('text')).toContain('Өтінім:');expect(await page.evaluate(()=>document.querySelector('#order-dialog').scrollWidth<=document.querySelector('#order-dialog').clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);await page.locator('#order-telegram').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-order-messengers-mobile.jpg'});await page.keyboard.press('Escape');
  await page.goto('/admin');await page.locator('#k').fill('test-admin');await page.locator('#ld').click();await page.getByRole('button',{name:'Открыть заявку',exact:true}).click();state.conflict=true;await page.locator('#admin-publish').click();await expect(page.locator('#admin-detail-status')).toContainText('Клиент изменил');expect(state.publishes).toBe(0);await expect(page.locator('#admin-publish')).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('support contacts stay consistent on homepage and library, including Kazakh homepage',async({page,context})=>{
  await fixture(context);await page.setViewportSize({width:390,height:844});await page.goto('/');
  const support=page.locator('[data-support-contacts]');await expect(support.locator('h2')).toHaveText('Нужна помощь?');
  await expect(support.locator('[data-messenger="whatsapp"]')).toHaveAttribute('href',/^https:\/\/wa.me\/77788562088\?text=/);
  await page.locator('[data-lang="kz"]').click();await expect(support.locator('h2')).toHaveText('Көмек керек пе?');
  await expect(support.locator('[data-messenger="telegram"]')).toHaveText('Telegram');await expect(support).not.toContainText('@Bekasyl');await expect(support.locator('svg')).toHaveCount(2);
  await page.goto('/library.html');await expect(support.locator('h2')).toHaveText('Нужна помощь?');await expect(support.locator('[data-messenger="whatsapp"]')).toHaveText('WhatsApp');await expect(support).not.toContainText('+7 778');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
