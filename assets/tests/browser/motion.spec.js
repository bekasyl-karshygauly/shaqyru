import {test,expect} from '@playwright/test';

for(const width of [320,768,1280])test(`Animated invitation preview opens, stops and replays at ${width}px`,async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width,height:900});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/invitation-motion.html');
  expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
  await page.locator('#open').click();
  await expect(page.locator('#invitation')).toBeVisible();
  await expect(page.locator('#names')).toBeFocused();
  await expect(page.locator('#motion')).toHaveAttribute('aria-pressed','true');
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)).toBeGreaterThan(0);
  await page.locator('.scroll-cue').click();await expect(page.locator('#details')).toHaveClass(/seen/);
  await page.keyboard.press('Escape');await expect(page.locator('#motion')).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.locator('#replay').click();await expect(page.locator('#open')).toBeFocused();
  await page.locator('#open-static').click();await expect(page.locator('#invitation')).toBeVisible();
  expect(await page.evaluate(()=>document.getAnimations().length)).toBe(0);
  await expect(page.locator('#details')).toHaveCSS('opacity','1');
  await page.locator('#motion').click();await expect(page.locator('#motion')).toHaveAttribute('aria-pressed','true');
  await page.locator('#motion').click();await expect(page.locator('#motion')).toHaveAttribute('aria-pressed','false');
  expect(errors).toEqual([]);
});
