import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3, Mesh, Vector3, BufferAttribute} from 'three';
import {propCollection} from '../src/models/props/catalogue';
import {disposeObject} from '../src/models/props/primitives';
import {sampleWater} from '../src/viewer/water';

test('Water slopes agree with numerical derivatives and still water is flat',()=>{
 for(const [x,z,t] of [[0,0,0],[-3,3.5,4],[2.9,-2,23],[14,-10,100]]){
  const s=sampleWater(x,z,t),step=1e-5;
  assert.ok(Math.abs(s.dx-(sampleWater(x+step,z,t).height-sampleWater(x-step,z,t).height)/(2*step))<1e-7);
  assert.ok(Math.abs(s.dz-(sampleWater(x,z+step,t).height-sampleWater(x,z-step,t).height)/(2*step))<1e-7);
  assert.deepEqual(sampleWater(x,z,t,0),{height:0,dx:0,dz:0});
  assert.ok(Math.abs(sampleWater(x,z,t,1.5).height)<.2,'Water stays clear of display base');
 }
});

test('All props have finite geometry, useful scale, independent instances and release their resources',()=>{
 for(const entry of propCollection){
  const a=entry.create(),b=entry.create();assert.notEqual(a,b);
  const size=new Box3().setFromObject(a).getSize(new Vector3());assert.ok(size.x>0&&size.y>0&&size.z>0&&size.length()<15,entry.id);
  const geometries=new Set(),materials=new Set();let releases=0;
  a.traverse(o=>{if(o instanceof Mesh){
   for(const attribute of Object.values(o.geometry.attributes) as BufferAttribute[])for(const value of attribute.array)assert.ok(Number.isFinite(value),entry.id);
   geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);
  }});
  for(const resource of [...geometries,...materials] as any[])resource.addEventListener('dispose',()=>releases++);
  disposeObject(a);assert.equal(releases,geometries.size+materials.size,entry.id);assert.ok(b.children.length>0);disposeObject(b);
 }
});
