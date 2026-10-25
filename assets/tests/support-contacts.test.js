import test from 'node:test';
import assert from 'node:assert/strict';
import {messengerLinks,orderMessage,orderReviewUrl} from '../public/support-contacts.js';

test('order message shares only selected fields and links address the organizer',()=>{
  const text=orderMessage({id:'order-123',names:'Арман & Айгерім',date:'2027-05-01',lang:'ru',tok:'OWNER_SECRET',photo:'PRIVATE_PHOTO',password:'PRIVATE_PASSWORD'},
    {contact:{name:'Айгерім',phone:'+7 700 123 45 67',email:'test@example.com'},note:'Пожелания & вопросы? #той'},'Солнечный сад');
  assert.match(text,/Заявка: order-123/);assert.match(text,/Дизайн: Солнечный сад/);assert.match(text,/Пожелания & вопросы\? #той/);
  assert.doesNotMatch(text,/OWNER_SECRET|PRIVATE_PHOTO|PRIVATE_PASSWORD/);
  const wa=new URL(messengerLinks(text).whatsapp),tg=new URL(messengerLinks(text).telegram);
  assert.equal(wa.origin+wa.pathname,'https://wa.me/77788562088');assert.equal(tg.origin+tg.pathname,'https://t.me/Bekasyl');
  assert.equal(wa.searchParams.get('text'),text);assert.equal(tg.searchParams.get('text'),text);assert.equal(wa.hash,'');assert.equal(tg.hash,'');
  assert.equal(messengerLinks().telegram,'https://t.me/Bekasyl');
});

test('review link leads to one admin order and never accepts arbitrary IDs or credentialed origins',()=>{
  const id='abcdef0123456789abcdef0123456789';
  const reviewUrl=orderReviewUrl(id,'https://invite.example/create?secret=hidden');
  assert.equal(reviewUrl,'https://invite.example/admin#order='+id);
  const text=orderMessage({id,lang:'ru'},{price:3990,contact:{name:'Клиент'}},'Мята',{reviewUrl});assert.ok(text.includes(reviewUrl));assert.match(text,/Стоимость:/);
  assert.equal(orderReviewUrl('bad#id','https://invite.example'),'');assert.equal(orderReviewUrl(id,'javascript:alert(1)'),'');assert.equal(orderReviewUrl(id,'https://user:secret@invite.example'),'');
});

test('Kazakh order message uses saved contacts and omits absent optional fields',()=>{
  const text=orderMessage({id:'kz-order',lang:'kz',names:'Әли'}, {contact:{name:'Анасы'}});
  assert.match(text,/Өтінім: kz-order/);assert.match(text,/Менің атым: Анасы/);assert.doesNotMatch(text,/undefined|null|Email:|Телефон:|Дата:|Заявка:/);
});
