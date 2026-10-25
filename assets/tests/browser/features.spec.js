import {test,expect} from "@playwright/test";
import {readFile} from "node:fs/promises";
test.setTimeout(60000);
test("Preview exports a calendar and opens coordinate routes in both map services",async({page})=>{
  await page.goto("/create");await page.locator('#top-lang [data-l="ru"]').click();await page.locator("#lat").fill("43.238949");await page.locator("#lng").fill("76.889709");
  const popup=page.waitForEvent("popup");await page.locator("#pvw").click();const view=await popup;await expect(view.locator(".inv")).toBeVisible();
  await expect(view.getByRole("link",{name:"Google Maps"})).toHaveAttribute("href",/destination=43.238949%2C76.889709/);
  await expect(view.getByRole("link",{name:/2ГИС/})).toHaveAttribute("href",/geo\/76.889709,43.238949/);
  const downloading=view.waitForEvent("download");await view.getByRole("button",{name:"📅 Добавить в календарь"}).click();const file=await downloading;
  expect(file.suggestedFilename()).toBe("invitation.ics");expect(await readFile(await file.path(),"utf8")).toContain("DTSTART:20261219T130000Z");
});
test("Guest management displays comments, searches, filters and exports matching guests",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("shq",JSON.stringify({id:"12345678",tok:"a".repeat(48),_dirty:false})));
  await page.route("**/api/inv/12345678/status",r=>r.fulfill({json:{paid:true,paidTier:1,data:{names:"Организатор",lang:"ru"}}}));
  await page.route("**/api/inv/12345678",r=>r.fulfill({json:{paid:true}}));
  await page.route("**/api/inv/12345678/guests",r=>r.fulfill({json:[{name:"Арман",status:"yes",cnt:2,note:"Будем с ребёнком",code:"1234567890"},{name:"Айгерім",status:"no",cnt:0,note:"Не смогу",code:"1234567891"},{name:"Данияр",status:null,cnt:1,note:"",code:"1234567892"}]}));
  await page.goto("/create");await expect(page.locator("#gs")).toBeVisible();await page.locator("#gs").click();await expect(page.locator(".guest-note").first()).toHaveText("Будем с ребёнком");
  await page.locator("#guest-search").fill("ребёнком");await expect(page.locator(".gl-guest-name")).toHaveCount(1);await expect(page.locator(".gl-guest-name")).toHaveText("Арман");
  const downloading=page.waitForEvent("download");await page.locator("#guest-export").click();const file=await downloading;const content=await readFile(await file.path(),"utf8");expect(content).toContain("Будем с ребёнком");expect(content).not.toContain("Айгерім");
  await page.locator("#guest-search").fill("");await page.locator("#guest-filter").selectOption("wait");await expect(page.locator(".gl-guest-name")).toHaveText("Данияр");
  await page.locator("#guest-filter").selectOption("all");await page.screenshot({path:"test-results/guest-management.png",fullPage:true});
});
test("Guest password gate retries incorrect passwords, then sends authorized RSVP",async({page})=>{
  let unlocked=false,reply;
  await page.route("**/api/i/12345678",r=>r.fulfill(unlocked&&r.request().headers()["x-guest-token"]==="guest-session"?{json:{data:{names:"Защищённое приглашение",lang:"ru",dsg:0},preview:false}}:{status:401,json:{passwordRequired:true,error:"Введите пароль приглашения"}}));
  await page.route("**/api/i/12345678/unlock",r=>{unlocked=r.request().postDataJSON().password==="1234";return r.fulfill(unlocked?{json:{token:"guest-session"}}:{status:403,json:{error:"Неверный пароль"}})});
  await page.route("**/api/rsvp/12345678",r=>{reply=r.request();return r.fulfill({json:{ok:true}})});
  await page.goto("/i/12345678");await expect(page.locator(".inv")).toHaveCount(0);await page.getByLabel("Пароль приглашения").fill("wrong");await page.locator(".password-gate button").click();await expect(page.locator('[role="alert"]')).toHaveText("Неверный пароль");
  await page.getByLabel("Пароль приглашения").fill("1234");await page.locator(".password-gate button").click();await expect(page.locator(".inv")).toBeVisible();await page.locator(".intro-skip").click();
  await page.locator("input.rsvp-input").fill("Гость");await page.locator(".rsvp-yes").click();await expect(page.locator(".rsvp-success")).toBeVisible();expect(reply.headers()["x-guest-token"]).toBe("guest-session");
});
test("Privacy controls preserve closure settings and do not save plain passwords in drafts",async({page})=>{
  const writes=[];
  await page.route("**/api/inv",r=>r.fulfill({json:{id:"12345678",tok:"a".repeat(48),paid:false}}));
  await page.route("**/api/inv/12345678",r=>{writes.push(r.request().postDataJSON().data);return r.fulfill({json:{paid:false}})});
  await page.route("**/api/inv/12345678/password",r=>r.fulfill({json:{passwordSet:!!r.request().postDataJSON().password}}));
  await page.goto("/create");await page.locator('#top-lang [data-l="ru"]').click();await page.locator(".privacy-settings summary").click();await page.locator("#closed").check();await page.locator("#closeAt").fill("2027-01-01T23:00");await page.locator("#guest-password").fill("secret-password");await page.locator("#set-password").click();await expect(page.locator("#privacy-status")).toHaveText("Пароль установлен");
  expect(await page.evaluate(()=>localStorage.getItem("shq"))).not.toContain("secret-password");await page.locator("#names").fill("Новое имя");await expect.poll(()=>writes.some(w=>w.closed&&w.closeAt==="2027-01-01T23:00")).toBe(true);
  await page.locator("#remove-password").click();await expect(page.locator("#privacy-status")).toHaveText("Пароль не установлен");
});
