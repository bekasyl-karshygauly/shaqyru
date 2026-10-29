import {invitationVertexShader,invitationFragmentShader} from './invitation-shaders.js';
import {startMaterialWorker} from './invitation-material-bridge.js';

const clamp=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(1,Number(value))):0;
const MAX_SURFACES=16;
const OPENING_SURFACES='.scene-image,.scene-panel,.eb,.ect,.ef,.efl,.door,.sc-sheet,.sc-bar,.bx-box,.bx-lid,.cl,.cr,.ct-top,.ht-wing,.fl,.pt-ring,.pt-core,.zm';
let currentController=null;

/* A single detached WebGL canvas renders a small atlas. Local presentation
   canvases inherit the real DOM flaps' 3D transforms, including clip-path and
   mosaic panels; there is no duplicate geometry that can drift from GSAP. */
export function mountInvitationWebGL({host,card,state={},openingRoot=null}){
  currentController?.destroy();
  let destroyed=false,ready=false,contextLost=false,printing=false,failed=false,frame=0;
  let dirty=true,needsLayout=true,renderCount=0,renderer=null;
  let material=null,geometry=null,scene=null,camera=null,mesh=null,three=null,atlas=null,remote=null,createRenderer=null;
  let compatibleAtlas=null,compatibleContext=null;
  let atlasSize={width:0,height:0},surfaces=[],resizeObserver=null,intersectionObserver=null;
  const rendererSize={width:0,height:0};
  let bitmapPipeline=false,painting=0,paintSequence=0,generation=0;
  const transfers=new Set();
  let hostInView=true,lastPaintDuration=0;
  let resetRasterReferences=false;
  const transformSources=new Map();
  const observedSurfaces=new Map(),viewport={width:window.innerWidth,height:window.innerHeight};
  const latest={opening:openingRoot?0:1,card:0,depth:0,covered:!!openingRoot};
  const root=card?.matches?.('.inv')?card:card?.querySelector?.('.inv');
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const printMedia=window.matchMedia('print');printing=printMedia.matches;
  const disposers=[];
  const mobile=()=>window.matchMedia('(max-width: 767px), (pointer: coarse)').matches;
  const setState=value=>{if(!destroyed&&host&&host.dataset.webglState!==value)host.dataset.webglState=value};
  const listen=(target,event,handler,options)=>{target.addEventListener(event,handler,options);disposers.push(()=>target.removeEventListener(event,handler,options))};
  const cancelPending=()=>{cancelAnimationFrame(frame);frame=0};
  const invalidateTransfers=()=>{
    generation++;painting=0;cancelPending();remote?.cancel();
    // Some mobile browsers leave a crop promise pending while the context or
    // page is suspended. Release its backing immediately and let a new frame
    // start on restore; the old promise can never publish over that new frame.
    for(const transfer of transfers){transfer.image?.close();for(const tile of transfer.tiles)tile.image?.close()}
  };
  const metadata=(snapshot=latest)=>{
    const values={opening:snapshot.opening.toFixed(5),card:snapshot.card.toFixed(5),depth:snapshot.depth.toFixed(5)};
    for(const surface of surfaces){Object.assign(surface.canvas.dataset,values);surface.canvas.dataset.webglFrame=String(renderCount)}
    if(host){host.dataset.webglOpening=values.opening;host.dataset.webglCard=values.card;host.dataset.webglDepth=values.depth;host.dataset.webglFrame=String(renderCount)}
  };
  function visible(surface){
    if(latest.covered&&surface.kind!=='opening')return false;
    if(surface.kind==='atmosphere')return true;
    const element=surface.element;
    if(!element.isConnected)return false;
    if(surface.kind==='opening'&&(latest.opening>=.999||openingRoot?.style.visibility==='hidden'))return false;
    // IntersectionObserver tracks native scroll and 3D flap bounds without a
    // synchronous geometry read after GSAP/WAAPI have changed the scene.
    if(intersectionObserver)return surface.inView;
    const rect=element.getBoundingClientRect(),height=window.innerHeight,width=window.innerWidth;
    return rect.width>0&&rect.height>0&&rect.bottom>-80&&rect.top<height+80&&rect.right>-80&&rect.left<width+80;
  }
  function paused(){return document.hidden||printing||media.matches||contextLost}
  function requestPaint(layout=false){
    dirty=true;if(layout)needsLayout=true;
    if(destroyed||!ready||paused()||painting||frame)return;
    // Coalesce actual progress changes into the next display frame. A timer
    // after an asynchronous bitmap transfer added an extra 33ms on every
    // mobile frame and reduced a nominal 30fps limit even further.
    frame=requestAnimationFrame(paint);
  }
  function addSurface(element,kind,index){
    const canvas=document.createElement('canvas');
    canvas.className=kind==='atmosphere'?'invitation-atmosphere-layer':'invitation-material-layer';
    canvas.setAttribute('aria-hidden','true');canvas.setAttribute('role','presentation');
    canvas.dataset.webglLayer=kind;canvas.dataset.webglFrame='0';canvas.tabIndex=-1;
    const bitmapContext=bitmapPipeline?canvas.getContext('bitmaprenderer',{alpha:true}):null;
    const context=bitmapContext||canvas.getContext('2d',{alpha:true});
    if(!context)return;
    let previousPosition=null;
    if(kind!=='atmosphere'&&getComputedStyle(element).position==='static'){
      previousPosition={value:element.style.getPropertyValue('position'),priority:element.style.getPropertyPriority('position')};
      element.style.setProperty('position','relative');
    }
    element.append(canvas);
    canvas.dataset.webglPresentation=bitmapContext?'bitmap':'2d';
    const tiltSources=[];
    if(kind!=='atmosphere')for(let node=element,steps=0;node&&steps++<5;node=node.parentElement){
      let source=transformSources.get(node);
      if(!source){
        // Only actual 3D tracks can change a paper normal. Mosaic translations,
        // opacity and static ancestors need no computed-style read per frame.
        const dynamic=node.getAnimations().some(a=>a.effect?.target===node&&a.effect.getKeyframes().some(f=>/matrix3d|rotate[XY]|rotate3d|perspective/.test(f.transform||'')));
        source={node,dynamic,value:readTilt(node)};transformSources.set(node,source);
      }
      if(source.dynamic||source.value.x||source.value.y)tiltSources.push(source);
      if(node===openingRoot||node===host)break;
    }
    const surface={element,canvas,context,bitmap:!!bitmapContext,kind,index,previousPosition,tiltSources,inView:true,x:0,y:0,width:1,height:1,cssWidth:1,cssHeight:1,referenceWidth:0,referenceHeight:0};
    surfaces.push(surface);observedSurfaces.set(element,surface);
    if(kind!=='atmosphere'){resizeObserver?.observe(element);intersectionObserver?.observe(element)}
  }
  function pack(items,maxWidth){
    let x=0,y=0,rowHeight=0,width=0;
    for(const item of [...items].sort((a,b)=>b.height-a.height)){
      if(x&&x+item.width>maxWidth){y+=rowHeight;x=0;rowHeight=0}
      item.x=x;item.y=y;x+=item.width;rowHeight=Math.max(rowHeight,item.height);width=Math.max(width,x);
    }
    return {width:Math.max(1,width),height:Math.max(1,y+rowHeight)};
  }
  function measureSurface(surface,small,force=false){
    const atmosphere=surface.kind==='atmosphere';
    const width=Math.max(1,atmosphere?window.innerWidth:surface.element.clientWidth);
    const height=Math.max(1,atmosphere?window.innerHeight:surface.element.clientHeight);
    surface.cssWidth=width;surface.cssHeight=height;
    // dvh-sized photo panels also receive ResizeObserver entries while mobile
    // browser chrome moves. Keep their raster allocation stable for a modest
    // height-only change; CSS and the shader's physical-size attributes still
    // follow the real box, so paper grain/light do not use stale coordinates.
    const ratio=height/surface.referenceHeight;
    if(small&&!force&&width===surface.referenceWidth&&ratio>=.8&&ratio<=1.2)return false;
    const changed=force||width!==surface.referenceWidth||height!==surface.referenceHeight;
    surface.referenceWidth=width;surface.referenceHeight=height;return changed;
  }
  function layout(){
    needsLayout=false;
    const small=mobile(),budget=small?360000:1400000,cap=small?320:576;
    // These canvases contain translucent light, not text or photographs. One
    // backing pixel per mobile CSS pixel keeps the original HTML sharp while
    // avoiding high-density shader work that cannot add readable detail.
    const dpr=Math.min(window.devicePixelRatio||1,small?1:1.5);
    const maxTexture=Math.min(renderer.capabilities.maxTextureSize,2048);
    for(const surface of surfaces){
      const atmosphere=surface.kind==='atmosphere';
      measureSurface(surface,small,resetRasterReferences);
      const scale=Math.min(dpr,cap/surface.referenceWidth,cap/surface.referenceHeight)*(atmosphere?.72:1);
      surface.desiredWidth=Math.max(8,Math.floor(surface.referenceWidth*scale));
      surface.desiredHeight=Math.max(8,Math.floor(surface.referenceHeight*scale));
    }
    resetRasterReferences=false;
    let scale=1,result;
    for(let attempt=0;attempt<16;attempt++){
      for(const surface of surfaces){surface.width=Math.max(8,Math.floor(surface.desiredWidth*scale));surface.height=Math.max(8,Math.floor(surface.desiredHeight*scale))}
      const widest=Math.max(...surfaces.map(s=>s.width));
      const preferred=Math.min(maxTexture,Math.max(widest,small?1024:1536));
      result=pack(surfaces,preferred);
      if(result.width*result.height<=budget&&result.height<=maxTexture)break;
      scale*=Math.min(.9,Math.sqrt(budget/(result.width*result.height))*.96,maxTexture/result.height*.96);
    }
    atlasSize=result;
    if(rendererSize.width!==result.width||rendererSize.height!==result.height){
      renderer.setSize(result.width,result.height,false);rendererSize.width=result.width;rendererSize.height=result.height;
    }
    for(const surface of surfaces){
      // A worker may still be preparing the replacement. Keep the previous
      // material visible until its new bitmap is ready, including on rotation.
      if(!remote||surface.canvas.dataset.webglFrame==='0'||!visible(surface)){if(surface.canvas.width!==surface.width)surface.canvas.width=surface.width;if(surface.canvas.height!==surface.height)surface.canvas.height=surface.height}
      surface.canvas.dataset.webglAtlas=`${result.width}x${result.height}`;
    }
    if(host){host.dataset.webglAtlasWidth=String(result.width);host.dataset.webglAtlasHeight=String(result.height)}
  }
  function readTilt(element){
    const transform=getComputedStyle(element).transform;
    try{const matrix=transform&&transform!=='none'?new DOMMatrixReadOnly(transform):null;return matrix?{x:matrix.m13,y:matrix.m23}:{x:0,y:0}}catch{return {x:0,y:0}}
  }
  function tiltFor(surface,cache){
    let x=0,y=0;
    for(const source of surface.tiltSources){
      let value=source.value;
      if(source.dynamic){value=cache.get(source.node);if(!value){value=readTilt(source.node);cache.set(source.node,value)}}
      x+=value.x;y+=value.y;
    }
    return {x:Math.max(-1,Math.min(1,x)),y:Math.max(-1,Math.min(1,y))};
  }
  function createGeometry(){
    const plane=new three.PlaneGeometry(2,2),value=new three.InstancedBufferGeometry();
    value.index=plane.index;
    for(const [name,attribute] of Object.entries(plane.attributes))value.setAttribute(name,attribute);
    for(const [name,size] of [['aRect',4],['aCssSize',2],['aTilt',2],['aMaterial',2]]){
      value.setAttribute(name,new three.InstancedBufferAttribute(new Float32Array(MAX_SURFACES*size),size).setUsage(three.DynamicDrawUsage));
    }
    value.instanceCount=0;return value;
  }
  function prepareInstances(active){
    const rect=geometry?.getAttribute('aRect'),size=geometry?.getAttribute('aCssSize');
    const tilt=geometry?.getAttribute('aTilt'),kind=geometry?.getAttribute('aMaterial'),cache=new Map(),instances=[];
    for(let index=0;index<active.length;index++){
      const surface=active[index],angle=surface.kind==='atmosphere'?{x:0,y:0}:tiltFor(surface,cache);
      const mode=surface.kind==='atmosphere'?2:surface.section?3:surface.kind==='opening'?1:0;
      if(remote)instances.push({index:surface.index,x:surface.x,y:surface.y,width:surface.width,height:surface.height,cssWidth:surface.cssWidth,cssHeight:surface.cssHeight,tiltX:angle.x,tiltY:angle.y,seed:surface.index*.713,mode});
      else{rect.setXYZW(index,surface.x/atlasSize.width,(atlasSize.height-surface.y-surface.height)/atlasSize.height,surface.width/atlasSize.width,surface.height/atlasSize.height);
        size.setXY(index,surface.cssWidth,surface.cssHeight);tilt.setXY(index,angle.x,angle.y);kind.setXY(index,surface.index*.713,mode)}
    }
    if(!remote){for(const attribute of [rect,size,tilt,kind])attribute.needsUpdate=true;geometry.instanceCount=active.length}
    return instances;
  }
  function viewportResize(force=false){
    const width=window.innerWidth,height=window.innerHeight,small=mobile(),ratio=height/viewport.height;
    // Browser chrome changes visualViewport height during a finger swipe. Let
    // CSS stretch the atmospheric canvas instead of reallocating every bitmap
    // and GPU target on each URL-bar movement. Rotation/real resizes still map
    // all surfaces immediately.
    if(force||width!==viewport.width||!small||ratio<.8||ratio>1.2){
      viewport.width=width;viewport.height=height;resetRasterReferences=true;requestPaint(true);
    }else{
      const atmosphere=surfaces.find(surface=>surface.kind==='atmosphere');
      if(atmosphere)measureSurface(atmosphere,small);
      requestPaint();
    }
  }
  async function paint(){
    frame=0;if(destroyed||!ready||paused())return;
    if(!dirty)return;
    const ticket=++paintSequence;painting=ticket;dirty=false;
    const started=performance.now(),version=generation,snapshot={...latest},transfer={image:null,tiles:[]};
    transfers.add(transfer);
    let image=null,tiles=[];
    try{
      if(needsLayout)layout();
      let hostVisible=hostInView;
      if(!intersectionObserver){const rect=host.getBoundingClientRect();hostVisible=rect.width>0&&rect.height>0&&rect.bottom>-80&&rect.top<window.innerHeight+80}
      const openingVisible=openingRoot?.isConnected&&latest.opening<.999;
      const active=hostVisible||openingVisible?surfaces.filter(visible):[];
      if(!active.length){setState('suspended');return}
      const instances=prepareInstances(active);
      if(remote){
        const result=await remote.paint({id:ticket,...atlasSize,surfaces:instances,progress:snapshot});
        tiles=result.images.map(tile=>({...tile,surface:surfaces.find(s=>s.index===tile.index)}));transfer.tiles=tiles;
        if(destroyed||paused()||version!==generation)return;
        for(const tile of tiles){
          const surface=tile.surface;if(!surface)continue;
          if(surface.canvas.width!==surface.width)surface.canvas.width=surface.width;
          if(surface.canvas.height!==surface.height)surface.canvas.height=surface.height;
          if(surface.bitmap){surface.context.transferFromImageBitmap(tile.image);tile.image=null}
          else{surface.context.clearRect(0,0,surface.width,surface.height);surface.context.drawImage(tile.image,0,0);tile.image.close();tile.image=null}
        }
        renderer.info.render.calls=result.drawCalls;
      }else{
      const uniforms=material.uniforms;
      uniforms.uOpening.value=latest.opening;uniforms.uCard.value=latest.card;uniforms.uDepth.value=latest.depth;
      // Every non-overlapping atlas tile is an instance of the same quad. The
      // complete paper, foil and atmosphere scene is one GPU draw, rather than
      // one renderer traversal/uniform upload/draw for every DOM flap.
      renderer.setScissorTest(false);renderer.setViewport(0,0,atlasSize.width,atlasSize.height);
      renderer.setClearColor(0x000000,0);renderer.clear();renderer.render(scene,camera);
      const copiedSurfaces=active.filter(surface=>!surface.bitmap);
      if(copiedSurfaces.length){
        // Safari/older browsers without bitmaprenderer keep the same effects,
        // but copy the WebGL backing only once. Cropping each flap directly
        // from WebGL forced a separate GPU/2D synchronization for every flap.
        if(!compatibleAtlas){compatibleAtlas=document.createElement('canvas');compatibleContext=compatibleAtlas.getContext('2d',{alpha:true})}
        if(!compatibleContext)throw Error('MATERIAL_COPY_UNAVAILABLE');
        if(compatibleAtlas.width!==atlasSize.width)compatibleAtlas.width=atlasSize.width;
        if(compatibleAtlas.height!==atlasSize.height)compatibleAtlas.height=atlasSize.height;
        compatibleContext.clearRect(0,0,atlasSize.width,atlasSize.height);compatibleContext.drawImage(atlas,0,0);
      }
      for(const surface of copiedSurfaces){
        surface.context.clearRect(0,0,surface.width,surface.height);
        surface.context.drawImage(compatibleAtlas,surface.x,surface.y,surface.width,surface.height,0,0,surface.width,surface.height);
      }
      const bitmapSurfaces=active.filter(s=>s.bitmap);
      if(bitmapSurfaces.length){
        image=atlas.transferToImageBitmap();
        transfer.image=image;
        // Crop GPU-backed image handles, then transfer ownership to the DOM
        // canvases. This avoids a synchronous WebGL→CPU readback per flap.
        const results=await Promise.allSettled(bitmapSurfaces.map(async surface=>{
          const cropped=await createImageBitmap(image,surface.x,surface.y,surface.width,surface.height);
          if(destroyed||paused()||version!==generation){cropped.close();return null}
          return {surface,image:cropped};
        }));
        tiles=results.filter(result=>result.status==='fulfilled'&&result.value).map(result=>result.value);transfer.tiles=tiles;
        if(destroyed||paused()||version!==generation)return;
        if(results.some(result=>result.status==='rejected'))throw Error('MATERIAL_TRANSFER_FAILED');
        for(const tile of tiles){tile.surface.context.transferFromImageBitmap(tile.image);tile.image=null}
      }
      }
      renderCount++;lastPaintDuration=performance.now()-started;metadata(snapshot);
      if(host)host.dataset.webglDrawCalls=String(renderer.info.render.calls);
      setState('ready');
    }catch{
      // A decorative renderer failure must never affect the readable invitation.
      if(!destroyed&&version===generation)failRenderer();
    }finally{
      image?.close();for(const tile of tiles)tile.image?.close();transfers.delete(transfer);
      if(painting===ticket){painting=0;if(dirty&&!destroyed&&ready&&!paused())requestPaint()}
    }
  }
  function clearSurfaces(){for(const surface of surfaces){if(surface.bitmap)surface.context.transferFromImageBitmap(null);else surface.context.clearRect(0,0,surface.canvas.width,surface.canvas.height)}}
  function failRenderer(){
    failed=true;ready=false;invalidateTransfers();remote?.destroy();clearSurfaces();
    geometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();setState('fallback');
  }
  const controller={
    update(values={}){
      let changed=false;
      if('covered'in values&&!!values.covered!==latest.covered){
        latest.covered=!!values.covered;changed=true;
        if(latest.covered){
          invalidateTransfers();
          for(const surface of surfaces)if(surface.kind!=='opening'){if(surface.bitmap)surface.context.transferFromImageBitmap(null);else surface.context.clearRect(0,0,surface.canvas.width,surface.canvas.height)}
        }
      }
      for(const key of ['opening','card','depth'])if(key in values){const value=clamp(values[key]);if(value!==latest[key]){latest[key]=value;changed=true}}
      if(changed)requestPaint();
    },
    refresh(){requestPaint(true)},
    inspect(){return {state:host?.dataset.webglState||'fallback',backend:remote?'worker':'main',surfaceCount:surfaces.length,atlas:{...atlasSize},renderCount,pending:Boolean(frame||painting),paintDuration:lastPaintDuration,drawCalls:renderer?.info.render.calls||0,contextLost,progress:{...latest}}},
    destroy(){
      if(destroyed)return;destroyed=true;invalidateTransfers();remote?.destroy();resizeObserver?.disconnect();intersectionObserver?.disconnect();
      for(const dispose of disposers.splice(0))dispose();
      for(const surface of surfaces){
        surface.canvas.remove();
        if(surface.previousPosition&&surface.element.style.getPropertyValue('position')==='relative'){
          if(surface.previousPosition.value)surface.element.style.setProperty('position',surface.previousPosition.value,surface.previousPosition.priority);
          else surface.element.style.removeProperty('position');
        }
        surface.canvas.width=surface.canvas.height=1;
      }
      surfaces=[];observedSurfaces.clear();transformSources.clear();transfers.clear();geometry?.dispose();material?.dispose();renderer?.dispose();renderer?.forceContextLoss();
      if(atlas)atlas.width=atlas.height=1;
      if(compatibleAtlas)compatibleAtlas.width=compatibleAtlas.height=1;
      if(host)for(const key of ['webglState','webglBackend','webglOpening','webglCard','webglDepth','webglFrame','webglAtlasWidth','webglAtlasHeight','webglDrawCalls'])delete host.dataset[key];
      if(currentController===controller)currentController=null;
    }
  };
  currentController=controller;
  if(!host||!root||media.matches||typeof WebGL2RenderingContext==='undefined'){setState('fallback');return controller}
  setState('loading');
  // Deferring the local engine avoids allocating a renderer for reduced motion
  // and lets the already working invitation become interactive first.
  Promise.resolve().then(async()=>{
    if(destroyed)return;
    if(media.matches){setState('fallback');return}
    try{
      bitmapPipeline=typeof OffscreenCanvas!=='undefined'&&typeof OffscreenCanvas.prototype.transferToImageBitmap==='function'&&typeof ImageBitmapRenderingContext!=='undefined'&&typeof createImageBitmap==='function';
      const rawAccent=getComputedStyle(root).getPropertyValue('--ac').trim(),accent=/^(#[a-f\d]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(rawAccent)?rawAccent:'';
      remote=await startMaterialWorker({accent,onLost(){contextLost=true;invalidateTransfers();clearSurfaces();setState('fallback')},onRestored(){if(destroyed||failed)return;contextLost=false;requestPaint(true)},onFailure(){if(!destroyed)failRenderer()}});
      if(destroyed){remote?.destroy();return}
      if(remote){renderer={capabilities:{maxTextureSize:remote.maxTextureSize},info:{render:{calls:0}},setSize(){},dispose(){},forceContextLoss(){}}}
      else{
      three=await import('./vendor/three.module.min.js');if(destroyed)return;
      atlas=bitmapPipeline?new OffscreenCanvas(1,1):document.createElement('canvas');
      const contextAttributes={alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:false,powerPreference:'low-power'};
      const context=atlas.getContext('webgl2',contextAttributes);
      if(!context){setState('fallback');return}
      createRenderer=()=>{const value=new three.WebGLRenderer({canvas:atlas,context,...contextAttributes});value.setPixelRatio(1);value.autoClear=false;value.toneMapping=three.NoToneMapping;value.outputColorSpace=three.SRGBColorSpace;rendererSize.width=rendererSize.height=0;return value};
      renderer=createRenderer();
      scene=new three.Scene();camera=new three.OrthographicCamera(-1,1,1,-1,0,1);geometry=createGeometry();
      const accent=getComputedStyle(root).getPropertyValue('--ac').trim(),color=new three.Color(0xd4af68);
      if(/^(#[a-f\d]{3,8}|rgba?\([\d.,%\s]+\))$/i.test(accent))color.setStyle(accent);
      material=new three.ShaderMaterial({
        vertexShader:invitationVertexShader,fragmentShader:invitationFragmentShader,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,blending:three.NormalBlending,
        uniforms:{uAccent:{value:color},uOpening:{value:latest.opening},uCard:{value:latest.card},uDepth:{value:latest.depth}}
      });
      mesh=new three.Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
      }
      host.dataset.webglBackend=remote?'worker':'main';
      resizeObserver=new ResizeObserver(entries=>{
        const small=mobile();let allocate=false;
        for(const entry of entries){const surface=observedSurfaces.get(entry.target);if(surface)allocate=measureSurface(surface,small)||allocate}
        requestPaint(allocate);
      });
      if(typeof IntersectionObserver!=='undefined'){
        intersectionObserver=new IntersectionObserver(entries=>{
          for(const entry of entries){if(entry.target===host)hostInView=entry.isIntersecting;const surface=observedSurfaces.get(entry.target);if(surface)surface.inView=entry.isIntersecting}
          requestPaint();
        },{rootMargin:'80px'});
        intersectionObserver.observe(host);
      }
      addSurface(root,'paper',0);
      let index=1;
      if(openingRoot)for(const element of openingRoot.querySelectorAll(OPENING_SURFACES)){if(surfaces.length>=15)break;addSurface(element,'opening',index++)}
      for(const element of [...host.querySelectorAll('.guest-hero,#guest-place')].slice(0,2)){
        if(surfaces.length>=15)break;
        addSurface(element,'paper',index++);surfaces[surfaces.length-1].section=true;
      }
      addSurface(document.body,'atmosphere',index);
      if(atlas){listen(atlas,'webglcontextlost',event=>{event.preventDefault();contextLost=true;invalidateTransfers();clearSurfaces();setState('fallback')});
      listen(atlas,'webglcontextrestored',()=>{
        if(destroyed||failed)return;
        try{
          // A transferred OffscreenCanvas can restore with invalidated backing
          // images. Rebuild GPU resources on the same context; don't reuse old
          // VAOs/programs or let a pre-loss bitmap resurface.
          invalidateTransfers();
          const restoredMaterial=material.clone();geometry.dispose();material.dispose();renderer.dispose();
          renderer=createRenderer();geometry=createGeometry();material=restoredMaterial;mesh.geometry=geometry;mesh.material=material;
          contextLost=false;ready=true;requestPaint(true);
        }catch{failRenderer()}
      });}
      listen(window,'resize',()=>viewportResize(),{passive:true});
      listen(window,'orientationchange',()=>viewportResize(true),{passive:true});
      if(window.visualViewport)listen(window.visualViewport,'resize',()=>viewportResize(),{passive:true});
      listen(document,'visibilitychange',()=>{if(document.hidden){invalidateTransfers();setState('suspended')}else requestPaint()});
      listen(window,'beforeprint',()=>{printing=true;invalidateTransfers();setState('suspended')});
      listen(window,'afterprint',()=>{printing=false;requestPaint(true)});
      listen(printMedia,'change',event=>{
        printing=event.matches;
        if(printing){invalidateTransfers();setState('suspended')}else requestPaint(true);
      });
      listen(media,'change',event=>{if(event.matches){invalidateTransfers();clearSurfaces();setState('fallback')}else requestPaint(true)});
      ready=true;metadata();requestPaint(true);
    }catch{
      failRenderer();
    }
  }).catch(()=>setState('fallback'));
  return controller;
}
