import { test, expect } from "@playwright/test";

test("Preview opens immediately without a server request and animations close",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/api/inv**",route=>route.abort());
  await page.goto("/create");await page.locator("#names").fill("Арман и Айгерім — проверка");
  const popupPromise=page.waitForEvent("popup");await page.locator("#pvw").click();const preview=await popupPromise;
  preview.on("pageerror",e=>errors.push(e.message));
  await expect(preview.locator(".nm")).toHaveText("Арман и Айгерім — проверка");
  await expect(preview.locator(".intro")).toHaveCount(0);
  await expect(preview.locator(".wm")).toBeVisible();
  await expect(preview.locator(".rsvp-yes")).toBeDisabled();
  await preview.getByRole("button",{name:/Ашу анимациясын|Проверить анимацию/}).click();
  await preview.locator(".seal").click();await expect(preview.locator(".intro")).toHaveCount(0,{timeout:5000});
  expect(errors).toEqual([]);
});
test("Mobile preview is visible and full preview works",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/create");
  await page.locator("#pvw").click();await expect(page.locator("#pvw-col .inv")).toBeVisible();
  const popupPromise=page.waitForEvent("popup");await page.locator("#mob-full").click();const preview=await popupPromise;
  await preview.setViewportSize({width:390,height:844});
  await expect(preview.locator(".inv")).toBeVisible();
  await expect(preview.locator(".gl").first()).toHaveCSS("opacity","1");
  await preview.screenshot({path:"test-results/mobile-preview.png",fullPage:true});
});
test("Unpaid guest page never falls back to locally saved data",async({page})=>{
  await page.goto("/create");await page.locator("#names").fill("Секретный черновик");
  await page.route("**/api/i/**",r=>r.fulfill({status:402,json:{error:"Доступ только после оплаты"}}));
  await page.goto("/i/12345678?payment=success");await expect(page.locator("body")).toContainText("Доступ только после оплаты");
  await expect(page.locator(".inv")).toHaveCount(0);await expect(page.locator("body")).not.toContainText("Секретный черновик");
});
test("Payment is unavailable without merchant account and contains no card fields",async({page})=>{
  await page.goto("/create");await page.locator('#top-lang [data-l="ru"]').click();await page.locator("#buy").click();await expect(page.locator("#order-dialog")).toBeVisible();
  await expect(page.locator("#order-explanation")).toContainText("согласуете стоимость");
  await expect(page.locator("#order-submit")).toBeEnabled();await expect(page.locator('[autocomplete="cc-number"],[autocomplete="cc-csc"]')).toHaveCount(0);
});
test("Corrupt old drafts cannot produce a blank page or injected HTML",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem("shq",JSON.stringify({dsg:999,ev:-1,lang:"invalid",c:null,paid:1,photo:'https://example.com/x" onerror="alert(1)',names:"Старый черновик"})));
  await page.goto("/create");await expect(page.locator("#pv .nm")).toHaveText("Старый черновик");
  await expect(page.locator("#buy")).toBeVisible();expect(errors).toEqual([]);
});
test("All designs and intro styles render without runtime errors",async({page})=>{
  test.setTimeout(60000);
  const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.goto("/create");
  for(let i=0;i<30;i++){await page.locator('#gal button[data-i="'+i+'"]').click();await expect(page.locator("#pv .inv")).toBeVisible()}
  for(const id of ["auto","env","doors","scroll","box","curtain","heart","flip","portal"]){
    await page.locator('#animg button[data-a="'+id+'"]').click();await expect(page.locator(".seal")).toBeVisible();
    await page.locator(".intro-skip").click();await expect(page.locator(".intro")).toHaveCount(0);
  }expect(errors).toEqual([]);
});
test("Editing an existing invitation autosaves to the server",async({page})=>{
  const writes=[];
  await page.addInitScript(()=>localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),names:"Исходное имя"})));
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{paid:false,data:{names:"Исходное имя"}}}));
  await page.route("**/api/inv/12345678",r=>{writes.push(r.request().postDataJSON());expect(r.request().headers()["x-owner-token"]).toBe("a".repeat(48));return r.fulfill({json:{paid:false}})});
  await page.goto("/create");await page.locator("#names").fill("Новое имя");
  await expect.poll(()=>writes.some(w=>w.data.names==="Новое имя")).toBe(true);
  await expect(page.locator("#save-status")).toContainText(/Сохранено на сервере|Серверде сақталды/);
});
test("Editor controls switch between Kazakh and Russian",async({page})=>{
  await page.goto("/create");await expect(page.locator("#sec-data h3")).toHaveText("3. Той туралы мәліметтер");
  await page.locator('#top-lang [data-l="ru"]').click();await expect(page.locator("#sec-data h3")).toHaveText("3. Данные тоя");
  await page.locator('#top-lang [data-l="kz"]').click();await expect(page.locator("#sec-data h3")).toHaveText("3. Той туралы мәліметтер");
});
test("Saved drafts load newer server data without overwriting it",async({page})=>{
  let writes=0;
  await page.addInitScript(()=>localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),names:"Старое имя",_dirty:false})));
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{paid:false,data:{names:"Новое имя на сервере"}}}));
  await page.route("**/api/inv/12345678",r=>{writes++;return r.fulfill({json:{paid:false}})});
  await page.goto("/create");await expect(page.locator("#names")).toHaveValue("Новое имя на сервере");expect(writes).toBe(0);
});
test("Music library is removed while saved invitation music stays available",async({page})=>{
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.addInitScript(()=>localStorage.setItem('shq',JSON.stringify({lang:'ru',mus:'/audio/besik_zhyry.wav',musTitle:'Моя сохранённая музыка'})));
  await page.goto("/create");await expect(page.locator("#music-library")).toHaveCount(0);
  await expect(page.locator("#music-library-play")).toHaveCount(0);
  await expect(page.locator("#custom-track-card")).toBeVisible();
  await expect(page.locator("#ctc-title")).toHaveText('Моя сохранённая музыка');
});
