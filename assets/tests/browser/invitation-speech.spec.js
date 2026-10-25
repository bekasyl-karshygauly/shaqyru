import {test,expect} from '@playwright/test';

async function setup(page,lang,voices){
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.route('https://fonts.googleapis.com/**',r=>r.abort());await page.route('https://fonts.gstatic.com/**',r=>r.abort());
  await page.addInitScript(voices=>{
    window.testVoices=voices;window.testSpeech=[];window.testCancelled=0;
    const synth=new EventTarget();
    synth.getVoices=()=>window.testVoices;synth.cancel=()=>window.testCancelled++;
    synth.speak=u=>window.testSpeech.push({lang:u.lang,voice:u.voice?.name,text:u.text});
    Object.defineProperty(window,'speechSynthesis',{configurable:true,value:synth});
    window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
  },voices);
  await page.route('**/api/i/**',r=>r.fulfill({json:{data:{lang,vc:true,names:'Алия & Бек',anim:'env'},preview:false}}));
  await page.goto('/i/12345678');await expect(page.locator('.inv')).toBeVisible();
}
const english={name:'English default',lang:'en-US',default:true,localService:true};
for(const [lang,voice,label] of [['ru',{name:'Русский',lang:'ru-RU',localService:true},'Послушать голосом'],['kz',{name:'Қазақша',lang:'kk-KZ',localService:true},'Дауыспен тыңдау']]){
  test(`${lang} speech explicitly uses its own voice instead of the English default`,async({page})=>{
    await setup(page,lang,[english,voice]);await page.getByRole('button',{name:label}).click();
    expect(await page.evaluate(()=>window.testSpeech)).toEqual([{lang:voice.lang,voice:voice.name,text:expect.stringContaining('Алия & Бек')}]);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    expect(await page.evaluate(()=>window.testCancelled)).toBe(1);
  });
}
test('English-only device has no speech button and never speaks through a fallback',async({page})=>{
  await setup(page,'ru',[english]);await expect(page.getByRole('button',{name:'Послушать голосом'})).toHaveCount(0);
  expect(await page.evaluate(()=>window.testSpeech)).toEqual([]);
});
test('Delayed voice loading and removal update the button without an English fallback',async({page})=>{
  await setup(page,'kz',[]);await expect(page.getByRole('button',{name:'Дауыспен тыңдау'})).toHaveCount(0);
  await page.evaluate(()=>{window.testVoices=[{name:'Қазақша',lang:'kk_KZ'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'))});
  const button=page.getByRole('button',{name:'Дауыспен тыңдау'});await button.click();
  await page.evaluate(()=>{window.testVoices=[{name:'English',lang:'en-US'}];speechSynthesis.dispatchEvent(new Event('voiceschanged'))});
  await expect(button).toHaveCount(0);expect(await page.evaluate(()=>window.testSpeech.map(s=>s.voice))).toEqual(['Қазақша']);
  expect(await page.evaluate(()=>window.testCancelled)).toBe(1);
});
