/** Opt-in native-WebGPU ocean pipeline. Balanced never imports or allocates this owner.
 * Two HDR color/depth targets, optional half-resolution shafts, one output composite, one RGB atlas.
 */
import {Color,DepthTexture,Fog,HalfFloatType,Matrix4,RenderTarget,Vector2,Vector3} from 'three';
import {MeshBasicNodeMaterial,QuadMesh,PostProcessing} from 'three/webgpu';
import {abs,clamp,dot,exp,float,Fn,fwidth,getViewPosition,If,Loop,max,mix,normalize,screenUV,select,smoothstep,texture,uniform,uv,vec2,vec3,vec4} from 'three/tsl';
import {createWaterMedium} from './medium';
import {createChromaticCaustics} from './caustics';
import {enhancedSurfaceGeometry} from './surfaceGeometry';
import {waterEffectSize,type WaterEffectsSettings} from '../waterEffectsSettings';
import type {createWater} from '../water';
import type {createGymWeatherSky} from '../gymWeatherSky';
import type {NodeStyleEnvironment} from '../nodeStyle';
type N=any;
export function createEnhancedWater(renderer:any,water:ReturnType<typeof createWater>,sky:ReturnType<typeof createGymWeatherSky>,environment:NodeStyleEnvironment,initial:WaterEffectsSettings){
 const medium=createWaterMedium(water),caustics=createChromaticCaustics(water,medium);
 const worldTarget=new RenderTarget(1,1,{type:HalfFloatType,depthTexture:new DepthTexture(1,1)});worldTarget.texture.name='Enhanced water refraction backdrop';
 const sceneTarget=new RenderTarget(1,1,{type:HalfFloatType,depthTexture:new DepthTexture(1,1)});sceneTarget.texture.name='Enhanced water scene';
 const shaftTarget=new RenderTarget(1,1,{type:HalfFloatType,depthBuffer:false});shaftTarget.texture.name='Half-resolution underwater shafts';
 const u={active:uniform(0),surfaceCaustics:uniform(1),inverse:uniform(new Matrix4()),world:uniform(new Matrix4()),camera:uniform(new Vector3()),patch:uniform(new Vector2()),steps:uniform(12),shafts:uniform(0),texel:uniform(new Vector2(1,1)),fogNear:uniform(160),fogFar:uniform(480),fogColor:uniform(new Color())};
 const worldAt=(at:N,depth:N)=>u.world.mul(vec4(getViewPosition(at,depth,u.inverse),1)).xyz;
 const nearAt=(at:N)=>worldAt(at,float(0));
 const signedNear=(at:N)=>{const p=nearAt(at);return medium.height(p.xz).sub(p.y);};
 const wet=(at:N)=>{const d=signedNear(at),aa=max(.0003,fwidth(d));return smoothstep(aa.negate(),aa,d);};
 function segment(at:N){
  const near=nearAt(at),hit=worldAt(at,texture(sceneTarget.depthTexture!,at).r),delta=hit.sub(near),distance=delta.length();
  return {near,ray:normalize(delta),length:clamp(distance,0,80),wet:wet(at)};
 }
 water.setAdvancedOptics({patchOrigin:u.patch,nearWet:wet(screenUV),sky:sky.sampleSky,colorAt:(at:N)=>texture(worldTarget.texture,at).rgb,viewAt:(at:N)=>getViewPosition(at,texture(worldTarget.depthTexture!,at).r,u.inverse),integrate:medium.integrate},enhancedSurfaceGeometry(water.root.geometry));
 const previousLighting=environment.waterLighting;
 environment.waterLighting={
  attenuation(p:N){const d=medium.depth(p);return mix(vec3(1),exp(medium.kd.mul(d).negate()),u.active);},
  caustics(p:N,n:N){
   const depth=medium.depth(p),facing=max(0,dot(n,medium.down.negate()));
   return max(caustics.sample(p).sub(1),0).mul(water.uniforms.sunColor).mul(water.uniforms.sunStrength)
    .mul(exp(medium.kdSun.mul(depth).negate())).mul(facing).mul(smoothstep(0,.15,depth)).mul(.5).mul(u.active).mul(u.surfaceCaustics);
  },
 };
 const shaftMaterial=new MeshBasicNodeMaterial({name:'Underwater caustic ray march',depthTest:false,depthWrite:false,fog:false});
 shaftMaterial.fragmentNode=Fn(()=>{
  const s=segment(uv()),sum=vec3(0).toVar(),weight=float(0).toVar();
  If(s.wet.greaterThan(.5),()=>{
   Loop(24,({i})=>{If(float(i).lessThan(u.steps),()=>{
    const fraction=float(i).add(.5).div(u.steps),along=s.length.mul(fraction),p=s.near.add(s.ray.mul(along));
    const w=exp(along.mul(-.08));sum.addAssign(caustics.sample(p).mul(w));weight.addAssign(w);
   });});
  });
  return vec4(select(weight.greaterThan(0),sum.div(max(.0001,weight)),vec3(1)),s.length.mul(s.wet));
 })();
 const shaftQuad=new QuadMesh(shaftMaterial);
 const s=segment(uv()),base=texture(sceneTarget.texture,uv()).rgb;
 // Nine taps reject both depth discontinuities and pixels from the other medium.
 const sum=vec3(0).toVar(),total=float(0).toVar();
 const shaftFactor=Fn(()=>{
  If(u.shafts.greaterThan(.5),()=>{
   for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
    const at=clamp(uv().add(u.texel.mul(vec2(x,y))),.001,.999),sample=texture(shaftTarget.texture,at);
    const w=exp(abs(sample.a.sub(s.length)).mul(-.7)).mul(select(sample.a.greaterThan(.001),float(1),float(0))).mul(x===0&&y===0?2:1);
    sum.addAssign(sample.rgb.mul(w));total.addAssign(w);
   }
  });
  return select(total.greaterThan(.0001),sum.div(max(.0001,total)),vec3(1));
 })();
 const transported=medium.integrate(base,s.near,s.ray,s.length,shaftFactor);
 const sceneDepth=texture(sceneTarget.depthTexture!,uv()).r;
 const fog=smoothstep(u.fogNear,u.fogFar,worldAt(uv(),sceneDepth).sub(u.camera).length()).mul(select(sceneDepth.lessThan(.999999),float(1),float(0)));
 const dry=mix(base,u.fogColor,fog);
 const output=vec4(mix(dry,transported,s.wet),1),post=new PostProcessing(renderer,output);
 let settings={...initial},disposed=false,frames=0,atlasTime=NaN,atlasInitialized=false;
 const drawingSize=new Vector2(),focus=new Vector2(),savedClear=new Color(),atlasSun=new Vector3();
 function setSettings(next:WaterEffectsSettings){settings={...next};u.steps.value=next.shafts||12;caustics.enabled.value=next.caustics||next.shafts?1:0;u.surfaceCaustics.value=next.caustics?1:0;}
 setSettings(initial);
 function render(scene:any,camera:any){
  if(disposed)return;camera.updateMatrixWorld(true);u.inverse.value.copy(camera.projectionMatrixInverse);u.world.value.copy(camera.matrixWorld);u.camera.value.copy(camera.position);
  u.patch.value.set(Math.round((camera.position.x-water.root.position.x)*8)/8,Math.round((camera.position.z-water.root.position.z)*8)/8);
  const size=waterEffectSize(...renderer.getDrawingBufferSize(drawingSize).toArray() as [number,number]);
  const resized=sceneTarget.width!==size.width||sceneTarget.height!==size.height;
  if(resized){worldTarget.setSize(size.width,size.height);sceneTarget.setSize(size.width,size.height);shaftTarget.setSize(Math.max(1,Math.floor(size.width/2)),Math.max(1,Math.floor(size.height/2)));u.texel.value.set(1/shaftTarget.width,1/shaftTarget.height);}
  const savedTarget=renderer.getRenderTarget(),alpha=renderer.getClearAlpha();renderer.getClearColor(savedClear);
  const fog=scene.fog as Fog|null,oldNear=fog?.near,oldFar=fog?.far,skyVisible=sky.root.visible,fogEnabled=water.uniforms.fogEnabled.value;
  if(fog){u.fogNear.value=fog.near;u.fogFar.value=fog.far;u.fogColor.value.copy(fog.color);fog.near=1e7;fog.far=2e7;}
  u.active.value=1;water.uniforms.fogEnabled.value=0;sky.root.visible=true;
  try{
   // Disabled branches still have bound samplers. Initialize them after construction/
   // resize, even when the first view is dry or at night, before any material samples.
   if(!atlasInitialized){renderer.setRenderTarget(caustics.target);renderer.setClearColor(0xffffff,1);renderer.clear();atlasInitialized=true;}
   if(resized){renderer.setRenderTarget(shaftTarget);renderer.setClearColor(0xffffff,0);renderer.clear();}
   const t=water.uniforms.time.value;
   if((settings.caustics||settings.shafts)&&water.uniforms.sunStrength.value>.001&&(Math.abs(t-atlasTime)>1/30||atlasSun.distanceToSquared(water.uniforms.sun.value)>1e-8||!Number.isFinite(atlasTime)||Math.hypot(focus.x-camera.position.x,focus.y-camera.position.z)>2)){
    focus.set(camera.position.x,camera.position.z);caustics.render(renderer,focus);atlasTime=t;atlasSun.copy(water.uniforms.sun.value);
   }
   renderer.setClearColor(savedClear,alpha);
   const waterVisible=water.root.visible,autoClear=renderer.autoClear,opaque=renderer.opaque,shadowUpdate=renderer.shadowMap.autoUpdate,background=scene.background;
   try{
    water.root.visible=false;renderer.setRenderTarget(worldTarget);renderer.render(scene,camera);
    water.root.visible=waterVisible;renderer.setRenderTarget(sceneTarget);renderer.clear();
    renderer.copyTextureToTexture(worldTarget.texture,sceneTarget.texture);
    renderer.copyTextureToTexture(worldTarget.depthTexture,sceneTarget.depthTexture);
    renderer.autoClear=false;if(waterVisible)renderer.render(water.root,camera);
    // The backdrop includes translucent objects behind the water. Re-submit only
    // transparents against the finished water depth so foreground jellyfish survive.
    water.root.visible=false;renderer.opaque=false;renderer.shadowMap.autoUpdate=false;
    // Three clears a Color background even with autoClear disabled. Preserve the
    // completed opaque/water color and depth during this transparent-only pass.
    scene.background=null;renderer.render(scene,camera);
   }finally{water.root.visible=waterVisible;renderer.autoClear=autoClear;renderer.opaque=opaque;renderer.shadowMap.autoUpdate=shadowUpdate;scene.background=background;}
   u.shafts.value=settings.shafts>0&&water.uniforms.sunStrength.value>.001&&camera.position.y<water.root.position.y+1?1:0;
   if(u.shafts.value){renderer.setRenderTarget(shaftTarget);shaftQuad.render(renderer);}
   renderer.setRenderTarget(savedTarget);post.render();frames++;
  }finally{u.active.value=0;renderer.setRenderTarget(savedTarget);renderer.setClearColor(savedClear,alpha);water.uniforms.fogEnabled.value=fogEnabled;sky.root.visible=skyVisible;if(fog){fog.near=oldNear!;fog.far=oldFar!;}}
 }
 return {render,setSettings,medium,caustics,uniforms:u,
  debug:import.meta.env.DEV?{post,waterline:wet(uv())}:undefined,
  getSnapshot(){return {mode:'enhanced',settings:{...settings},sceneSize:[sceneTarget.width,sceneTarget.height],shaftSize:[shaftTarget.width,shaftTarget.height],shaftActive:!!u.shafts.value,causticTriangles:caustics.triangles,waterTriangles:water.root.geometry.index!.count/3,frames};},
  dispose(){if(disposed)return;disposed=true;environment.waterLighting=previousLighting;caustics.dispose();worldTarget.dispose();sceneTarget.dispose();shaftTarget.dispose();shaftMaterial.dispose();post.dispose();}};
}
