import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkInvitation} from '../public/editor-assistant.js';
const complete={names:'Имена',date:'2099-12-01',time:'18:00',place:'Зал',text:'Приходите',addr:'Алматы',zone:'Asia/Almaty'};
test('Review detects missing data without changing the invitation',()=>{const s={...complete,names:' ',date:'',time:'',place:'',text:'',addr:''},snapshot=JSON.stringify(s);assert.deepEqual(checkInvitation(s).map(i=>i.field),['names','date','time','place','text','addr']);assert.equal(JSON.stringify(s),snapshot);assert.deepEqual(checkInvitation(complete),[])});
test('Route advice accepts valid coordinate strings, including zero; rejects incomplete or invalid coordinates',()=>{for(const [lat,lng]of [['43.2','76.8'],['0','0']])assert.deepEqual(checkInvitation({...complete,addr:'',lat,lng}),[]);for(const [lat,lng]of [['',''],['43',''],['91','20'],['43','181'],['NaN','20']])assert.equal(checkInvitation({...complete,addr:'',lat,lng}).at(-1).field,'addr')});
test('Review flags a past date while keeping future dates valid',()=>{assert.equal(checkInvitation({...complete,date:'2000-01-01'})[0].field,'date');assert.deepEqual(checkInvitation(complete),[])});
