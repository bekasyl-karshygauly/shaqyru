import {test,expect} from '@playwright/test';

test.beforeEach(async({context})=>{await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort())});
test('email login, cloud upload, automatic save and restore preserve local drafts',async({page})=>{
  const user={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'};let logged=false,remote=null,saves=0;
  await page.route('**/api/account/**',async route=>{const url=new URL(route.request().url()),path=url.pathname;
    if(path.endsWith('/session'))return route.fulfill({json:{configured:true,storageReady:true,user:logged?user:null}});
    if(path.endsWith('/code'))return route.fulfill({json:{sent:true}});
    if(path.endsWith('/verify')){logged=true;return route.fulfill({json:{user}})}
    if(path.endsWith('/logout')){logged=false;return route.fulfill({json:{ok:true}})}
    if(path.endsWith('/drafts'))return route.fulfill({json:remote?[{...remote,data:undefined}]:[]});
    if(route.request().method()==='PUT'){const body=route.request().postDataJSON();remote={id:path.split('/').pop(),data:body.data,title:body.data.names,version:'v'+(++saves),updated_at:new Date().toISOString()};return route.fulfill({json:{id:remote.id,version:remote.version}})}
    return route.fulfill({json:remote});
  });
  await page.goto('/create?lang=ru');await page.locator('#names').fill('Местный черновик');await page.locator('#library-link').click();await page.getByLabel('Email',{exact:true}).fill(user.email);await page.getByRole('button',{name:'Получить код',exact:true}).click();await page.getByLabel('Код из письма',{exact:true}).fill('123456');await page.getByRole('button',{name:'Войти',exact:true}).click();await page.getByRole('button',{name:'Сохранить в облако',exact:true}).click();await expect(page.locator('#library-status')).toContainText('сохранено в облаке');
  await page.locator('.draft-item').getByRole('link',{name:'Редактировать'}).click();await expect(page.locator('#names')).toHaveValue('Местный черновик');await page.locator('#names').fill('Изменено в редакторе');await expect(page.locator('.cloud-editor-status')).toHaveText('Сохранено в облаке');expect(remote.data.names).toBe('Изменено в редакторе');
  await page.locator('#library-link').click();await page.getByRole('button',{name:'Открыть версию из облака',exact:true}).click();await expect(page.locator('#names')).toHaveValue('Изменено в редакторе');await page.locator('#library-link').click();await expect(page.locator('.draft-item')).toHaveCount(2);
});
test('unavailable account does not disable editing or local library',async({page})=>{
  await page.goto('/library.html');await expect(page.locator('.account-status')).toContainText('пока не подключено');await expect(page.getByRole('button',{name:'Получить код'})).toBeHidden();await page.getByRole('button',{name:'+ Новое приглашение',exact:true}).click();await expect(page.locator('#names')).toBeVisible();
});

const conflictUser={id:'11111111-1111-4111-8111-111111111111',email:'owner@example.com'};
const conflictKey='22222222-2222-4222-8222-222222222222';
const conflictMessage='В облаке уже есть более свежая версия. Местные правки сохранены.';
async function seedCloudDraft(page){
  await page.goto('/library.html');
  await page.evaluate(async({user,key})=>{const {saveDraft}=await import('/draft-store.js');await saveDraft(key,{lang:'ru',names:'Начальная версия'});localStorage.setItem('shq-cloud:'+user.id+':'+key,JSON.stringify({id:key,version:'v1'}))},{user:conflictUser,key:conflictKey});
}
async function mockVersionedCloud(context){
  const store={version:'v1',data:{names:'Начальная версия'},attempts:[]};
  await context.route('**/api/account/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path.endsWith('/session'))return route.fulfill({json:{configured:true,storageReady:true,user:conflictUser}});
    if(path.endsWith('/drafts'))return route.fulfill({json:[]});
    if(route.request().method()==='PUT'){
      const body=route.request().postDataJSON();store.attempts.push(body);
      if(body.version!==store.version)return route.fulfill({status:409,json:{error:conflictMessage}});
      store.version='v2';store.data=body.data;return route.fulfill({json:{id:conflictKey,version:store.version}});
    }
    return route.fulfill({json:{id:conflictKey,version:store.version,data:store.data}});
  });return store;
}
test('stale library tab cannot overwrite a newer cloud version after a search rerender',async({page,context})=>{
  const cloud=await mockVersionedCloud(context);await seedCloudDraft(page);await page.reload();await expect(page.getByRole('button',{name:'Сохранить в облако',exact:true})).toBeVisible();
  const other=await context.newPage();await other.goto('/library.html');
  await other.evaluate(async key=>{const {saveDraft}=await import('/draft-store.js');await saveDraft(key,{lang:'ru',names:'Новая версия из другой вкладки'})},conflictKey);await other.reload();
  await other.getByRole('button',{name:'Сохранить в облако',exact:true}).click();await expect(other.locator('#library-status')).toContainText('сохранено в облаке');
  await page.locator('#library-search').fill('Начальная');await page.getByRole('button',{name:'Сохранить в облако',exact:true}).click();await expect(page.locator('#library-status')).toContainText(conflictMessage);
  expect(cloud.attempts.map(x=>x.version)).toEqual(['v1','v1']);expect(cloud.data.names).toBe('Новая версия из другой вкладки');
  await expect(page.locator('.draft-item')).toContainText('Начальная версия');await other.close();
});
test('editor keeps local edits and pauses autosync after a version conflict',async({page,context})=>{
  const cloud=await mockVersionedCloud(context);await seedCloudDraft(page);await page.goto('/create?draft='+conflictKey);await expect(page.locator('#names')).toHaveValue('Начальная версия');await expect(page.locator('.cloud-editor-status')).toHaveText('Сохранено в облаке');cloud.attempts.length=0;
  cloud.version='v3';cloud.data={names:'Версия другого устройства'};
  await page.evaluate(({user,key})=>localStorage.setItem('shq-cloud:'+user.id+':'+key,JSON.stringify({id:key,version:'v3'})),{user:conflictUser,key:conflictKey});
  await page.locator('#names').fill('Мои местные правки');await expect(page.locator('.cloud-editor-status')).toHaveText(conflictMessage);expect(cloud.attempts[0].version).toBe('v2');
  await page.locator('#names').fill('Продолжаю редактировать');await page.locator('#library-link').click();await expect(page.locator('.draft-item')).toContainText('Продолжаю редактировать');expect(cloud.attempts).toHaveLength(1);expect(cloud.data.names).toBe('Версия другого устройства');
});
