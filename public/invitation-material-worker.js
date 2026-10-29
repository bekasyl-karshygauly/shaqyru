/* Decorative GPU work lives off the scroll/HTML thread. The host supplies the
   existing scroll clocks and surface normals; this worker owns no animation. */
import * as THREE from './vendor/three.module.min.js';
import {invitationVertexShader,invitationFragmentShader} from './invitation-shaders.js';

let renderer,canvas,geometry,material,scene,camera,mesh,pending=null,rendering=false,epoch=0,lost=false,cancelRender=null;
const attributes={aRect:4,aCssSize:2,aTilt:2,aMaterial:2};
function createGeometry(){
  const plane=new THREE.PlaneGeometry(2,2),value=new THREE.InstancedBufferGeometry();value.index=plane.index;
  for(const [name,attribute]of Object.entries(plane.attributes))value.setAttribute(name,attribute);
  for(const [name,size]of Object.entries(attributes))value.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(16*size),size).setUsage(THREE.DynamicDrawUsage));
  value.instanceCount=0;return value;
}
function createRenderer(context){
  const value=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
  value.setPixelRatio(1);value.autoClear=false;value.toneMapping=THREE.NoToneMapping;value.outputColorSpace=THREE.SRGBColorSpace;return value;
}
function reject(job,error){if(job)postMessage({type:'error',id:job.id,error})}
async function drain(){
  if(rendering||!pending||lost)return;
  rendering=true;const job=pending,version=epoch;pending=null;const images=[];let atlas=null;
  let cancel;const cancelled=new Promise(resolve=>{cancel=()=>resolve(null)});cancelRender=cancel;
  const started=performance.now();
  try{
    const {width,height,surfaces,progress}=job;
    if(canvas.width!==width||canvas.height!==height)renderer.setSize(width,height,false);
    for(let index=0;index<surfaces.length;index++){
      const s=surfaces[index];
      geometry.getAttribute('aRect').setXYZW(index,s.x/width,(height-s.y-s.height)/height,s.width/width,s.height/height);
      geometry.getAttribute('aCssSize').setXY(index,s.cssWidth,s.cssHeight);
      geometry.getAttribute('aTilt').setXY(index,s.tiltX,s.tiltY);
      geometry.getAttribute('aMaterial').setXY(index,s.seed,s.mode);
    }
    for(const name of Object.keys(attributes))geometry.getAttribute(name).needsUpdate=true;
    geometry.instanceCount=surfaces.length;
    for(const key of ['Opening','Card','Depth'])material.uniforms['u'+key].value=progress[key.toLowerCase()];
    renderer.setViewport(0,0,width,height);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    atlas=canvas.transferToImageBitmap();
    // Cropping/ownership transfers can stall in WebKit. They never block the
    // main thread, and there is only one GPU job in flight, with latest queued.
    const crops=Promise.allSettled(surfaces.map(async s=>({index:s.index,image:await createImageBitmap(atlas,s.x,s.y,s.width,s.height)})));
    const results=await Promise.race([crops,cancelled]);
    if(!results){void crops.then(values=>{for(const value of values)if(value.status==='fulfilled')value.value.image.close()});reject(job,'cancelled');return}
    for(const result of results)if(result.status==='fulfilled')images.push(result.value);
    if(version!==epoch||lost){reject(job,'cancelled');return}
    if(results.some(r=>r.status==='rejected'))throw Error('crop');
    postMessage({type:'painted',id:job.id,images,drawCalls:renderer.info.render.calls,duration:performance.now()-started},images.map(tile=>tile.image));
    images.length=0;
  }catch{reject(job,'render')}
  finally{atlas?.close();for(const tile of images)tile.image.close();if(cancelRender===cancel)cancelRender=null;rendering=false;void drain()}
}
self.onmessage=event=>{
  const message=event.data;
  if(message.type==='cancel'){epoch++;cancelRender?.();reject(pending,'cancelled');pending=null;return}
  if(message.type==='paint'){reject(pending,'cancelled');pending=message;void drain();return}
  if(message.type!=='init')return;
  try{
    canvas=new OffscreenCanvas(1,1);
    const context=canvas.getContext('webgl2',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'});
    if(!context)throw Error('unsupported');
    renderer=createRenderer(context);geometry=createGeometry();scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    const color=new THREE.Color(0xd4af68);if(message.accent)color.setStyle(message.accent);
    material=new THREE.ShaderMaterial({vertexShader:invitationVertexShader,fragmentShader:invitationFragmentShader,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:THREE.NormalBlending,
      uniforms:{uAccent:{value:color},uOpening:{value:0},uCard:{value:0},uDepth:{value:0}}});
    mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;epoch++;cancelRender?.();reject(pending,'cancelled');pending=null;postMessage({type:'lost'})});
    canvas.addEventListener('webglcontextrestored',()=>{
      try{const restored=material.clone();geometry.dispose();material.dispose();renderer.dispose();renderer=createRenderer(context);geometry=createGeometry();material=restored;mesh.geometry=geometry;mesh.material=material;lost=false;postMessage({type:'restored'})}catch{postMessage({type:'fatal'})}
    });
    postMessage({type:'ready',maxTextureSize:renderer.capabilities.maxTextureSize});
  }catch{postMessage({type:'unsupported'})}
};
