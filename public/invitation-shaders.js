/* Materials are a function of the invitation's scroll clocks. There is no
   autonomous time uniform: a held or reversed scroll has the same lighting. */
export const invitationVertexShader=/* glsl */`
varying vec2 vUv;
void main(){
  vUv=uv;
  gl_Position=vec4(position.xy,0.0,1.0);
}`;

export const invitationFragmentShader=/* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uCssSize;
uniform vec2 uTilt;
uniform vec3 uAccent;
uniform float uOpening;
uniform float uCard;
uniform float uDepth;
uniform float uSeed;
uniform float uMode;

float hash(vec2 p){
  p=fract(p*vec2(123.34,456.21));
  p+=dot(p,p+45.32);
  return fract(p.x*p.y);
}
float line(float value,float center,float width){
  return 1.0-smoothstep(width*.35,width,abs(value-center));
}
float softLight(vec2 point,vec2 center,vec2 radius){
  vec2 d=(point-center)/radius;
  return exp(-dot(d,d));
}

void atmosphere(){
  vec2 uv=vUv;
  float travel=uDepth*.74+uOpening*.24;
  // Broad translucent caustics follow the same scroll depth as the HTML scene.
  float wave=sin(uv.x*4.0+uv.y*2.3-travel*5.0);
  float ribbons=exp(-pow((uv.y-.44-wave*.13+travel*.16)*5.5,2.0));
  float left=softLight(uv,vec2(.03+travel*.13,.72-travel*.31),vec2(.35,.43));
  float right=softLight(uv,vec2(.99-travel*.07,.19+travel*.36),vec2(.31,.49));
  float centerMask=smoothstep(.12,.41,abs(uv.x-.5));
  float glow=(left*.055+right*.045+ribbons*.017)*(centerMask*.75+.25);
  float dust=0.0;
  // A fixed small constellation, rather than a particle simulation or emitter.
  for(int i=0;i<9;i++){
    float fi=float(i)+uSeed;
    vec2 origin=vec2(hash(vec2(fi,3.2)),hash(vec2(1.8,fi)));
    origin.y=fract(origin.y+travel*(.018+hash(vec2(fi,9.1))*.033));
    origin.x+=sin(fi*2.1+travel*2.0)*.009;
    vec2 d=(uv-origin)*uCssSize;
    float radius=.75+hash(vec2(fi,8.8))*.65;
    float soft=exp(-dot(d,d)/(radius*radius*3.0));
    dust+=soft*(.05+.025*sin(travel*3.0+fi));
  }
  vec3 champagne=mix(vec3(.96,.77,.44),uAccent,.18);
  gl_FragColor=vec4(champagne,clamp(glow+dust,0.0,.105));
}

void paper(){
  vec2 uv=vUv;
  vec2 px=uv*uCssSize;
  float opening=uOpening;
  float phase=opening*.78+uCard*.13+uDepth*.29;
  float angle=-.38+opening*.84+uTilt.x*.35-uTilt.y*.24;
  vec2 lightDirection=normalize(vec2(cos(angle),sin(angle)));
  float lightPosition=-.35+phase*1.48+uTilt.x*.18+uSeed*.013;
  float sweep=dot(uv-vec2(.5),lightDirection)+.5;
  float broad=exp(-pow((sweep-lightPosition)*3.6,2.0));
  float gleam=exp(-pow((sweep-lightPosition)*36.0,2.0));
  float foldedLight=.69+.31*cos(opening*3.14159265+uTilt.x*1.4);

  // Paper fibres are static in material coordinates; only the incident light moves.
  float fibres=hash(floor(px*vec2(.58,2.6))+uSeed);
  float crossGrain=hash(floor(px*vec2(2.1,.42))+uSeed*1.71);
  float grain=(fibres*.63+crossGrain*.37)-.5;
  float brushed=sin(px.y*1.34+grain*2.1)*.5+.5;

  float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
  float edgeMask=1.0-smoothstep(.018,.125,edge);
  // Two fine, recessed foil rules stay near the existing border, never over names.
  float foilRule=line(edge,.027,.0018)+line(edge,.034,.0009)*.45;
  float cornerMask=pow(abs(uv.x-.5)*2.0,7.0)*pow(abs(uv.y-.5)*2.0,5.0);
  float etching=(sin((uv.x+uv.y)*146.0+uSeed)*.5+.5)*cornerMask;
  float goldReflection=(broad*.12+gleam*.28)*edgeMask;
  float foil=foilRule*(.10+broad*.19+gleam*.36)+goldReflection;
  foil+=etching*.065*foldedLight;
  float paperGlow=broad*.018+max(grain,0.0)*.021+brushed*.0025;
  // A subdued centre protects contrast of text and the client's photograph.
  float centerProtection=mix(.25,1.0,smoothstep(.08,.34,abs(uv.x-.5)));
  paperGlow*=centerProtection;
  float alpha=(foil+paperGlow)*(.78+foldedLight*.22);
  alpha*=uMode>2.5?.30:uMode>.5?.82:1.0;
  vec3 gold=mix(vec3(.89,.66,.24),uAccent,.16);
  vec3 silk=vec3(1.0,.95,.83);
  vec3 color=mix(gold,silk,clamp(gleam*.62+broad*.22+grain*.12,0.0,.85));
  gl_FragColor=vec4(color,clamp(alpha,0.0,.32));
}

void main(){
  if(uMode>1.5&&uMode<2.5)atmosphere();
  else paper();
}`;
