import {test,expect} from '@playwright/test';
import path from 'node:path';

const first='aaaaaaaa',second='bbbbbbbb';
const blocked='Отметьте выполненными все правки перед публикацией.';
function orderRecord(id,names){return {id,data:{names,lang:'ru',date:'2027-06-12',time:'18:00',place:'Сад торжеств',anim:'fade',scene:'none',dsg:0},version:'version-1',guestPath:'/arman-aigerim',notifications:[],order:{status:'submitted',submittedAt:'2026-10-26T08:00:00Z',contact:{name:'Тестовый клиент',email:'client@example.com'},note:'',price:2490,services:[],revisions:[],history:[],needsAgreement:false,quote:null,approval:null}}}
async function fixture(context){
  const state={records:new Map([[first,orderRecord(first,'Первая заявка')],[second,orderRecord(second,'Другая заявка')]]),publishes:[],reads:[],publishBehavior:null};
  state.success=(route,record)=>{record.version='published-version';record.order={...record.order,status:'published',publishedAt:'2026-10-26T09:00:00Z'};return route.fulfill({json:{published:true,version:record.version,order:record.order,guestPath:record.guestPath}})};
  await context.route('https://fonts.googleapis.com/**',route=>route.abort());await context.route('https://fonts.gstatic.com/**',route=>route.abort());
  await context.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),p=url.pathname;
    if(p.startsWith('/api/admin/')&&request.headers()['x-admin-key']!=='test-admin')return route.fulfill({status:403,json:{error:'Нет доступа к кабинету'}});
    if(p==='/api/admin/list')return route.fulfill({json:{items:[...state.records.values()].map(record=>({id:record.id,names:record.data.names,order:record.order})),nextOffset:null}});
    if(p==='/api/admin/statistics')return route.fulfill({json:{total:2,published:0,archived:0,agreed_amount:0,by_status:{submitted:2},designs:[]}});
    if(p==='/api/admin/notifications')return route.fulfill({json:{publicUrl:true,queueReady:true,telegram:{configured:false},whatsapp:{configured:false}}});
    if(p==='/api/config')return route.fulfill({json:{orderMode:'manual',paymentsReady:false,rsvpDetailsReady:true}});
    const match=p.match(/^\/api\/admin\/orders\/([a-f0-9]+)(\/publish)?$/);
    if(match){const record=state.records.get(match[1]);if(!record)return route.fulfill({status:404,json:{error:'Заявка не найдена'}});
      if(match[2]){const body=request.postDataJSON();state.publishes.push({id:record.id,body});return state.publishBehavior?state.publishBehavior(route,record,body):state.success(route,record)}
      state.reads.push(record.id);return route.fulfill({json:Object.hasOwn(state,'detailResponse')?state.detailResponse:record});
    }
    return route.fulfill({json:{}});
  });return state;
}
async function login(page,id=first){await page.goto('/admin#order='+id);await page.locator('#k').fill('test-admin');await page.locator('#ld').click();await expect(page.locator('#admin-detail')).toBeVisible()}
async function publish(page){await page.locator('#admin-publish').scrollIntoViewIfNeeded();await page.locator('#admin-publish').click()}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve}}

test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'})});

test('Accepted orders with an unpriced service explain the real block and guide to the quote field',async({page,context})=>{
  const state=await fixture(context),record=state.records.get(first);record.order.status='accepted';record.order.services=[{id:'urgent',name_ru:'Срочное изготовление',price:null}];
  state.publishBehavior=route=>route.fulfill({status:409,json:{error:'Предложите клиенту итоговую стоимость услуг и дождитесь подтверждения.'}});
  await page.setViewportSize({width:390,height:844});await login(page);
  await expect(page.locator('#admin-publication-hint')).toContainText('Публикация пока недоступна');
  await expect(page.locator('#admin-publication-next')).toHaveText('Указать итоговую стоимость');
  await publish(page);await expect(page.locator('#admin-detail-status')).toContainText('итоговую стоимость');await expect(page.locator('#admin-detail-status')).toBeInViewport();
  await expect(page.locator('#admin-guest-link')).toBeHidden();expect(state.publishes).toHaveLength(1);
  await page.screenshot({path:path.resolve('preview-publication-blocked-quote.png')});
  await page.locator('#admin-publication-next').click();await expect(page.locator('#admin-quote-amount')).toBeFocused();await expect(page.locator('#admin-quote-amount')).toBeInViewport();
  await page.screenshot({path:path.resolve('preview-publication-quote-next-step.png')});
});

test('Publication succeeds once and exposes the actual guest link next to its feedback',async({page,context})=>{
  const state=await fixture(context);await login(page);await publish(page);
  await expect(page.locator('#admin-detail-status')).toContainText('Приглашение опубликовано');
  await expect(page.locator('#admin-guest-link')).toBeVisible();await expect(page.locator('#admin-guest-link')).toHaveAttribute('href','/arman-aigerim');
  await expect(page.locator('#admin-publish')).toBeHidden();await expect(page.locator('#admin-guest-link')).toBeFocused();
  expect(state.publishes).toEqual([{id:first,body:{version:'version-1'}}]);
  await expect(page.frameLocator('#admin-preview').locator('.nm')).toHaveText('Первая заявка');
  await page.screenshot({path:path.resolve('preview-admin-publication-success.png')});
});

test('Blocked publication explains the server reason beside the button on desktop and mobile',async({page,context})=>{
  const state=await fixture(context);state.publishBehavior=route=>route.fulfill({status:409,json:{error:blocked}});
  for(const width of [1280,390]){
    if(width===390)await page.reload();
    await page.setViewportSize({width,height:844});await login(page);await publish(page);
    const feedback=page.locator('#admin-detail-status');await expect(feedback).toHaveText(blocked);await expect(feedback).toBeInViewport();
    const buttonBox=await page.locator('#admin-publish').boundingBox(),feedbackBox=await feedback.boundingBox();
    expect(Math.abs(feedbackBox.y-buttonBox.y)).toBeLessThan(220);
    await expect(page.locator('#admin-publish')).toBeEnabled();await expect(page.locator('#admin-guest-link')).toBeHidden();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    if(width===390)await page.screenshot({path:path.resolve('preview-admin-publication-blocked-mobile.png')});
  }
  expect(state.publishes).toHaveLength(2);
});

test('Version conflict requires explicit refresh and publishes only the newly loaded version',async({page,context})=>{
  const state=await fixture(context);state.publishBehavior=(route,record,body)=>body.version==='version-1'?route.fulfill({status:409,json:{error:'Конфликт версий',conflict:true}}):state.success(route,record);
  await login(page);await publish(page);await expect(page.locator('#admin-detail-status')).toContainText('Клиент изменил');
  await expect(page.locator('#admin-detail-refresh')).toBeVisible();state.records.get(first).version='version-2';
  await page.locator('#admin-detail-refresh').click();await expect.poll(()=>state.reads.filter(id=>id===first).length).toBe(2);
  await expect(page.locator('#admin-publish')).toBeEnabled();expect(state.publishes).toHaveLength(1);
  await publish(page);await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes.map(call=>call.body.version)).toEqual(['version-1','version-2']);
});

test('Slow publication shows immediate busy feedback and ignores duplicate presses',async({page,context})=>{
  const state=await fixture(context),gate=deferred();state.publishBehavior=async(route,record)=>{await gate.promise;return state.success(route,record)};
  await login(page);await page.locator('#admin-publish').scrollIntoViewIfNeeded();const initialWidth=(await page.locator('#admin-publish').boundingBox()).width;
  await publish(page);await expect.poll(()=>state.publishes.length).toBe(1);
  await expect(page.locator('#admin-publish')).toBeDisabled();await expect(page.locator('#admin-publish')).toHaveAttribute('aria-busy','true');
  await expect(page.locator('#admin-publish')).toHaveText('Публикуем…');await expect(page.locator('#admin-detail-status')).toContainText('Публикуем');await expect(page.locator('#admin-detail-status')).toBeInViewport();
  expect(Math.abs((await page.locator('#admin-publish').boundingBox()).width-initialWidth)).toBeLessThanOrEqual(1);
  await page.locator('#admin-publish').evaluate(button=>{button.click();button.click()});expect(state.publishes).toHaveLength(1);
  gate.resolve();await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes).toHaveLength(1);
});

test('Admin login and publication work without AbortSignal.timeout',async({page,context})=>{
  const state=await fixture(context);await page.addInitScript(()=>Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined}));
  await login(page);expect(await page.evaluate(()=>typeof AbortSignal.timeout)).toBe('undefined');
  await publish(page);await expect(page.locator('#admin-detail-status')).toContainText('Приглашение опубликовано');await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes).toHaveLength(1);
});

test('Malformed publication response cannot show false success and a valid retry still works',async({page,context})=>{
  const state=await fixture(context);let attempts=0;state.publishBehavior=(route,record)=>attempts++===0?route.fulfill({json:{}}):state.success(route,record);
  await login(page);await publish(page);
  await expect(page.locator('#admin-detail-status')).toContainText(/публикац|ответ/);await expect(page.locator('#admin-detail-status')).not.toContainText('Приглашение опубликовано');
  await expect(page.locator('#admin-publish')).toBeVisible();await expect(page.locator('#admin-publish')).toBeEnabled();await expect(page.locator('#admin-guest-link')).toBeHidden();await expect(page.locator('#admin-detail-state')).toContainText('Новая заявка');
  await publish(page);await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes).toHaveLength(2);
});

test('Malformed refresh response keeps the open order intact and supports a valid refresh',async({page,context})=>{
  const state=await fixture(context);await login(page);state.detailResponse={};
  await page.locator('#admin-detail-refresh').click();
  await expect(page.locator('#admin-detail-status')).toContainText(/Сервер|сервер|ответ|заявк/);
  await expect(page.locator('#admin-detail-title')).toHaveText('Первая заявка');await expect(page.locator('#admin-publish')).toBeEnabled();
  await expect(page.locator('#admin-guest-link')).toBeHidden();expect(state.publishes).toHaveLength(0);
  delete state.detailResponse;state.records.get(first).version='version-2';
  await page.locator('#admin-detail-refresh').click();await expect(page.locator('#admin-detail-status')).toContainText('Заявка обновлена');
  await publish(page);await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes[0].body.version).toBe('version-2');
});

test('HTML gateway failures and network failures produce readable errors and allow retry',async({page,context})=>{
  const state=await fixture(context);let phase=0;state.publishBehavior=(route,record)=>phase++===0?route.fulfill({status:503,contentType:'text/html',body:'<html>Upstream unavailable</html>'}):phase===2?route.abort('failed'):state.success(route,record);
  await login(page);await publish(page);
  const feedback=page.locator('#admin-detail-status');await expect(feedback).toContainText(/сервер|Сервер|ответ|доступ/);await expect(feedback).not.toContainText(/Unexpected token|SyntaxError|<html>/);
  await expect(page.locator('#admin-publish')).toBeEnabled();await publish(page);
  await expect(feedback).toContainText(/соедин|сет|Сет|подключ|интернет|запрос|загруз|связаться/);await expect(feedback).not.toContainText('Failed to fetch');await expect(page.locator('#admin-publish')).toBeEnabled();
  await publish(page);await expect(page.locator('#admin-guest-link')).toBeVisible();expect(state.publishes).toHaveLength(3);
});

for(const [target,label]of [[second,'another order'],[first,'the same order reopened']])test('A late failure cannot overwrite '+label,async({page,context})=>{
  const state=await fixture(context),gate=deferred(),settled=deferred();state.publishBehavior=async route=>{await gate.promise;try{await route.fulfill({status:409,json:{error:'Старая ошибка предыдущего открытия'}})}catch{}finally{settled.resolve()}};
  await login(page);await publish(page);await expect.poll(()=>state.publishes.length).toBe(1);
  await page.locator('#admin-close').click();const expectedTitle=state.records.get(target).data.names;
  const row=page.locator('#ls .order-item').filter({has:page.getByRole('heading',{name:expectedTitle,exact:true})});await row.getByRole('button',{name:'Открыть заявку',exact:true}).click();
  await expect(page.locator('#admin-detail-title')).toHaveText(expectedTitle);await expect(page.locator('#admin-publish')).toBeEnabled();
  gate.resolve();await settled.promise;
  // Flush the request's catch/finally using an explicit microtask/frame boundary.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#admin-detail-title')).toHaveText(expectedTitle);await expect(page.locator('#admin-detail-status')).not.toContainText('Старая ошибка');await expect(page.locator('#admin-publish')).toBeEnabled();
});

test('Readiness hint describes unfinished edits and missing approval before publication',async({page,context})=>{
  const state=await fixture(context),record=state.records.get(first);record.order.revisions=[{id:'r1',text:'Исправить подпись',createdAt:'2026-10-26T08:10:00Z',doneAt:null}];
  await login(page);await expect(page.locator('#admin-publication-hint')).toContainText(/правк/);expect(state.publishes).toHaveLength(0);
  await page.locator('#admin-close').click();record.order.revisions=[];record.order.quote={id:'q1',amount:5000,note:'Индивидуальная цена',offeredAt:'2026-10-26T08:10:00Z'};
  await page.getByRole('button',{name:'Открыть заявку',exact:true}).first().click();
  await expect(page.locator('#admin-publication-hint')).toContainText(/подтверд|подтверж|согласован/);expect(state.publishes).toHaveLength(0);
});
