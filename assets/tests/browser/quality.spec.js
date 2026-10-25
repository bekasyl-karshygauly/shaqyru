import {test,expect} from "@playwright/test";
test.setTimeout(60000);
test.beforeEach(async({page})=>{await page.route("https://fonts.googleapis.com/**",r=>r.abort());await page.route("https://fonts.gstatic.com/**",r=>r.abort())});

test("Every editor panel fits phones, tablets and desktop without clipped fields",async({page})=>{
  await page.goto("/create");
  for(const width of [320,390,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll("input,select,textarea")].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<0||r.right>innerWidth+1)}).map(e=>e.id)}));
    expect(layout.scroll,JSON.stringify(layout)).toBeLessThanOrEqual(width+1);expect(layout.clipped).toEqual([]);
  }
});
test("Editor fields have accessible names and labels focus their controls",async({page})=>{
  await page.goto("/create");await page.locator('#top-lang [data-l="ru"]').click();
  const unnamed=await page.locator("input,select,textarea").evaluateAll(es=>es.filter(e=>e.type!=="hidden"&&!e.labels?.length&&!e.getAttribute("aria-label")&&!e.getAttribute("aria-labelledby")).map(e=>e.id));expect(unnamed).toEqual([]);
  await page.locator('label[for="names"]').click();await expect(page.locator("#names")).toBeFocused();
});
test("Allowed long names and text stay inside the full invitation",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto("/create");await page.locator("#names").fill("А".repeat(80));await page.locator("#text").fill(("Очень длинное приглашение ").repeat(25).slice(0,500));await page.locator("#mt-prev").click();
  const outside=await page.locator("#pv .inv").evaluate(inv=>{const box=inv.getBoundingClientRect();return [...inv.querySelectorAll(".nm,.tx,.pl,.ho")].filter(e=>{const r=e.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1}).map(e=>e.className)});expect(outside).toEqual([]);
});
test("Selected particles update the visible card and optimized gallery images are lazy",async({page})=>{
  await page.goto("/create");await page.locator('#fxg [data-fx="hearts"]').click();await expect(page.locator("#pv .fx")).toHaveClass("fx fx-hearts");
  await page.locator('#fxg [data-fx="stars"]').click();await expect(page.locator("#pv .fx")).toHaveClass("fx fx-stars");
  const sources=await page.locator("#gal img").evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute("src"),lazy:i.loading})));expect(sources.length).toBeGreaterThan(0);expect(sources.every(i=>i.src.includes("/covers/thumbs/")&&i.src.endsWith(".webp")&&i.lazy==="lazy")).toBe(true);
});
test("Reduced motion stops CSS and canvas and exposes a keyboard music button",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.addInitScript(()=>{window.framesCount=0;const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>raf(t=>{window.framesCount++;fn(t)})});
  await page.route("**/api/i/**",r=>r.fulfill({json:{data:{names:"Қонақ",lang:"kz",dsg:19,mus:"/audio/besik_zhyry.wav"},preview:false}}));
  await page.goto("/i/12345678");await expect(page.locator(".inv")).toBeVisible();await expect(page.locator(".intro")).toHaveCount(0);await expect(page.locator("html")).toHaveAttribute("lang","kk");
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==="running").length)).toBe(0);
  const frames=await page.evaluate(()=>window.framesCount);await page.waitForTimeout(200);expect(await page.evaluate(()=>window.framesCount)).toBe(frames);
  const music=page.locator("button.floating-music-btn");await expect(music).toBeVisible();await music.focus();await expect(music).toBeFocused();await music.press("Space");await expect(music).toHaveAttribute("aria-pressed","true");await music.press("Space");await expect(music).toHaveAttribute("aria-pressed","false");
});
for(const width of [390,1280])test(`Explicit opening preview works with reduced motion at ${width}px`,async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.setViewportSize({width,height:844});await page.goto("/create");
  if(width<768)await page.locator("#mt-prev").click();
  await page.locator("#ip").click();
  await expect(page.locator('.intro[role="dialog"] .seal')).toBeVisible();
  await expect(page.locator(".seal")).toBeFocused();
  expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==="running").length)).toBe(0);
  await page.locator(".seal").click();await expect(page.locator(".intro")).toHaveCount(0);await expect(page.locator("#ip")).toBeFocused();
  await page.locator("#ip").click();await page.keyboard.press("Escape");await expect(page.locator(".intro")).toHaveCount(0);
  if(width<768)await page.locator("#mob-back").click();
  for(const trigger of ['#tani','#animg [data-a="doors"]']){
    await page.locator(trigger).click();await expect(page.locator(".seal")).toBeVisible();await page.locator(".intro-skip").click();
  }
  const popupPromise=page.waitForEvent("popup");
  if(width<768){await page.locator("#mt-prev").click();await page.locator("#mob-full").click()}else await page.locator("#pvw").click();
  const preview=await popupPromise;await preview.emulateMedia({reducedMotion:"reduce"});
  await expect(preview.locator(".inv")).toBeVisible();await expect(preview.locator(".intro")).toHaveCount(0);
  const trigger=preview.getByRole("button",{name:/Ашу анимациясын|Проверить анимацию/});
  await trigger.click();await expect(preview.locator(".seal")).toBeVisible();await preview.locator(".seal").click();
  await expect(preview.locator(".intro")).toHaveCount(0);await expect(trigger).toBeFocused();
});

test("Intro supports focus trapping, Escape and returning to its trigger",async({page})=>{
  await page.goto("/create");await page.locator("#ip").click();await expect(page.locator('.intro[role="dialog"] .seal')).toBeFocused();
  await page.keyboard.press("Shift+Tab");await expect(page.locator(".intro-skip")).toBeFocused();await page.keyboard.press("Tab");await expect(page.locator(".seal")).toBeFocused();await page.keyboard.press("Escape");await expect(page.locator(".intro")).toHaveCount(0);await expect(page.locator("#ip")).toBeFocused();
});
test("An editing conflict keeps local changes and backs them up before loading the server",async({page})=>{
  const v1="1".repeat(32),v2="2".repeat(32),v3="3".repeat(32);let remote=v1,writes=[];
  await page.addInitScript(({v1})=>localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),_dirty:false,_serverVersion:v1})),{v1});
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{version:remote,paid:false,data:{names:remote===v1?"Initial":"Other tab",lang:"ru"}}}));
  await page.route("**/api/inv/12345678",r=>{const body=r.request().postDataJSON();writes.push(body);if(remote===v1){remote=v2;return r.fulfill({status:409,json:{conflict:true,error:"Конфликт версий"}})}expect(body.version).toBe(v2);return r.fulfill({json:{paid:false,version:v3}})});
  await page.goto("/create");await expect(page.locator("#names")).toHaveValue("Initial");await page.locator("#names").fill("My local changes");await expect(page.locator("#edit-conflict")).toBeVisible();await expect(page.locator("#names")).toHaveValue("My local changes");
  await page.locator("#reload-server").click();await expect(page.locator("#names")).toHaveValue("Other tab");expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("shq-recovery")).names)).toBe("My local changes");await expect(page.locator("#edit-conflict")).toBeHidden();
  await page.locator("#names").fill("Resolved edit");await expect.poll(()=>writes.length).toBe(2);expect(writes[0].version).toBe(v1);
});
test("A stale dirty browser draft never automatically overwrites a newer server version",async({page})=>{
  let writes=0;await page.addInitScript(()=>localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),names:"Unsaved local draft",_dirty:true,_serverVersion:"1".repeat(32)})));
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{version:"2".repeat(32),paid:false,data:{names:"Server version"}}}));await page.route("**/api/inv/12345678",r=>{writes++;return r.fulfill({json:{paid:false}})});
  await page.goto("/create");await expect(page.locator("#edit-conflict")).toBeVisible();await expect(page.locator("#names")).toHaveValue("Unsaved local draft");expect(writes).toBe(0);
});
test("General-link answers reuse their request id after reload; declines have the correct message",async({page})=>{
  const requests=[];await page.emulateMedia({reducedMotion:"reduce"});await page.route("**/api/i/**",r=>r.fulfill({json:{data:{names:"Invitation",lang:"ru",dsg:0},preview:false}}));await page.route("**/api/rsvp/**",r=>{requests.push(r.request().postDataJSON());return r.fulfill({json:{ok:true}})});
  for(let n=0;n<2;n++){await page.goto("/i/12345678");await page.locator("input.rsvp-input").fill("Same guest");await page.locator(".rsvp-no").click();await expect(page.locator(".rsvp-success")).toContainText("Спасибо, что сообщили!");await expect(page.locator(".rsvp-success")).not.toContainText("Ждём вас")}
  expect(requests[0].requestId).toBe(requests[1].requestId);
});
test("Clipboard refusal gives an error without falsely reporting success",async({page})=>{
  const errors=[];page.on("pageerror",e=>errors.push(e.message));await page.addInitScript(()=>{localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),_dirty:false}));Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:()=>Promise.reject(Error("Permission denied"))}})});
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{version:"legacy",paid:true,paidTier:1,data:{lang:"ru",names:"Test"}}}));await page.route("**/api/inv/12345678",r=>r.fulfill({json:{paid:true,version:"1".repeat(32)}}));await page.route("**/api/inv/12345678/guests",r=>r.fulfill({json:[]}));
  await page.goto("/create");await page.locator("#gs").click();const copy=page.locator(".cp").first();await copy.click();await expect(page.locator("#guest-feedback")).toContainText("Не удалось скопировать");await expect(copy).not.toHaveText("✓");expect(errors).toEqual([]);
});
