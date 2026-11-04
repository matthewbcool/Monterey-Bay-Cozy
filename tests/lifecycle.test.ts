import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Quaternion,Vector3} from 'three';
import {TunaCelMaterial} from '../src/models/tuna/toon';
import {createTunaModel} from '../src/models/tuna/createTunaModel';
import {bindFishPhysics} from '../src/models/physics';
import {FISH_BUDGET} from '../src/models/types';
import {createSwimmer} from '../src/viewer/swimPath';
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
const stats=(f:ReturnType<typeof createTunaModel>)=>{
 let triangles=0,calls=0;f.root.traverseVisible(o=>{if(o instanceof Mesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {triangles,calls};
};

test('Caught swaps both eye sets, stops swimming and stays inside the rendering budget',()=>{
 const f=createTunaModel(),swimmer=createSwimmer(f),body=f.parts.get('body')!.children[0];
 f.setSwimMode('fast',true);f.update(.06);swimmer.update(.06,1);const phase=f.getState().phase,position=f.root.position.clone(),distance=swimmer.getDistance(),alive=stats(f);
 f.setLifeState('caught');const caught=stats(f);
 assert.equal(f.parts.get('head-details')!.visible,false);assert.equal(f.parts.get('caught-details')!.visible,true);
 assert.equal(f.parts.get('body')!.children[0],body,'body is reused');
 const cross=f.parts.get('caught-details')!.children[0] as Mesh;const p=cross.geometry.attributes.position;
 assert.ok(Array.from({length:p.count},(_,i)=>p.getZ(i)).some(z=>z>.4));assert.ok(Array.from({length:p.count},(_,i)=>p.getZ(i)).some(z=>z<-.4));
 for(let i=0;i<120;i++){f.update(1/60);swimmer.update(1/60,1);}
 near(f.getState().phase,phase);near(f.root.position.distanceTo(position),0);near(swimmer.getDistance(),distance);assert.equal(f.getState().frequency,0);
 assert.ok(caught.calls<=alive.calls&&caught.calls<=FISH_BUDGET.maxDrawCalls);assert.ok(caught.triangles<alive.triangles&&alive.triangles<=FISH_BUDGET.maxTriangles);
 console.log({alive,caught});
 f.root.traverse(o=>{if(o instanceof Mesh&&o.material instanceof TunaCelMaterial)assert.equal(o.material.uniforms.swimActive.value,0);});
 f.setLifeState('alive');f.update(.05);swimmer.update(.05,1);
 assert.equal(f.parts.get('head-details')!.visible,true);assert.equal(f.parts.get('caught-details')!.visible,false);assert.notEqual(f.getState().phase,phase);assert.notEqual(swimmer.getDistance(),distance);
 assert.deepEqual(stats(f),alive);f.dispose();
});

test('Repeated state switches reuse resources and do not affect a second fish',()=>{
 const a=createTunaModel(),b=createTunaModel();const before=new Set<object>();a.root.traverse(o=>{if(o instanceof Mesh){before.add(o.geometry);before.add(o.material);}});
 for(let i=0;i<100;i++)a.setLifeState(i%2?'alive':'caught');
 a.root.traverse(o=>{if(o instanceof Mesh){assert.ok(before.has(o.geometry));assert.ok(before.has(o.material));}});
 a.setLifeState('caught');assert.equal(b.getState().lifeState,'alive');
 const bBody=b.parts.get('body')!.children[0] as Mesh;assert.equal((bBody.material as TunaCelMaterial).uniforms.swimActive.value,1);
 a.dispose();b.update(.03);assert.equal(b.getState().disposed,false);b.dispose();
});

test('Visual animation never modifies a physics-owned root, even when caught',()=>{
 const f=createTunaModel(),swimmer=createSwimmer(f),parent=new Group();
 parent.position.set(2,1,-3);parent.rotation.y=.4;parent.scale.setScalar(2);parent.add(f.root);
 const position=new Vector3(6,4,2),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.8);
 const body={readWorldPose:(p:Vector3,q:Quaternion)=>{p.copy(position);q.copy(rotation);}};
 const binding=bindFishPhysics(f,body);assert.throws(()=>bindFishPhysics(f,body),/physics owner/);
 binding.sync();const local=f.root.position.clone(),localQ=f.root.quaternion.clone(),routeDistance=swimmer.getDistance();
 for(let i=0;i<10;i++){f.update(.03);swimmer.update(.03,1);}
 near(f.root.position.distanceTo(local),0);near(f.root.quaternion.angleTo(localQ),0);near(swimmer.getDistance(),routeDistance);
 near(f.root.getWorldPosition(new Vector3()).distanceTo(position),0);near(f.root.getWorldQuaternion(new Quaternion()).angleTo(rotation),0);
 f.setLifeState('caught');position.y=8;binding.sync();near(f.root.getWorldPosition(new Vector3()).y,8);
 binding.detach();binding.detach();assert.equal(f.getState().motionOwner,'external');position.y=10;binding.sync();near(f.root.getWorldPosition(new Vector3()).y,8);
 // Root must be in the route's coordinate space before handing control back.
 parent.remove(f.root);swimmer.resume();assert.equal(f.getState().motionOwner,'path');f.dispose();binding.sync();
});

test('Physics descriptors are cheap, finite model-space data with reusable anchors',()=>{
 const f=createTunaModel();assert.equal(f.physics.colliders.length,1);
 const c=f.physics.colliders[0];assert.equal(c.shape,'capsule');assert.equal(c.axis,'x');assert.ok(c.radius>0&&c.halfLength>0);
 for(const v of [...c.center,...f.physics.centerOfMass,...f.physics.anchors.mouth,...f.physics.anchors.grip])assert.ok(Number.isFinite(v));
 assert.ok(f.physics.anchors.mouth[0]<-.5&&f.physics.anchors.mouth[0]>-.7);assert.equal(f.visual.parent,f.root);f.dispose();assert.throws(()=>bindFishPhysics(f,{readWorldPose(){}}),/disposed/);
});
