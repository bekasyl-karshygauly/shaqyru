import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas,loadImage} from '@napi-rs/canvas';
import jsQR from 'jsqr';
import {clean} from '../validate.js';
import {guestLanguageState} from '../public/guest-language.js';
import {styleSnapshot} from '../public/design-compare.js';
import {qrSvg,invitationQrUrl} from '../public/print-qr.js';
import {createHistory} from '../public/edit-history.js';
test('existing edit history survives the addition of language settings',()=>{
  const old={entries:[{data:{names:'Before'},at:1,fields:[]},{data:{names:'After'},at:2,fields:['names']}],index:1};
  const history=createHistory({names:'After',bilingual:false,translations:{ru:{},kz:{}}});
  assert.equal(history.load(old,{names:'After',bilingual:false,translations:{ru:{},kz:{}}}),true);
  assert.equal(history.go(0).names,'Before');
});
test('translations survive validation, remain bounded and never override design or access',()=>{
  const s=clean({lang:'ru',bilingual:true,text:'Авторский текст',te:1,c:{ac:'#123456'},translations:{kz:{text:'Қош келдіңіз!',place:'x'.repeat(200),tok:'secret',c:{ac:'#ffffff'}}}});
  assert.equal(s.translations.kz.place.length,100);assert.equal(s.translations.kz.tok,undefined);
  const translated=guestLanguageState(s,'kz',[]);assert.equal(translated.text,'Қош келдіңіз!');assert.equal(translated.lang,'kz');assert.equal(translated.c.ac,'#123456');assert.equal(s.text,'Авторский текст');
  assert.equal(guestLanguageState({...s,bilingual:false},'kz',[]).lang,'ru');
  assert.equal(guestLanguageState({...s,translations:{},te:0},'kz',[[0,0,0,'Стандарт KZ','Стандарт RU']]).text,'Стандарт KZ');
});
test('comparison only snapshots visual fields, keeping guest content and owner access outside it',()=>{
  const s=styleSnapshot({...clean({names:'Original',c:{ac:'#123456'},introPhoto:'/covers/wedding.jpg',anim:'mosaic'}),tok:'secret',paid:1});
  assert.equal(s.names,undefined);assert.equal(s.tok,undefined);assert.equal(s.paid,undefined);assert.equal(s.anim,'mosaic');assert.equal(s.c.ac,'#123456');
});
test('printed QR decodes to a guest URL without owner credentials',async()=>{
  globalThis.location={origin:'https://invite.example'};
  const url=invitationQrUrl('https://invite.example/i/12345678?g=aaaaaaaaaa&t=owner-secret#t=secret');
  assert.equal(url,'https://invite.example/i/12345678?g=aaaaaaaaaa');
  assert.throws(()=>invitationQrUrl('https://other.example/i/12345678'));
  assert.throws(()=>invitationQrUrl('/preview#local-draft'));
  assert.equal(invitationQrUrl('/arman-aigerim?g=aaaaaaaaaa&t=owner-secret#t=secret'),'https://invite.example/arman-aigerim?g=aaaaaaaaaa');
  for(const bad of ['/admin','/create','/library','/arman-aigerim/other','https://other.example/arman-aigerim'])assert.throws(()=>invitationQrUrl(bad));
  const canvas=createCanvas(640,640),ctx=canvas.getContext('2d');ctx.drawImage(await loadImage(Buffer.from(qrSvg(url))),0,0,640,640);
  const code=jsQR(ctx.getImageData(0,0,640,640).data,640,640);assert.equal(code?.data,url);
});
