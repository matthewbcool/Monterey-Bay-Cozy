import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,PerspectiveCamera,BufferAttribute} from 'three';
import {createGroundSquirrel,createSquirrelBatch,squirrelWeights} from '../src/models/habitat/ground-squirrel/createGroundSquirrel';
import {SQUIRREL,SQUIRREL_POSES} from '../src/models/habitat/ground-squirrel/definition';
import {createLodController} from '../src/models/shared/lod/controller';
import {prepareGeometryLods} from '../src/models/shared/lod/geometry';
import {disposeObject} from '../src/models/props/primitives';
import {createTestingGym} from '../src/viewer/testingGym';

test('ground squirrel preserves metre-scale silhouette, seeded palette and morph topology at every LOD',async()=>{
 for(const seed of [0,17,734,0xffffffff]){
  const model=createGroundSquirrel({seed}),copy=createGroundSquirrel({seed}),lod=createLodController();await lod.register(model.root);
  try{
   assert.deepEqual(model.mesh.geometry.attributes.color.array,copy.mesh.geometry.attributes.color.array);
   const stats=lod.stats(model.root);console.log('SQUIRREL',seed,JSON.stringify(stats));
   for(const level of ['near','mid','far'] as const){assert(stats[level].triangles<=SQUIRREL.budget[level]);assert.equal(stats[level].draws,1);}
   assert(stats.far.triangles<stats.near.triangles*.5);
   const family=await prepareGeometryLods(model.mesh.geometry);
   for(const level of ['near','mid','far'] as const){const g=family[level];assert.equal(g.morphAttributes.position!.length,4);assert.equal(g.morphTargetsRelative,true);assert(g.boundingBox!.min.y>-.01&&g.boundingBox!.max.y<.36,'bounds fit actual poses, keeping library grounding accurate');
    for(const a of [...Object.values(g.attributes),...g.morphAttributes.position!,...g.morphAttributes.normal!])assert(Array.from(a.array).every(Number.isFinite));
    for(const a of g.morphAttributes.position!)assert.equal(a.count,g.attributes.position.count);
   }
   const positionVersion=(model.mesh.geometry.attributes.position as BufferAttribute).version,original=model.root.position.clone();
   for(const pose of SQUIRREL_POSES){model.setPose(pose);model.update(.1);assert(model.root.position.equals(original));assert.equal((model.mesh.geometry.attributes.position as BufferAttribute).version,positionVersion);}
   model.setPose('alert');const b=new Box3().setFromObject(model.root,true);assert(b.min.y>=-.00001&&b.max.y<.36);assert(b.max.z>.21&&b.min.z<-.07);
   const camera=new PerspectiveCamera(40,1,.01,100);camera.position.set(0,.2,1);camera.lookAt(0,.15,0);camera.updateMatrixWorld();
   const physics=JSON.stringify(model.root.userData.physics);for(const level of ['near','mid','far'] as const){lod.setMode(level);lod.update(camera,800,0,true);assert.equal(JSON.stringify(model.root.userData.physics),physics);}
  }finally{model.dispose();copy.dispose();assert.equal(lod.size,0);lod.dispose();}
 }
});
test('group retains one draw, stable slots and immutable buffers; generic disposal releases its morph texture',async()=>{
 const group=createSquirrelBatch({count:8,seed:734}),lod=createLodController();await lod.register(group.root);
 const originalMatrix=group.mesh.instanceMatrix,texture=group.mesh.morphTexture,geometry=group.mesh.geometry,version=(geometry.attributes.position as BufferAttribute).version;
 const helper=new Mesh(geometry,group.mesh.material),weights=[0,0,0,0];
 group.setPose('forage');for(let i=0;i<50;i++)group.update(.02);group.mesh.getMorphAt(0,helper);
 const expected=squirrelWeights(weights,'forage',1);assert(helper.morphTargetInfluences!.every((w,i)=>Math.abs(w-expected[i])<.1));
 assert.equal(group.mesh.instanceMatrix,originalMatrix);assert.equal(group.mesh.morphTexture,texture);assert.equal((geometry.attributes.position as BufferAttribute).version,version);assert.equal(group.mesh.count,8);assert.equal(lod.stats(group.root).near.draws,1);
 let disposed=0;texture!.addEventListener('dispose',()=>disposed++);disposeObject(group.root);assert.equal(disposed,1);assert.equal(lod.size,0);group.dispose();assert.equal(disposed,1);lod.dispose();
 assert.throws(()=>createSquirrelBatch({count:0}));assert.throws(()=>createSquirrelBatch({count:33}));assert.throws(()=>createGroundSquirrel({seed:NaN}));
});
test('eight rockside squirrels avoid paving, water and solid obstacles and sleep at distance',()=>{
 const gym=createTestingGym({whaleSightingRoll:.8}),s=gym.squirrels;
 try{
  assert.equal(s.animals.length,8);assert.equal(new Set(s.animals.map(a=>a.id)).size,8);
  for(const a of s.animals){assert(s.safe(a.position.x,a.position.z));assert(a.home.x>75&&a.home.z< -75);}
  const home=s.animals[0].home;s.setViewer(home.x,home.z);s.setPlayer(home.x,home.y,home.z);
  for(let i=0;i<1200;i++){s.update(1/60);for(const a of s.animals){assert(s.safe(a.position.x,a.position.z));assert(Math.hypot(a.position.x-a.home.x,a.position.z-a.home.z)<3.01);assert(Math.abs(a.position.y-gym.groundHeight(a.position.x,a.position.z))<1e-7);}}
  assert(s.animals[0].position.distanceTo(home)>.1,'nearby player causes retreat');
  s.setViewer(-1000,-1000);const state=JSON.stringify(s.stats().positions),version=s.batch.mesh.instanceMatrix.version;s.update(10);assert.equal(JSON.stringify(s.stats().positions),state);assert.equal(s.batch.mesh.instanceMatrix.version,version);assert(!s.root.visible);
  s.setViewer(home.x,home.z);s.update(.05,false);assert.equal(JSON.stringify(s.stats().positions),state);
 }finally{gym.dispose();gym.dispose();}
});
