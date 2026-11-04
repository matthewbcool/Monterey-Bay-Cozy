import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Box3, Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { createGrayWhaleModel } from '../src/models/gray-whale/createGrayWhaleModel';
import { GRAY_WHALE } from '../src/models/gray-whale/definition';
import { modelStats } from '../src/viewer/modelStats';
import { createLodController } from '../src/models/shared/lod/controller';
import { createSwimmer, TANK_SIZE } from '../src/viewer/swimPath';

test('Gray whale has horizontal flukes, no dorsal fin and a two-draw low-poly contract',()=>{
  const whale=createGrayWhaleModel({seed:42});
  try{
    assert.equal(whale.root.userData.lengthMeters,12);
    assert.deepEqual(whale.root.scale.toArray(),[1,1,1]);
    assert.ok(whale.parts.has('surface'));
    assert.ok(!whale.parts.has('dorsal-fin'));
    const mesh=whale.parts.get('surface')!.children[0] as SkinnedMesh;
    assert.ok(mesh instanceof SkinnedMesh);
    assert.equal(mesh.skeleton.bones.length,3);
    const extent=new Box3().setFromObject(whale.root,true).getSize(new Vector3());
    assert.ok(extent.x>11&&extent.x<13,`length ${extent.x}`);
    assert.ok(extent.z>5&&extent.z<6,`fin span ${extent.z}`);
    for(const state of ['alive','caught'] as const){
      whale.setLifeState(state);const stats=modelStats(whale.root).model;
      assert.equal(stats.drawCalls,2);assert.equal(stats.triangles,state==='alive'?1520:1484);
      assert.ok(stats.triangles<=GRAY_WHALE.budget.triangles,`${state}: ${stats.triangles}`);
      assert.equal(whale.parts.get('caught-details')!.visible,state==='caught');
      assert.equal(whale.parts.get('head-details')!.visible,state==='alive');
    }
  }finally{whale.dispose();}
});

test('Gray whale generates cheaper Mid and Far LODs without changing the physics root',async()=>{
  const whale=createGrayWhaleModel({seed:8021}),lod=createLodController();
  try{
    await lod.register(whale.root);
    const stats=lod.stats(whale.root);
    assert.deepEqual([stats.near.triangles,stats.mid.triangles,stats.far.triangles],[1520,752,302]);
    assert.deepEqual([stats.near.draws,stats.mid.draws,stats.far.draws],[2,2,2]);
    assert.deepEqual(whale.root.scale.toArray(),[1,1,1]);
    const camera=new PerspectiveCamera(40,1,0.1,100);camera.position.z=25;
    for(const level of ['mid','far'] as const){
      lod.setMode(level);lod.update(camera,900,0,true);
      const mesh=whale.parts.get('surface')!.children[0] as SkinnedMesh;
      const indices=mesh.geometry.getAttribute('skinIndex'),weights=mesh.geometry.getAttribute('skinWeight');
      assert.equal(modelStats(whale.root).model.triangles,stats[level].triangles);
      for(let i=0;i<weights.count;i++){
        let sum=0;for(let j=0;j<4;j++){const weight=weights.getComponent(i,j);if(weight>0)assert.ok(indices.getComponent(i,j)<3);sum+=weight;}
        assert.ok(Math.abs(sum-1)<1e-4,`${level} skin weight ${i}`);
      }
    }
  }finally{lod.dispose();whale.dispose();}
});

test('Vertical fluke stroke responds to speed without moving physics-owned rigid root',()=>{
  const whale=createGrayWhaleModel(),root=whale.root.position.clone();
  try{
    const bones=whale.parts.get('rig')!.children[0] as Bone;
    const rear=bones.children[0] as Bone,flukes=rear.children[0] as Bone;
    whale.update(1);assert.notEqual(flukes.rotation.z,0);const slow=Math.abs(flukes.rotation.z);
    whale.setSwimMode('fast',true);whale.update(.1);
    assert.ok(Math.abs(flukes.rotation.z)>slow*.3);
    whale.setMotionOwner('physics');whale.update(.1);
    assert.deepEqual(whale.root.position.toArray(),root.toArray());
    whale.setLifeState('caught');const phase=whale.getState().phase;
    whale.update(.1);assert.equal(whale.getState().phase,phase);
    assert.equal(flukes.rotation.z,0);
    assert.equal(rear.rotation.z,0);
    const body=whale.parts.get('surface')!.children[0] as Mesh;
    for(const name of Object.keys(body.geometry.attributes))assert.ok(Array.from(body.geometry.getAttribute(name).array).every(Number.isFinite),name);
  }finally{whale.dispose();}
  assert.equal(whale.getState().disposed,true);
});

test('Length option scales geometry, collider and anchors together',()=>{
  const small=createGrayWhaleModel({lengthMeters:11}),large=createGrayWhaleModel({lengthMeters:15});
  try{
    const a=new Box3().setFromObject(small.root,true).getSize(new Vector3());
    const b=new Box3().setFromObject(large.root,true).getSize(new Vector3());
    assert.ok(Math.abs(b.x/a.x-15/11)<.001);
    assert.ok(Math.abs(large.physics.colliders[0].radius/small.physics.colliders[0].radius-15/11)<1e-6);
    assert.ok(Math.abs(large.physics.anchors.mouth[0]/small.physics.anchors.mouth[0]-15/11)<1e-6);
  }finally{small.dispose();large.dispose();}
  for(const lengthMeters of [0,-1,NaN,Infinity])assert.throws(()=>createGrayWhaleModel({lengthMeters}));
});

test('Seeded pigment is repeatable and every sampled specimen stays within budget',()=>{
  const samples:number[][]=[];
  for(let seed=0;seed<20;seed++){
    const whale=createGrayWhaleModel({seed});
    try{
      const colors=(whale.parts.get('surface')!.children[0] as Mesh).geometry.getAttribute('color');
      samples.push([colors.getX(200),colors.getY(240),colors.getZ(280)]);
      assert.equal(modelStats(whale.root).model.triangles,1520);
      assert.equal(whale.root.userData.seed,seed);
    }finally{whale.dispose();}
  }
  const repeat=createGrayWhaleModel({seed:0});
  try{
    const colors=(repeat.parts.get('surface')!.children[0] as Mesh).geometry.getAttribute('color');
    assert.deepEqual([colors.getX(200),colors.getY(240),colors.getZ(280)],samples[0]);
    assert.ok(samples.some(sample=>sample.some((value,i)=>value!==samples[0][i])));
  }finally{repeat.dispose();}
  for(const seed of [-1,.5,NaN,2**32])assert.throws(()=>createGrayWhaleModel({seed}));
});

test('Individual Tank inspection animates without sending the whale through the glass',()=>{
  const whale=createGrayWhaleModel({seed:8021}),swimmer=createSwimmer(whale,{slow:.8,fast:2});
  try{
    assert.equal(whale.getState().motionOwner,'path');
    const start=whale.getState().phase;
    whale.setSwimMode('fast',true);
    for(let i=0;i<120;i++){
      whale.update(1/60);swimmer.update(1/60,whale.getState().blend);
      const bounds=new Box3().setFromObject(whale.root,true);
      assert.ok(bounds.min.x>-TANK_SIZE.width/2&&bounds.max.x<TANK_SIZE.width/2);
      assert.ok(bounds.min.y>-TANK_SIZE.height/2&&bounds.max.y<TANK_SIZE.height/2);
      assert.ok(bounds.min.z>-TANK_SIZE.depth/2&&bounds.max.z<TANK_SIZE.depth/2);
      assert.deepEqual(whale.root.position.toArray(),[0,0,0]);
    }
    assert.notEqual(whale.getState().phase,start);
    whale.setMotionOwner('physics');whale.root.position.set(3,1,1);swimmer.update(1,1);swimmer.resume();
    assert.deepEqual(whale.root.position.toArray(),[3,1,1]);
    whale.setMotionOwner('external');swimmer.resume();assert.deepEqual(whale.root.position.toArray(),[0,0,0]);
  }finally{whale.dispose();}
});
