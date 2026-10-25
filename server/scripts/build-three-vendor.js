import {build} from 'esbuild';
import {copyFile,readFile} from 'node:fs/promises';
const exports=['WebGLRenderer','Scene','OrthographicCamera','PlaneGeometry','ShaderMaterial','Mesh','Vector2','Vector3','Color','NoToneMapping','SRGBColorSpace','NormalBlending'];
await build({absWorkingDir:process.cwd(),tsconfigRaw:{},stdin:{contents:`export {${exports.join(',')}} from './node_modules/three/build/three.module.js';`,resolveDir:process.cwd(),sourcefile:'three-invitation-entry.js'},bundle:true,minify:true,format:'esm',target:['es2020'],outfile:'public/vendor/three.module.min.js',legalComments:'eof'});
await copyFile('node_modules/three/LICENSE','public/vendor/three-LICENSE.txt');
const info=JSON.parse(await readFile('node_modules/three/package.json','utf8'));
console.log('Local Three.js '+info.version+' invitation renderer built.');
