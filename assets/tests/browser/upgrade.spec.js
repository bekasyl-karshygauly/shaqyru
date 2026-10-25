import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{test.setTimeout(60000);await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());await page.emulateMedia({reducedMotion:'reduce'})});
test('history restores names and photos, persists and branches without altering access settings',async({page})=>{
  await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');const original=await page.locator('#names').inputValue();
  await page.locator('#names').fill('Первое изменение');await page.locator('#place').fill('Новый зал');
  await page.locator('#history-undo').click();await expect(page.locator('#names')).toHaveValue('Первое изменение');await expect(page.locator('#place')).not.toHaveValue('Новый зал');
  await page.locator('#history-undo').click();await expect(page.locator('#names')).toHaveValue(original);
  await page.locator('#history-redo').click();await expect(page.locator('#names')).toHaveValue('Первое изменение');
  await page.locator('#names').fill('Новая ветка');await expect(page.locator('#history-redo')).toBeDisabled();
  await page.reload();await expect(page.locator('#names')).toHaveValue('Новая ветка');await expect(page.locator('#history-undo')).toBeEnabled();await page.locator('#history-undo').click();await expect(page.locator('#names')).not.toHaveValue('Новая ветка');
  await page.locator('#intro-upload').setInputFiles('public/covers/wedding.jpg');await expect(page.locator('.intro-feedback')).toContainText('добавлено');await page.locator('#history-undo').click();await expect(page.locator('.intro-remove')).toBeDisabled();await page.locator('#history-redo').click();await expect(page.locator('.intro-remove')).toBeEnabled();
});
test('personal greeting and expanded responses reach guest submit with validated child count',async({page})=>{
  let body;await page.route('**/api/i/**',r=>r.fulfill({json:{data:{lang:'ru',names:'Пара',greeting:'Дорогие {name}!',rsvpQuestions:['children','diet','transfer'],anim:'soft'},guest:{name:'Алия и Данияр',cnt:2},preview:false,rsvpDetailsReady:true}}));await page.route('**/api/rsvp/**',r=>{body=r.request().postDataJSON();return r.fulfill({json:{ok:true}})});
  await page.goto('/i/12345678?g=aaaaaaaaaa');await expect(page.locator('.guest-welcome')).toHaveText('Дорогие Алия и Данияр!');await page.locator('#rsvp-children').fill('3');await page.locator('.rsvp-yes').click();expect(body).toBeUndefined();
  await page.locator('#rsvp-children').fill('1');await page.locator('#rsvp-diet').fill('Без орехов');await page.locator('#rsvp-transfer').check();await page.locator('.rsvp-yes').click();await expect(page.locator('.rsvp-success')).toBeVisible();expect(body.details).toEqual({children:1,diet:'Без орехов',transfer:true});
});
test('video export produces a playable portrait file and supports cancellation',async({page})=>{
  test.setTimeout(45000);
  const wave=Buffer.alloc(44+16000*2);wave.write('RIFF',0);wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(16000,24);wave.writeUInt32LE(32000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(32000,40);for(let n=0;n<16000;n++)wave.writeInt16LE(Math.round(Math.sin(n*2*Math.PI*440/16000)*2000),44+n*2);
  await page.route('**/audio/test-tone.wav',r=>r.fulfill({contentType:'audio/wav',body:wave}));await page.addInitScript(()=>localStorage.setItem('shq',JSON.stringify({lang:'ru',mus:'/audio/test-tone.wav',musTitle:'Test tone'})));
  await page.goto('/create?lang=ru');await expect(page.locator('#app')).not.toHaveAttribute('inert');await page.locator('#names').fill('Арман и Айгерім');await page.locator('#video-export summary').click();await page.locator('#video-music').check();await page.locator('#video-start').click();await expect(page.locator('.video-status')).toContainText('Видео готово',{timeout:20000});
  const media=page.locator('#video-export video');await expect(media).toBeVisible();await expect.poll(()=>media.evaluate(v=>v.videoWidth)).toBe(720);expect(await media.evaluate(v=>v.videoHeight)).toBe(1280);expect(await media.evaluate(async v=>(await (await fetch(v.src)).blob()).size)).toBeGreaterThan(10000);
  expect(await media.evaluate(async v=>{v.muted=true;await v.play();const stream=v.captureStream();const count=stream.getAudioTracks().length;stream.getTracks().forEach(t=>t.stop());v.pause();return count})).toBe(1);
  const dl=page.waitForEvent('download');await page.locator('.video-download').click();expect((await dl).suggestedFilename()).toMatch(/\.(mp4|webm)$/);
  await page.locator('#video-start').click();await page.locator('#video-cancel').click();await expect(page.locator('.video-status')).toContainText('отменена');await expect(page.locator('#video-start')).toBeEnabled();
});
test('collaborator editor saves with version, keeps edits on conflict; viewer cannot edit',async({page})=>{
  let role='editor',put,conflict=false;await page.route('**/api/collaboration/**',r=>{if(r.request().method()==='PUT'){put=r.request().postDataJSON();return conflict?r.fulfill({status:409,json:{error:'Конфликт версий'}}):r.fulfill({json:{version:'v2'}})}return r.fulfill({json:{data:{names:'Исходное имя',lang:'ru'},version:'v1',role}})});
  await page.goto('/collaborate.html#id=12345678&t='+'a'.repeat(48));await expect(page.locator('#collab-names')).toHaveValue('Исходное имя');await page.locator('#collab-names').fill('Правки партнёра');await page.locator('#collab-save').click();await expect(page.locator('#collab-status')).toContainText('сохранены');expect(put.version).toBe('v1');expect(put.data.names).toBe('Правки партнёра');
  conflict=true;await page.locator('#collab-names').fill('Правки при конфликте');await page.locator('#collab-save').click();await expect(page.locator('#collab-status')).toContainText('Конфликт');await expect(page.locator('#collab-names')).toHaveValue('Правки при конфликте');await expect(page.locator('#collab-save')).toBeDisabled();
  page.on('dialog',d=>d.accept());role='viewer';await page.reload();await expect(page.locator('#collab-names')).toBeDisabled();await expect(page.locator('#collab-save')).toBeHidden();
});
test('owner creates and revokes a collaboration link without replacing their owner token',async({page})=>{
  const owner='a'.repeat(48),token='b'.repeat(48);let version='legacy',grants=[],createdRole;
  await page.addInitScript(owner=>localStorage.setItem('shq',JSON.stringify({id:'12345678',tok:owner,lang:'ru',_dirty:false})),owner);
  await page.route('**/api/inv/12345678/status',r=>r.fulfill({json:{data:{lang:'ru',names:'Владелец'},version,paid:false}}));
  await page.route('**/api/inv/12345678',r=>{version='v2';return r.fulfill({json:{version,paid:false}})});
  await page.route('**/api/inv/12345678/collaborators',r=>{if(r.request().method()==='POST'){const body=r.request().postDataJSON();createdRole=body.role;expect(body.version).toBe(version);version='v3';grants=[{id:'grant1',role:body.role,expires:Date.now()+86400000}];return r.fulfill({json:{...grants[0],token,version}})}return r.fulfill({json:grants})});
  await page.route('**/api/inv/12345678/collaborators/grant1',r=>{expect(r.request().method()).toBe('DELETE');grants=[];version='v4';return r.fulfill({json:{version}})});
  await page.goto('/create');await expect(page.locator('#names')).toHaveValue('Владелец');await page.locator('#collaboration-owner summary').click();await page.locator('#sharing-role').selectOption('editor');await page.locator('#sharing-create').click();await expect(page.locator('#sharing-link')).toHaveValue(new RegExp('#id=12345678&t='+token));expect(createdRole).toBe('editor');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('shq')).tok)).toBe(owner);
  await page.locator('.sharing-list button').click();await expect(page.locator('.sharing-status')).toHaveText('Ссылка отозвана');await expect(page.locator('#sharing-link')).toBeHidden();
});
