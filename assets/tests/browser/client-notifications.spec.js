import {test,expect} from '@playwright/test';

const id='dddddddddddddddddddddddddddddddd',ownerToken='b'.repeat(48);
const sample={names:'Арман и Айгерім',lang:'ru',ev:0,dsg:0,date:'2027-06-12',time:'18:00',place:'Сад торжеств',addr:'Алматы',text:'Приглашаем на праздник.',scene:'none',anim:'soft',vc:0};
const consent=()=>({enabled:true,phone:'77001234567',consentedAt:'2026-10-28T08:00:00Z',consentVersion:'order-status-v1'});

// Every API request is intercepted: no real order, customer or provider is used.
async function fixture(context,{ready=false,existing=false,subscribed=false,published=false,guestPath='/arman-aigerim'}={}){
  const state={ready,data:{...sample},version:'version-1',revision:1,order:existing?{status:published?'published':'submitted',submittedAt:'2026-10-28T08:00:00Z',publishedAt:published?'2026-10-28T08:30:00Z':null,contact:{name:'Тестовый клиент',phone:'+7 700 123 45 67',email:'client@example.com'},note:'',price:2490,services:[],revisions:[],history:[],quote:null,approval:null,needsAgreement:false,notifications:{whatsapp:subscribed?consent():{enabled:false}}}:null,requests:[],statusReads:0,guestPath};
  const version=()=>state.version='version-'+(++state.revision);
  const result=()=>({order:state.order,version:state.version,paid:!!state.order?.publishedAt,paidTier:state.order?.publishedAt?4:0,guestPath:state.order?.publishedAt?state.guestPath:null});
  state.accept=(route,body)=>{if(body.version!==state.version||body.quoteId!==state.order?.quote?.id)return route.fulfill({status:409,json:{error:'Стоимость изменилась. Обновите заявку.'}});const at='2026-10-28T20:00:00Z';state.order={...state.order,status:'ready',price:state.order.quote.amount,quote:{...state.order.quote,acceptedAt:at},approval:{at,price:state.order.quote.amount,current:true,names:state.data.names,dsg:state.data.dsg}};version();return route.fulfill({json:result()})};
  await context.route('https://fonts.googleapis.com/**',route=>route.abort());await context.route('https://fonts.gstatic.com/**',route=>route.abort());
  await context.route('**/api/**',async route=>{
    const request=route.request(),p=new URL(request.url()).pathname,method=request.method(),body=method==='GET'?null:request.postDataJSON();
    state.requests.push({path:p,method,body});
    if(p.startsWith('/api/admin/')&&request.headers()['x-admin-key']!=='test-admin')return route.fulfill({status:403,json:{error:'Нет доступа'}});
    if(p==='/api/config')return route.fulfill({json:{orderMode:'manual',paymentsReady:false,rsvpDetailsReady:true,clientNotifications:{whatsapp:state.ready}}});
    if(p.startsWith('/api/account/'))return route.fulfill({json:{configured:false,storageReady:false,user:null}});
    if(p==='/api/services'||p.endsWith('/guests')||p==='/api/admin/services')return route.fulfill({json:[]});
    if(p==='/api/admin/list')return route.fulfill({json:{items:state.order?[{id,names:state.data.names,order:state.order}]:[],nextOffset:null}});
    if(p==='/api/admin/statistics')return route.fulfill({json:{total:state.order?1:0,published:state.order?.publishedAt?1:0,archived:0,agreed_amount:0,by_status:{},designs:[]}});
    if(p==='/api/admin/notifications')return route.fulfill({json:{publicUrl:true,queueReady:true,telegram:{configured:false},whatsapp:{configured:false},client:{configured:state.ready,enabled:state.ready,publicUrl:true,queueReady:true}}});
    if(p==='/api/admin/orders/'+id)return route.fulfill({json:{id,data:state.data,order:state.order,version:state.version,guestPath:state.guestPath,notifications:[],clientNotifications:[]}});
    if(p==='/api/inv'&&method==='POST'){state.data=body.data;return route.fulfill({json:{id,tok:ownerToken,version:state.version,paid:false}})}
    if(p==='/api/inv/'+id&&method==='PUT'){if(state.saveBehavior)return state.saveBehavior(route,body);if(body.version!==state.version)return route.fulfill({status:409,json:{error:'Версия изменилась',conflict:true}});state.data=body.data;version();return route.fulfill({json:result()})}
    if(p==='/api/inv/'+id+'/status'){state.statusReads++;if(state.failFirstStatus&&state.statusReads===1)return route.fulfill({status:503,json:{error:'Временный сбой сервера'}});return route.fulfill({json:{data:state.data,...result()}})}
    if(p==='/api/inv/'+id+'/order/accept'&&method==='POST')return state.acceptBehavior?state.acceptBehavior(route,body):state.accept(route,body);
    if(p==='/api/inv/'+id+'/order'&&method==='POST'){
      if(body.version!==state.version)return route.fulfill({status:409,json:{error:'Версия изменилась'}});
      state.order={...state.order,status:state.order?.status||'submitted',submittedAt:state.order?.submittedAt||'2026-10-28T08:00:00Z',publishedAt:null,contact:body.contact,note:body.note,price:2490,services:[],revisions:[],history:[],notifications:{whatsapp:body.notifications?.whatsapp?consent():{enabled:false}}};version();return route.fulfill({json:result()});
    }
    if(p==='/api/inv/'+id+'/order/notifications'&&method==='PUT'){
      if(body.version!==state.version)return route.fulfill({status:409,json:{error:'Версия изменилась'}});
      state.order.notifications={whatsapp:body.whatsapp?consent():{enabled:false}};version();return route.fulfill({json:result()});
    }
    if(p==='/api/admin/orders/'+id+'/workflow'){
      if(body.version!==state.version)return route.fulfill({status:409,json:{error:'Версия изменилась'}});
      state.order={...state.order,status:body.status,rejectionReason:body.rejectionReason||null};version();return route.fulfill({json:result()});
    }
    if(p.startsWith('/api/i/'))return route.fulfill({json:{data:state.data,preview:!state.order?.publishedAt,guest:null,rsvpDetailsReady:true}});
    return route.fulfill({json:{}});
  });return state;
}

async function seed(context){await context.addInitScript(({id,ownerToken,sample})=>localStorage.setItem('shq',JSON.stringify({...sample,id,tok:ownerToken,_dirty:false,_serverVersion:'version-1'})),{id,ownerToken,sample})}
async function openOrder(page,{existing=false,lang='ru'}={}){await page.goto('/create?lang='+lang);if(existing)await expect(page.locator('#editor-delivery-panel')).toHaveAttribute('data-delivery-state',/submitted|published/);await page.locator('#editor-delivery-panel [data-delivery-order]').click();await expect(page.locator('#order-dialog')).toBeVisible()}
async function login(page){await page.goto('/admin#order='+id);await page.locator('#k').fill('test-admin');await page.locator('#ld').click();await expect(page.locator('#admin-detail')).toBeVisible()}
async function quotedOrder(context){const state=await fixture(context,{existing:true});state.order={...state.order,status:'discussion',quote:{id:'quote-8990',amount:8990,note:'Дизайн и срочное изготовление',offeredAt:'2026-10-28T17:51:00Z'}};await seed(context);return state}
test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'})});

test('Price confirmation succeeds beside its button and works without AbortSignal.timeout',async({page,context})=>{
  const state=await quotedOrder(context);await context.addInitScript(()=>Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined}));await page.setViewportSize({width:390,height:844});await openOrder(page,{existing:true});
  await expect(page.locator('#client-quote-price')).toHaveText('8 990 ₸');await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();
  await expect(page.locator('#client-quote-feedback')).toContainText('Цена и вариант подтверждены');await expect(page.locator('#client-approval-state')).toContainText('Подтверждено');await expect(page.locator('#client-accept-quote')).toHaveText('Цена и вариант подтверждены');await expect(page.locator('#client-accept-quote')).toBeDisabled();
  await expect(page.locator('#client-quote-consent')).toBeChecked();
  expect(state.requests.filter(r=>r.path.endsWith('/order/accept'))).toHaveLength(1);expect(state.order.approval.price).toBe(8990);await page.locator('#client-quote').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-client-quote-confirmed.png'});
});

test('Slow price confirmation displays progress and cannot submit twice',async({page,context})=>{
  const state=await quotedOrder(context);let release;const gate=new Promise(resolve=>release=resolve);state.acceptBehavior=async(route,body)=>{await gate;return state.accept(route,body)};await openOrder(page,{existing:true});await page.locator('#client-quote-consent').check();const button=page.locator('#client-accept-quote');const width=(await button.boundingBox()).width;await button.click();
  await expect(button).toHaveText('Подтверждаем…');await expect(button).toHaveAttribute('aria-busy','true');await expect(button).toBeDisabled();await expect(page.locator('#client-quote-feedback')).toContainText('подтверждаем');expect(Math.abs((await button.boundingBox()).width-width)).toBeLessThanOrEqual(1);
  await button.evaluate(e=>{e.click();e.click()});await expect.poll(()=>state.requests.filter(r=>r.path.endsWith('/order/accept')).length).toBe(1);release();await expect(page.locator('#client-approval-state')).toContainText('Подтверждено');
});

test('A failed initial server load can recover through the order dialog and then confirm the price',async({page,context})=>{
  const state=await quotedOrder(context);state.failFirstStatus=true;await page.goto('/create?lang=ru');await expect(page.locator('#editor-delivery-panel [data-delivery-heading]')).toHaveText('Не удалось проверить готовность');
  await page.locator('#editor-delivery-panel [data-delivery-order]').click();await expect(page.locator('#client-quote-price')).toHaveText('8 990 ₸');await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();
  await expect(page.locator('#client-approval-state')).toContainText('Подтверждено');expect(state.requests.filter(r=>r.path.endsWith('/order/accept'))).toHaveLength(1);expect(state.order.approval.price).toBe(8990);
});

test('Initial-load recovery keeps conflicting dirty drafts protected',async({page,context})=>{
  const state=await quotedOrder(context);state.failFirstStatus=true;await context.addInitScript(()=>{const s=JSON.parse(localStorage.getItem('shq'));localStorage.setItem('shq',JSON.stringify({...s,names:'Мои несохранённые правки',_dirty:true,_serverVersion:'older-version'}))});await page.goto('/create?lang=ru');await expect(page.locator('#editor-delivery-panel [data-delivery-heading]')).toHaveText('Не удалось проверить готовность');
  await page.locator('#editor-delivery-panel [data-delivery-order]').click();await expect(page.locator('#client-quote-price')).toHaveText('8 990 ₸');await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();await expect(page.locator('#client-quote-error')).toContainText('конфликт');
  expect(state.requests.filter(r=>r.path.endsWith('/order/accept'))).toHaveLength(0);expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).names)).toBe('Мои несохранённые правки');
});

test('Changed quote errors stay beside the button and require fresh consent after refresh',async({page,context})=>{
  const state=await quotedOrder(context);state.acceptBehavior=route=>route.fulfill({status:409,json:{error:'Стоимость изменилась. Обновите заявку.'}});await openOrder(page,{existing:true});await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();
  await expect(page.locator('#client-quote-error')).toContainText('Стоимость изменилась');await expect(page.locator('#client-quote-error')).toBeInViewport();await expect(page.locator('#client-quote-recovery')).toHaveText('Обновить условия');
  state.order.quote={id:'quote-9990',amount:9990,offeredAt:'2026-10-28T20:00:00Z'};state.version='new-quote-version';await page.locator('#client-quote-recovery').click();await expect(page.locator('#client-quote-price')).toHaveText('9 990 ₸');await expect(page.locator('#client-quote-consent')).not.toBeChecked();expect(state.requests.filter(r=>r.path.endsWith('/order/accept'))).toHaveLength(1);
  state.acceptBehavior=null;await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();await expect(page.locator('#client-approval-state')).toContainText('Подтверждено');expect(state.order.approval.price).toBe(9990);
});

test('Save conflicts are visible at the quote and lead to the existing draft recovery without acceptance',async({page,context})=>{
  const state=await quotedOrder(context);state.saveBehavior=route=>route.fulfill({status:409,json:{error:'Приглашение изменилось в другой вкладке. Сохраните свой черновик и загрузите актуальную версию.',conflict:true}});await page.setViewportSize({width:390,height:844});await openOrder(page,{existing:true});await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();
  await expect(page.locator('#client-quote-error')).toContainText('другой вкладке');await expect(page.locator('#client-quote-error')).toBeInViewport();expect(state.requests.filter(r=>r.path.endsWith('/order/accept'))).toHaveLength(0);await page.screenshot({path:'preview-client-quote-conflict.png'});
  await page.locator('#client-quote-recovery').click();await expect(page.locator('#order-dialog')).not.toBeVisible();await expect(page.locator('#reload-server')).toBeFocused();await expect(page.locator('#edit-conflict')).toBeVisible();expect(state.order.approval).toBeNull();
});

test('Malformed confirmation responses cannot claim success',async({page,context})=>{
  const state=await quotedOrder(context);state.acceptBehavior=route=>route.fulfill({json:{}});await openOrder(page,{existing:true});await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();await expect(page.locator('#client-quote-error')).toContainText('Сервер не подтвердил');await expect(page.locator('#client-quote-error')).toBeInViewport();await expect(page.locator('#client-accept-quote')).toBeEnabled();await expect(page.locator('#client-approval-state')).not.toContainText('Подтверждено');expect(state.order.approval).toBeNull();
});

test('Missing agreement explains the action without making a save or acceptance request',async({page,context})=>{
  const state=await quotedOrder(context);await openOrder(page,{existing:true});await page.locator('#client-accept-quote').click();await expect(page.locator('#client-quote-error')).toContainText('Подтвердите согласие');await expect(page.locator('#client-quote-consent')).toBeFocused();expect(state.requests.filter(r=>r.path.endsWith('/order/accept')||r.path==='/api/inv/'+id&&r.method==='PUT')).toHaveLength(0);
});

test('Network failure during acceptance gives a readable local recovery',async({page,context})=>{
  const state=await quotedOrder(context);state.acceptBehavior=route=>route.abort('failed');await openOrder(page,{existing:true});await page.locator('#client-quote-consent').check();await page.locator('#client-accept-quote').click();await expect(page.locator('#client-quote-error')).toContainText('Не удалось связаться с сервером');await expect(page.locator('#client-quote-recovery')).toBeVisible();expect(state.order.approval).toBeNull();
});

test('Customer gets the guest link inside the already open order dialog after organizer publication',async({page,context})=>{
  const state=await fixture(context,{existing:true});await seed(context);
  await context.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.__orderCopiedLink=value}}));
  await page.setViewportSize({width:390,height:844});await openOrder(page,{existing:true});const delivery=page.locator('#order-guest-delivery');await expect(delivery).toBeHidden();
  state.order={...state.order,status:'published',publishedAt:'2026-10-28T20:00:00Z'};state.version='published-version';
  await page.locator('#order-refresh').click();await expect(page.locator('#order-dialog')).toBeVisible();await expect(delivery).toBeVisible();
  const url=new URL('/arman-aigerim',page.url()).href;await expect(delivery.locator('[data-delivery-url]')).toHaveValue(url);
  await delivery.locator('[data-delivery-copy]').click();expect(await page.evaluate(()=>window.__orderCopiedLink)).toBe(url);
  for(const name of ['whatsapp','telegram']){const href=await delivery.locator('[data-delivery-'+name+']').getAttribute('href');expect(href).not.toContain(ownerToken);expect(href).not.toMatch(/\/admin|\/create/)}
  await expect(delivery.locator('[data-delivery-open]')).toHaveAttribute('href',url);await delivery.scrollIntoViewIfNeeded();await page.screenshot({path:'preview-customer-published-link.png'});
});

test('Disconnected WhatsApp is unchecked and disabled; the customer can still submit an order',async({page,context})=>{
  const state=await fixture(context);await openOrder(page);const checkbox=page.locator('#order-whatsapp-consent');
  await expect(checkbox).not.toBeChecked();await expect(checkbox).toBeDisabled();await expect(page.locator('#order-notification-note')).toContainText('пока не подключены');
  await page.locator('#order-name').fill('Тестовый клиент');await page.locator('#order-email').fill('client@example.com');await page.locator('#order-submit').click();
  await expect(page.locator('#client-workflow-status')).toHaveText('Новая заявка');
  const submit=state.requests.find(r=>r.path==='/api/inv/'+id+'/order');expect(submit.body.notifications).toEqual({whatsapp:false});expect(state.order.contact.email).toBe('client@example.com');
  await page.locator('#order-notification-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-client-notifications-unconnected.png'});
});

test('Ready WhatsApp requires an explicit opt-in and keeps the server-returned consent',async({page,context})=>{
  const state=await fixture(context,{ready:true});await openOrder(page);const checkbox=page.locator('#order-whatsapp-consent');await expect(checkbox).toBeEnabled();await expect(checkbox).not.toBeChecked();
  await page.locator('#order-name').fill('Тестовый клиент');await page.locator('#order-phone').fill('+7 700 123 45 67');await checkbox.check();await page.locator('#order-submit').click();
  await expect(page.locator('#client-workflow-status')).toHaveText('Новая заявка');await expect(checkbox).toBeChecked();
  const submit=state.requests.find(r=>r.path==='/api/inv/'+id+'/order');expect(submit.body.notifications).toEqual({whatsapp:true});expect(state.order.notifications.whatsapp).toEqual(consent());
  await expect(page.locator('#order-notification-save')).toBeDisabled();
});

test('Existing consent can be revoked with the current version even while the provider is disconnected',async({page,context})=>{
  const state=await fixture(context,{existing:true,subscribed:true});await seed(context);await openOrder(page,{existing:true});const checkbox=page.locator('#order-whatsapp-consent');await expect(checkbox).toBeChecked();await expect(checkbox).toBeEnabled();
  await checkbox.uncheck();await page.locator('#order-notification-save').click();await expect(page.locator('#order-notification-feedback')).toContainText('отключены');
  const preference=state.requests.find(r=>r.path.endsWith('/order/notifications')),save=state.requests.find(r=>r.path==='/api/inv/'+id&&r.method==='PUT');
  expect(preference.method).toBe('PUT');expect(preference.body.whatsapp).toBe(false);expect(preference.body.version).not.toBe(save.body.version);expect(state.order.notifications.whatsapp.enabled).toBe(false);
  await expect(checkbox).not.toBeChecked();await expect(checkbox).toBeDisabled();
});

test('Background status polling preserves a customer preference that has not been saved',async({page,context})=>{
  const state=await fixture(context,{ready:true,existing:true,subscribed:true});await seed(context);await page.clock.install();await openOrder(page,{existing:true});const checkbox=page.locator('#order-whatsapp-consent');await expect(checkbox).toBeChecked();
  await checkbox.uncheck();const reads=state.statusReads;await page.clock.fastForward(31000);await expect.poll(()=>state.statusReads).toBeGreaterThan(reads);
  await expect(checkbox).not.toBeChecked();await expect(page.locator('#order-notification-save')).toBeEnabled();expect(state.requests.filter(r=>r.path.endsWith('/order/notifications'))).toHaveLength(0);
});

test('Changing a subscribed contact number clears consent until the customer explicitly opts in again',async({page,context})=>{
  const state=await fixture(context,{ready:true,existing:true,subscribed:true});await seed(context);await openOrder(page,{existing:true});await expect(page.locator('#order-whatsapp-consent')).toBeChecked();
  await page.locator('#order-phone').fill('+7 701 765 43 21');await expect(page.locator('#order-whatsapp-consent')).not.toBeChecked();
  await page.locator('#order-refresh').click();await expect(page.locator('#order-whatsapp-consent')).not.toBeChecked();expect(state.order.notifications.whatsapp.phone).toBe('77001234567');
});

test('Administrator must provide a customer-facing rejection reason before saving rejection',async({page,context})=>{
  const state=await fixture(context,{existing:true});await login(page);await page.locator('#admin-stage').selectOption('rejected');await expect(page.locator('#admin-rejection-reason')).toBeVisible();
  await page.locator('#admin-stage-form button').click();await expect(page.locator('#admin-workflow-error')).toContainText('Укажите причину');await expect(page.locator('#admin-rejection-reason')).toBeFocused();
  expect(state.requests.filter(r=>r.path.endsWith('/workflow'))).toHaveLength(0);
  await page.locator('#admin-rejection-reason').fill('Дата занята. Можем обсудить другой день.');await page.locator('#admin-stage-form button').click();
  await expect(page.locator('#admin-workflow-feedback')).toHaveText('Изменения сохранены');const change=state.requests.find(r=>r.path.endsWith('/workflow'));
  expect(change.body.status).toBe('rejected');expect(change.body.rejectionReason).toBe('Дата занята. Можем обсудить другой день.');await expect(page.locator('#admin-client-status-summary')).toContainText('Дата занята');
  await page.locator('#admin-client-status-summary').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-client-status-admin.png'});
});

test('Manual WhatsApp status opens only a customer compose URL and adds a clean public link after publication',async({page,context})=>{
  const state=await fixture(context,{existing:true,guestPath:'https://untrusted.example/steal?t='+ownerToken});await login(page);const link=page.locator('#admin-client-whatsapp');
  const icon=await link.locator('svg').boundingBox();expect(icon.width).toBeLessThanOrEqual(24);expect(icon.height).toBeLessThanOrEqual(24);
  let href=new URL(await link.getAttribute('href')),message=href.searchParams.get('text');expect(href.origin+href.pathname).toBe('https://wa.me/77001234567');expect(message).toContain('Заявка');expect(message).not.toMatch(/https?:|\/admin|\/create/);expect(message).not.toContain(ownerToken);
  state.order={...state.order,status:'published',publishedAt:'2026-10-28T09:00:00Z'};await page.locator('#admin-detail-refresh').click();await expect(page.locator('#admin-client-status-summary')).toContainText('опубликовано');
  href=new URL(await link.getAttribute('href'));message=href.searchParams.get('text');expect(message).toContain(new URL('/i/'+id,page.url()).href);expect(message).not.toContain('untrusted.example');expect(message).not.toContain(ownerToken);expect(message).not.toMatch(/\/admin|\/create|private-owner/);
  await expect(page.locator('#admin-client-whatsapp-note')).toContainText('ручная отправка');
});

test('Notification controls and rejection text stay localized without overflow on a narrow phone',async({page,context})=>{
  const state=await fixture(context,{ready:true,existing:true});state.order.status='rejected';state.order.rejectionReason='Уточните дату праздника.';await seed(context);await page.setViewportSize({width:390,height:844});await openOrder(page,{existing:true});
  await expect(page.locator('#order-notification-settings legend')).toHaveText('Уведомления о заявке');await expect(page.locator('#client-rejection-reason')).toContainText('Причина отказа: Уточните дату');
  expect(await page.locator('#order-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#order-close').click();await page.locator('#top-lang [data-l=kz]').click();await page.locator('#editor-delivery-panel [data-delivery-order]').click();
  await expect(page.locator('#order-notification-settings legend')).toHaveText('Өтінім туралы хабарламалар');await expect(page.locator('#order-whatsapp-consent').locator('..')).toContainText('WhatsApp арқылы');await expect(page.locator('#client-rejection-reason')).toContainText('Бас тарту себебі:');
  expect(await page.locator('#order-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator('#order-notification-settings').scrollIntoViewIfNeeded();await page.screenshot({path:'preview-client-notifications-mobile.png'});
});
