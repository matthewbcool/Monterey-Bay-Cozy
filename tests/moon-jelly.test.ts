import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Vector3} from 'three';
import {createMoonJelly} from '../src/models/habitat/moon-jelly/createMoonJelly';
import {applyJellyPose,jellyContraction} from '../src/models/habitat/moon-jelly/motion';
import {createMoonJellyModel} from '../src/models/moon-jelly/createMoonJellyModel';
import {exportableClone} from '../src/models/shared/style';
import {disposeObject} from '../src/models/props/primitives';

test('Jelly: 60 seeded specimens retain two draws, bounded morphs, finite normals and a 25 cm relaxed bell',()=>{
 let first:Float32Array|undefined,second:Float32Array|undefined;
 for(let seed=0;seed<60;seed++){
  const root=createMoonJelly({seed}),meshes=root.children as Mesh[],bell=meshes.find(m=>m.name==='moon-jelly-bell')!;
  assert.deepEqual(root.scale.toArray(),[1,1,1]);assert.equal(meshes.length,2);
  assert.equal(meshes.reduce((n,m)=>n+m.geometry.index!.count/3,0),1482);
  const pos=bell.geometry.attributes.position;let width=0;for(let i=0;i<pos.count;i++)width=Math.max(width,Math.hypot(pos.getX(i),pos.getZ(i))*2);assert.ok(width>.245&&width<=.250001);
  for(const mesh of meshes){
   const g=mesh.geometry;assert.equal(g.morphAttributes.position!.length,2);assert.equal(g.morphAttributes.normal!.length,2);
   for(const attr of [g.attributes.position,g.attributes.normal,...g.morphAttributes.position!,...g.morphAttributes.normal!])assert.ok(Array.from(attr.array).every(Number.isFinite));
   for(const a of [0,1])for(const b of [0,1]){
    mesh.morphTargetInfluences!.splice(0,2,a,b);
    for(let i=0;i<g.attributes.position.count;i++)assert.ok(g.boundingBox!.containsPoint(mesh.getVertexPosition(i,new Vector3())),'Combined targets fit the culling bound');
   }
  }
  if(seed===0)first=new Float32Array(bell.geometry.attributes.position.array);
  if(seed===1)second=new Float32Array(bell.geometry.attributes.position.array);
  disposeObject(root);
 }
 assert.notDeepEqual(first,second,'The seed changes the crown, not just the initial time');
 const repeat=createMoonJelly({seed:0});assert.deepEqual((repeat.children[1] as Mesh).geometry.attributes.position.array,first);disposeObject(repeat);
});

test('Jelly: four horseshoes, four folded oral arms and a short fringe retain their distinct source systems',()=>{
 const root=createMoonJelly({seed:42}),organs=root.children[0] as Mesh,components=organs.geometry.userData.components as {name:string;start:number;count:number}[];
 assert.equal(components.filter(p=>p.name.startsWith('horseshoe-')).length,4);
 assert.equal(components.filter(p=>p.name.startsWith('ruffled-oral-arm-')).length,4);
 assert.equal(components.filter(p=>p.name.startsWith('short-fringe-')).length,48);
 const p=organs.geometry.attributes.position,target=organs.geometry.morphAttributes.position![1];
 for(let i=0;i<p.count;i++)if(p.getY(i)>=-.005){assert.equal(p.getX(i),target.getX(i));assert.equal(p.getY(i),target.getY(i));assert.equal(p.getZ(i),target.getZ(i));}
 disposeObject(root);
});

test('Jelly stroke contracts quickly, relaxes longer and trails behind the bell without moving its root',()=>{
 assert.equal(jellyContraction(0),0);assert.ok(Math.abs(jellyContraction(.3*2*Math.PI)-1)<1e-12);assert.equal(jellyContraction(2*Math.PI),0);
 assert.ok(jellyContraction(.15*2*Math.PI)>.49&&jellyContraction(.15*2*Math.PI)<.51);
 assert.ok(jellyContraction(.65*2*Math.PI)>.49&&jellyContraction(.65*2*Math.PI)<.51);
 const root=createMoonJelly({seed:0}),meshes=root.children as Mesh[];root.position.set(1,2,3);
 applyJellyPose(meshes,.3*2*Math.PI);assert.notEqual(meshes[0].morphTargetInfluences![0],meshes[0].morphTargetInfluences![1]);
 assert.deepEqual(meshes[0].morphTargetInfluences,meshes[1].morphTargetInfluences);assert.deepEqual(root.position.toArray(),[1,2,3]);
 applyJellyPose(meshes,2,true);assert.deepEqual(meshes[0].morphTargetInfluences,[1,0]);disposeObject(root);
});

test('Jelly physical size, both morph targets, collider and mouth anchor scale together',()=>{
 const a=createMoonJellyModel({seed:4}),b=createMoonJellyModel({seed:4,diameterMeters:.5});
 for(let i=0;i<2;i++){
  const small=(a.visual.children[i] as Mesh).geometry,large=(b.visual.children[i] as Mesh).geometry;
  for(const [p,q] of [[small.attributes.position,large.attributes.position],...small.morphAttributes.position!.map((p,j)=>[p,large.morphAttributes.position![j]])]){
   for(let n=0;n<p.array.length;n++)assert.ok(Math.abs(p.array[n]*2-q.array[n])<1e-7);
  }
 }
 assert.equal(b.physics.colliders[0].radius,a.physics.colliders[0].radius*2);
 assert.deepEqual(b.physics.anchors.mouth,a.physics.anchors.mouth.map(n=>n*2));a.dispose();b.dispose();
});

test('Optional GLB material conversion retains translucent tissue and membrane',()=>{
 const root=createMoonJelly({seed:0}),exported=exportableClone(root);
 for(let i=0;i<2;i++){
  const original=(root.children[i] as Mesh).material as any,converted=(exported.clone.children[i] as Mesh).material as any;
  assert.equal(converted.opacity,original.opacity);assert.equal(converted.transparent,true);assert.equal(converted.depthWrite,false);assert.equal(converted.side,original.side);
 }
 exported.dispose();disposeObject(root);
});
