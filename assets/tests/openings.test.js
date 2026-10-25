import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clean} from '../validate.js';
test('Photo openings survive server validation and reject unsafe photo sources',()=>{
  for(const anim of ['cinema','album','iris','mosaic','polaroid','bloom','panorama','soft']){
    const data=clean({anim,introPhoto:'data:image/jpeg;base64,YWJj',introX:12,introY:83});
    assert.equal(data.anim,anim);assert.equal(data.introPhoto,'data:image/jpeg;base64,YWJj');assert.equal(data.introX,12);assert.equal(data.introY,83);
  }
  for(const introPhoto of ['javascript:alert(1)','data:image/svg+xml;base64,YWJj','https://a.test/" onerror="x'])assert.equal(clean({introPhoto}).introPhoto,'');
  assert.equal(clean({introX:NaN}).introX,50);assert.equal(clean({introX:999}).introX,100);assert.equal(clean({introY:-10}).introY,0);assert.equal(clean({anim:'missing'}).anim,'auto');
});
