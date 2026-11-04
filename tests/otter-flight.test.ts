import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Group } from 'three';
import { createFlightController, OTTER_FLIGHT } from '../src/viewer/testingGym/flightController';
import { createAvatarModel, DEFAULT_AVATAR_DESIGN } from '../src/models/avatar';
import { createLodController } from '../src/models/shared/lod/controller';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
test('flight climbs, hovers, blocks walls, clamps the region and lands on terrain',()=>{
 const root=new Group();root.position.y=8;
 const f=createFlightController(root,bounds,()=>8,[{minX:8,maxX:12,minZ:-10,maxZ:10,top:20}]);f.launch();
 for(let i=0;i<120;i++)f.update(1/60,{x:1,z:0,run:true});assert(root.position.x<8,'No tunnelling into a building');
 for(let i=0;i<120;i++)f.update(1/60,{x:0,z:0,run:false,jump:true});assert(root.position.y>20);
 for(let i=0;i<300;i++)f.update(1/60,{x:1,z:0,run:true});assert(root.position.x<=100);assert(root.position.x>90);
 for(let i=0;i<120;i++)f.update(1/60,{x:0,z:0,run:false});const y=root.position.y;
 for(let i=0;i<120;i++)f.update(1/60,{x:0,z:0,run:false});assert(Math.abs(root.position.y-y)<.01,'Release holds altitude');
 for(let i=0;i<1200;i++)f.update(1/60,{x:0,z:0,run:false,jump:true});assert(root.position.y<=OTTER_FLIGHT.ceiling);
 for(let i=0;i<1500;i++)f.update(1/60,{x:0,z:0,run:false,dive:true});assert(!f.active);assert(Math.abs(root.position.y-8)<.14);
});
test('flight handles invalid input, large frame gaps and ocean descent without a false land',()=>{
 const root=new Group();root.position.y=5;const f=createFlightController(root,bounds,()=>1);f.launch();
 f.update(Infinity,{x:NaN,z:Infinity,run:false});f.update(10,{x:NaN,z:Infinity,run:false,jump:true});assert(root.position.toArray().every(Number.isFinite));assert(root.position.y<7);
 for(let i=0;i<120;i++)f.update(1/60,{x:0,z:0,run:false,dive:true});assert(f.active);assert(root.position.y>=1);
});
test('Otter Man fits size extremes, preserves saved outfit and stays one draw through all LODs',async()=>{
 for(const heightMeters of [1.2,1.8])for(const bodyBuild of [.8,1.2]){
  const design={...DEFAULT_AVATAR_DESIGN,heightMeters,bodyBuild},m=createAvatarModel(design,{gear:'otter-man'}),lod=createLodController();
  assert.equal(m.design.topColor,design.topColor);assert(m.stats.triangles<=5000);assert.equal(m.stats.draws,1);
  await lod.register(m.root);const costs=lod.stats(m.root);assert(costs.far.triangles<costs.near.triangles);
  for(const a of Object.values(m.mesh.geometry.attributes))assert(Array.from(a.array).every(Number.isFinite));
  for(let i=0;i<180;i++)m.update(1/60,{flying:true,speed:42});assert(m.bones.every(b=>b.position.toArray().every(Number.isFinite)));
  lod.dispose();m.dispose();
 }
});

test('four suit jets follow the rig, forward flight becomes prone and boost strengthens feet',async()=>{
 const {OTTER_JETS,JOINT}=await import('../src/models/avatar/geometry');
 const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN},{gear:'otter-man'}),lod=createLodController();
 const placement=m.root.position.clone();assert.equal(m.bones.length,21);assert.equal(m.stats.draws,1);
 assert.equal(m.mesh.material.userData.otterArmor,true);
 for(const j of Object.values(OTTER_JETS))assert(m.bones[j].scale.y<.001);
 for(let i=0;i<90;i++)m.update(1/60,{flying:true,speed:18,reducedMotion:true});
 const cruise=m.getState();assert(cruise.flightPitch>1.4);assert(cruise.handThrust>0&&cruise.footThrust>0);
 assert(m.bones[JOINT.hips].rotation.x>1.4);assert.deepEqual(m.root.position.toArray(),placement.toArray());
 for(let i=0;i<90;i++)m.update(1/60,{flying:true,speed:42,boosting:true,reducedMotion:true});
 const boost=m.getState();assert(boost.footThrust>cruise.footThrust*2);assert(boost.handThrust<cruise.handThrust*1.2);
 m.root.updateMatrixWorld(true);await lod.register(m.root);
 for(const mode of ['near','mid','far'] as const){
  lod.setMode(mode);const {PerspectiveCamera,Vector3}=await import('three');lod.update(new PerspectiveCamera(),1000,0,true);
  const ids=m.mesh.geometry.attributes.skinIndex;
  for(const j of Object.values(OTTER_JETS))assert(Array.from(ids.array).includes(j),`${mode} retains jet ${j}`);
  const point=new Vector3();for(let i=0;i<ids.count;i++){m.mesh.getVertexPosition(i,point);assert(point.toArray().every(Number.isFinite));assert(m.mesh.boundingBox!.containsPoint(point),`${mode} motion bounds contain jet ${i}`);}
 }
 for(let i=0;i<120;i++)m.update(1/60,{flying:true,speed:0,reducedMotion:true});assert(m.getState().flightPitch<.01);
 m.update(1/60,{flying:false});for(const j of Object.values(OTTER_JETS))assert(m.bones[j].scale.y<.001);
 lod.dispose();m.dispose();
});
