import test from 'node:test';
import assert from 'node:assert/strict';
import {createWater} from '../src/viewer/water';
import {createShoreFoam} from '../src/viewer/testingGym/shoreFoam';

test('Shore foam is one bounded metre-scale ribbon sharing the water clock and surviving dry cliffs',()=>{
 const water=createWater({width:20,depth:20,segments:1,profile:'open',refract:false});water.root.position.set(260,1,-180);
 const foam=createShoreFoam([[0,0],[12,0],[12,0],[24,0]],(x,z)=>x>12?8:z<0?1.2:0,(_x,z)=>z>=0,water);
 try{
  const p=foam.geometry.attributes.position;for(const v of p.array)assert(Number.isFinite(v));
  for(let i=0;i<p.count;i++){assert(p.getY(i)<=.6,'Foam cannot climb tall land');assert(p.getY(i)>=0);}
  assert.deepEqual(foam.position.toArray(),[260,1,-180]);assert.equal(foam.material.depthWrite,false);assert.equal(foam.material.forceSinglePass,true);
  assert(foam.geometry.index!.count/3<=80);assert.equal(foam.children.length,0);
  water.update(3);assert.equal(water.uniforms.time.value,3);
 }finally{foam.geometry.dispose();foam.material.dispose();water.dispose();}
});
