import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_WATER_EFFECTS,effectiveWaterEffects,waterEffectsSettings,waterEffectSize} from '../src/viewer/waterEffectsSettings';
import {createWater,sampleWater} from '../src/viewer/water';
import {enhancedSurfaceGeometry} from '../src/viewer/enhancedWater/surfaceGeometry';
import {prepareGeometryLods} from '../src/models/shared/lod/geometry';
import {createNodeStyleEnvironment,applyNodeStyle,refreshNodeStyle} from '../src/viewer/nodeStyle';
import {BoxGeometry,Group,Mesh,MeshToonMaterial} from 'three';
import {vec3} from 'three/tsl';
test('Enhanced water is never inferred from capability, and WebGL always retains Balanced',()=>{
 assert.equal(effectiveWaterEffects(DEFAULT_WATER_EFFECTS,true).mode,'balanced');
 assert.equal(effectiveWaterEffects({...DEFAULT_WATER_EFFECTS,mode:'enhanced'},false).mode,'balanced');
 assert.equal(effectiveWaterEffects({...DEFAULT_WATER_EFFECTS,mode:'enhanced'},true).mode,'enhanced');
 for(const invalid of [null,{},'high',{mode:'ultra',shafts:999},{shafts:NaN}])assert.deepEqual(waterEffectsSettings(invalid),DEFAULT_WATER_EFFECTS);
 assert.deepEqual(waterEffectsSettings({mode:'enhanced',caustics:false,shafts:24}),{mode:'enhanced',caustics:false,shafts:24});
 assert.equal(DEFAULT_WATER_EFFECTS.mode,'balanced','capability resolution never mutates defaults');
});
test('enhanced render targets are bounded on high-DPI and ultrawide displays',()=>{
 for(const [width,height]of [[3840,2160],[7680,4320],[10000,1000],[390,844],[1,1]]){
  const s=waterEffectSize(width,height);assert(s.width<=1920&&s.height<=1080);assert(s.width>=1&&s.height>=1);
  assert(s.width<=width&&s.height<=height);assert(s.width*s.height<=2073600);
 }
});
test('Balanced water has no high-detail patch and the optional patch preserves its wave samples at all LODs',async()=>{
 const water=createWater({width:20,depth:20,segments:2,profile:'open',refract:false});
 const original=water.root.geometry,originalPositions=Array.from(original.attributes.position.array),before=sampleWater(4,3,5);
 const enhanced=enhancedSurfaceGeometry(original);
 try{
  assert.equal(original.hasAttribute('waterPatch'),false);assert.equal(original.index!.count/3,8);
  assert.equal(enhanced.index!.count/3,32776);assert.equal(enhanced.attributes.waterPatch.count,enhanced.attributes.position.count);
  const lod=await prepareGeometryLods(enhanced);assert.equal(lod.near,lod.mid);assert.equal(lod.near,lod.far);
  assert.deepEqual(Array.from(original.attributes.position.array),originalPositions);assert.deepEqual(sampleWater(4,3,5),before);
 }finally{enhanced.dispose();water.dispose();}
});
test('late optional material binding retains sharing and releases each source once',()=>{
 const source=new MeshToonMaterial(),g=new BoxGeometry(),root=new Group(),env=createNodeStyleEnvironment();let released=0;
 source.addEventListener('dispose',()=>released++);root.add(new Mesh(g,source),new Mesh(g,source));applyNodeStyle(root,false,env);
 const old=(root.children[0] as Mesh).material;env.waterLighting={caustics:()=>vec3(0),attenuation:()=>vec3(.8,.9,1)};
 refreshNodeStyle(root,false,env);const next=(root.children[0] as Mesh).material;
 assert.notEqual(old,next);assert.equal(next,(root.children[1] as Mesh).material);assert.equal(released,0);
 assert(!Array.isArray(next));next.dispose();assert.equal(released,1);g.dispose();env.dispose();
});
