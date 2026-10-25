import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clean} from '../validate.js';
test('guest scenes and photo stories survive server validation without unsafe media',()=>{
  const data=clean({scene:'garden',sceneSpeed:'slow',sceneDensity:'high',story:[{src:'javascript:alert(1)',caption:'unsafe'},{src:'/covers/wedding.jpg',caption:'Наш день'},{src:'data:image/svg+xml;base64,PHN2Zz4='}]});
  assert.equal(data.scene,'garden');assert.equal(data.sceneSpeed,'slow');assert.equal(data.sceneDensity,'high');assert.deepEqual(data.story,[{src:'/covers/wedding.jpg',caption:'Наш день',x:50,y:50,zoom:1,fit:'contain',duration:5}]);
  const invalid=clean({scene:'<script>',sceneSpeed:99,sceneDensity:{},story:Array(20).fill({src:'/covers/wedding.jpg',caption:'x'.repeat(300)})});assert.equal(invalid.scene,'none');assert.equal(invalid.story.length,5);assert.equal(invalid.story[0].caption.length,120);assert.equal(invalid.sceneSpeed,'normal');
});
