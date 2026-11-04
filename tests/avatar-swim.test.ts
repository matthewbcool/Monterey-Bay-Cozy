import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { createAvatarModel, DEFAULT_AVATAR_DESIGN, type AvatarEmote } from '../src/models/avatar';
import { createLodController } from '../src/models/shared/lod/controller';

function advance(model:ReturnType<typeof createAvatarModel>,seconds:number,speed:number,swimming=true,reducedMotion=false,hz=60){
  for(let i=0;i<seconds*hz;i++)model.update(1/hz,{speed,swimming,reducedMotion});
}
function angles(model:ReturnType<typeof createAvatarModel>){return model.bones.flatMap(b=>[b.rotation.x,b.rotation.y,b.rotation.z]);}

test('Swimming transitions smoothly without moving the controller-owned root or changing geometry',()=>{
  const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,faceLines:'defined'}),g=m.mesh.geometry;
  const buffers=Object.values(g.attributes).map(a=>a.array.slice()),stats={...m.stats};
  m.root.position.set(8,2.42,-7);m.root.rotation.set(.1,.7,.2);const position=m.root.position.clone(),rotation=m.root.quaternion.clone();
  m.update(1/60,{swimming:true,speed:1.7});assert.ok(m.getState().swimming>0&&m.getState().swimming<.2);
  advance(m,2,1.7);assert.ok(m.getState().swimming>.999);assert.equal(m.getState().swimmingActive,true);assert.ok(m.bones[0].rotation.x>.99);
  advance(m,2,1.7,false);assert.ok(m.getState().swimming<.000001);assert.equal(m.getState().swimmingActive,false);assert.ok(Math.abs(m.bones[0].rotation.x)<.000001);
  assert.ok(m.root.position.equals(position));assert.ok(m.root.quaternion.equals(rotation));assert.deepEqual(m.root.scale.toArray(),[1,1,1]);assert.deepEqual(m.stats,stats);
  Object.values(g.attributes).forEach((a,i)=>assert.deepEqual(a.array,buffers[i]));
  const state=m.getState();for(const dt of [NaN,Infinity,-.1])m.update(dt,{swimming:true});assert.deepEqual(m.getState(),state);
  m.dispose();m.update(.1,{swimming:true});assert.equal(m.getState().swimming,state.swimming);
});

test('Stationary swimmers visibly tread; movement switches to a pitched stroke with the face above water',()=>{
  const m=createAvatarModel(),face=new Vector3();m.root.position.y=-.78;
  advance(m,2,0);assert.ok(m.bones[0].rotation.x>.23&&m.bones[0].rotation.x<.25);
  const still=angles(m);advance(m,.25,0);assert.notDeepEqual(angles(m),still,'zero speed still animates sculling and kicks');
  advance(m,2,1.7);let minFace=Infinity;
  for(let i=0;i<120;i++){
    m.update(1/60,{speed:1.7,swimming:true});m.root.updateMatrixWorld(true);
    face.set(0,.168,.235).applyMatrix4(m.anchors.head.matrixWorld);minFace=Math.min(minFace,face.y);
  }
  assert.ok(minFace>.12,'forward stroke keeps the face above the waterHeight-.78 root placement');
  assert.ok(m.bones[0].rotation.x>1);assert.ok(m.bones[2].rotation.x<-.8);assert.ok(m.bones[3].rotation.x<-1.2);
  console.log('avatar swim face clearance',{minimumMetresAboveWater:minFace});m.dispose();
});

test('Reduced motion removes swim bob and roll while retaining deliberate swimming limb action',()=>{
  const m=createAvatarModel();advance(m,3,1.7,true,true);
  let minHip=Infinity,maxHip=-Infinity,minArm=Infinity,maxArm=-Infinity;
  for(let i=0;i<120;i++){
    m.update(1/60,{speed:1.7,swimming:true,reducedMotion:true});minHip=Math.min(minHip,m.bones[0].position.y);maxHip=Math.max(maxHip,m.bones[0].position.y);minArm=Math.min(minArm,m.bones[3].rotation.x);maxArm=Math.max(maxArm,m.bones[3].rotation.x);assert.equal(m.bones[0].rotation.z,0);
  }
  assert.ok(maxHip-minHip<1e-10);assert.ok(Math.abs(maxHip-.57)<1e-10);assert.ok(maxArm-minArm>.8);m.dispose();
});

test('Swimming overrides sitting, emotes, casting and held-object poses',()=>{
  for(const emote of ['none','sit','wave','cheer','cast'] as AvatarEmote[]){
    const expected=createAvatarModel(),actual=createAvatarModel();
    for(let i=0;i<120;i++){expected.update(1/60,{swimming:true,speed:1.7});actual.update(1/60,{swimming:true,speed:1.7,emote,carrying:true});}
    assert.deepEqual(angles(actual),angles(expected));assert.equal(actual.getState().emote,'none');assert.equal(actual.getState().carrying,0);assert.equal(actual.getState().casting,false);assert.equal(actual.getState().castCount,0);assert.equal(actual.getState().seated,0);
    expected.dispose();actual.dispose();
  }
  const m=createAvatarModel();m.update(.1,{emote:'cast',carrying:true});assert.equal(m.getState().casting,true);
  m.update(.1,{emote:'cast',carrying:true,swimming:true});assert.equal(m.getState().casting,false);assert.equal(m.getState().castCount,1);
  advance(m,2,0);assert.ok(m.getState().carrying<1e-8);m.dispose();
});

test('Swimming pose and transition clocks agree at 30, 60 and 120 Hz',()=>{
  const samples=[30,60,120].map(hz=>{
    const m=createAvatarModel();advance(m,1,0,true,false,hz);advance(m,2,1.7,true,false,hz);advance(m,.5,0,false,false,hz);
    const result={state:m.getState(),angles:angles(m)};m.dispose();return result;
  });
  for(const sample of samples){for(const key of ['swimming','swimPhase','speed','phase'] as const)assert.ok(Math.abs(sample.state[key]-samples[0].state[key])<1e-9,key);sample.angles.forEach((a,i)=>assert.ok(Math.abs(a-samples[0].angles[i])<1e-9));}
});

test('Every LOD retains the same skeleton and contains complete swimming reach within its fixed culling bounds',async()=>{
  const m=createAvatarModel({...DEFAULT_AVATAR_DESIGN,hairStyle:'bun',topStyle:'hoodie',bottomStyle:'skirt',faceLines:'defined'}),lod=createLodController();
  const camera=new PerspectiveCamera(45,1,.1,100);camera.position.set(0,1.2,4);camera.lookAt(0,.8,0);await lod.register(m.root);
  const skeleton=m.mesh.skeleton,box=m.mesh.boundingBox!,sphere=m.mesh.boundingSphere!,point=new Vector3(),actual=new Box3();
  for(const level of ['near','mid','far'] as const){
    lod.setMode(level);lod.update(camera,800,.1,true);const g=m.mesh.geometry,buffer=g.getAttribute('position').array.slice(),lodSphere=g.boundingSphere!.clone();lodSphere.radius*=1.4;
    for(const speed of [0,1.7,3.5]){
      advance(m,2,speed);
      for(let frame=0;frame<60;frame++){
        m.update(1/30,{swimming:true,speed});m.root.updateMatrixWorld(true);m.skeleton.update();
        for(let i=0;i<g.getAttribute('position').count;i++){
          point.fromBufferAttribute(g.getAttribute('position'),i);m.mesh.applyBoneTransform(i,point);assert.ok(point.toArray().every(Number.isFinite));
          assert.ok(box.containsPoint(point),'fixed mesh box contains stroke');assert.ok(sphere.containsPoint(point),'fixed mesh sphere contains stroke');assert.ok(lodSphere.containsPoint(point),'LOD projected-size sphere remains conservative');actual.expandByPoint(point);
        }
      }
    }
    assert.equal(m.mesh.skeleton,skeleton);assert.equal(m.mesh.boundingBox,box);assert.equal(m.mesh.boundingSphere,sphere);assert.deepEqual(g.getAttribute('position').array,buffer);
    assert.equal(lod.stats(m.root)[level].draws,1);assert.equal(m.stats.imageTextures,0);
  }
  console.log('avatar swim complete sampled envelope',{min:actual.min.toArray(),max:actual.max.toArray()});lod.dispose();m.dispose();
});
