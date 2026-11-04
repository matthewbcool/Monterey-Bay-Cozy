import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {Color,LinearFilter,RedFormat,Vector3} from 'three';
import {createWaterDepth} from '../src/viewer/waterDepth';
import {createWater} from '../src/viewer/water';
import {STYLE} from '../src/models/shared/style';
const bounds={minX:100,maxX:120,minZ:-80,maxZ:-60};
test('optical depth records metres at world-grid endpoints, saturates deep/invalid data, and stays small',()=>{
 const field=createWaterDepth({bounds,surfaceY:1,width:3,height:3,maxDepth:32,floorAt:(x,z)=>1-(x-100)-(z+80)});
 try{
  const data=field.map.image.data;
  for(let z=0;z<3;z++)for(let x=0;x<3;x++)assert(Math.abs(data[z*3+x]/255*32-Math.min(32,(x+z)*10))<=32/510);
  assert.equal(field.map.format,RedFormat);assert.equal(field.map.minFilter,LinearFilter);assert.equal(field.map.generateMipmaps,false);
  assert.equal(field.bytes,9);assert.equal(data[8],255);
 }finally{field.dispose();}
 const fallback=createWaterDepth({bounds,surfaceY:1,width:2,height:2,floorAt:x=>x===100?10:NaN});
 assert.deepEqual([...fallback.map.image.data],[0,255,0,255]);fallback.dispose();
 const standard=createWaterDepth({bounds,surfaceY:1,floorAt:()=>-4});assert.equal(standard.bytes,49152);standard.dispose();
});
test('moving the source coordinate frame preserves optical depths and leaves the source bounds untouched',()=>{
 const source={bounds,surfaceY:1,width:4,height:4,floorAt:(x:number,z:number)=>-.1*(x+z)};
 const a=createWaterDepth(source),b=createWaterDepth({...source,bounds:{minX:0,maxX:20,minZ:0,maxZ:20},floorAt:(x,z)=>source.floorAt(x+100,z-80)});
 try{assert.deepEqual(a.map.image.data,b.map.image.data);a.bounds.minX=999;assert.equal(bounds.minX,100);}finally{a.dispose();b.dispose();}
});
test('invalid optical fields reject unbounded allocation and unusable coordinates',()=>{
 const source={bounds,surfaceY:1,floorAt:()=>-4};
 for(const invalid of [{width:1},{height:513},{width:Infinity},{maxDepth:0},{surfaceY:NaN},{bounds:{...bounds,maxX:99}}])assert.throws(()=>createWaterDepth({...source,...invalid}),/Invalid water depth/);
});
test('water owns one depth field, samples only at construction, and reuses it through animation and quality changes',()=>{
 let samples=0,disposed=0;
 const water=createWater({width:20,depth:20,segments:2,profile:'open',refract:false,depthSource:{bounds,surfaceY:1,width:4,height:4,floorAt:()=>{samples++;return -3;}}});
 const field=water.depthField!;field.map.addEventListener('dispose',()=>disposed++);const version=field.map.version,position=water.root.geometry.attributes.position,positions=Array.from(position.array);
 try{
  for(let i=0;i<120;i++){water.update(i/60);water.setWake(i,0,0,1);}
  water.setRefraction(true);water.setRefraction(false);
  assert.equal(samples,16);assert.equal(water.depthField,field);assert.equal(field.map.version,version);assert.deepEqual(Array.from(position.array),positions);
  assert.equal(water.material.transparent,false);assert.equal(water.root.geometry.index!.count/3,8);
 }finally{water.dispose();}assert.equal(disposed,1);
});
test('sun glints follow direct-light coverage, with safe copied uniforms and daylight reset',()=>{
 const water=createWater({width:2,depth:2,segments:1,profile:'open',refract:false});
 const environment={sunDirection:new Vector3(1,1,0),skyZenith:new Color('#90bbee'),skyHorizon:new Color('#dbe7e7'),lightLevel:1};
 const graph=water.material.colorNode,color=new Color('#ffcc99');
 try{
  water.setEnvironment({...environment,sunStrength:.2,sunColor:color});color.set('#000000');assert.equal(water.uniforms.sunStrength.value,.2);assert.notEqual(water.uniforms.sunColor.value.getHex(),0);
  water.setEnvironment({...environment,sunStrength:-1});assert.equal(water.uniforms.sunStrength.value,0);
  water.setEnvironment({...environment,sunStrength:8});assert.equal(water.uniforms.sunStrength.value,1);
  water.setEnvironment({...environment,sunStrength:NaN});assert.equal(water.uniforms.sunStrength.value,1);
  water.setEnvironment({...environment,sunStrength:0});water.resetEnvironment();assert.equal(water.uniforms.sunStrength.value,1);assert(water.uniforms.sunColor.value.equals(STYLE.sun.color));assert.equal(water.material.colorNode,graph);
 }finally{water.dispose();}
});
