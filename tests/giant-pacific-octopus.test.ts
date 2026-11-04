import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferAttribute, Mesh, MeshToonMaterial, SkinnedMesh, Vector3 } from 'three';
import { createGiantPacificOctopusModel as create } from '../src/models/giant-pacific-octopus/createGiantPacificOctopusModel';
import { OCTOPUS as O } from '../src/models/giant-pacific-octopus/definition';
import { createSwimmer, TANK_SIZE } from '../src/viewer/swimPath';
import { modelStats } from '../src/viewer/modelStats';
import { createModelAssembly,disposeModelResources } from '../src/models/shared/assembly';
import { createFishMaterial } from '../src/models/shared/fish/materials';
import { buildArms } from '../src/models/giant-pacific-octopus/arms';
import { buildBody } from '../src/models/giant-pacific-octopus/body';
import { crawlCycle,mantlePulse } from '../src/models/giant-pacific-octopus/motion';
import { createOctopusRig } from '../src/models/giant-pacific-octopus/rig';

const surface=(m:ReturnType<typeof create>)=>m.parts.get('surface')!.children[0] as SkinnedMesh;
test('The arm crown is tucked above the roots and the web has small recessed edges, not a broad disc',()=>{
 const a=createModelAssembly('underside'),material=createFishMaterial(),span=3;
 buildBody(a,material,span,42);buildArms(a,material,span,42);
 const crown=a.parts.get('mantle-head')!.children.find(o=>o.name.endsWith('tapered-arm-crown')) as Mesh;
 crown.geometry.computeBoundingBox();assert.ok(crown.geometry.boundingBox!.min.y>=.0349*span);
 for(const child of a.parts.get('oral-web')!.children){
  const p=(child as Mesh).geometry.attributes.position;
  for(let i=0;i<p.count;i++)assert.ok(Math.hypot(p.getX(i)-O.headX*span,p.getZ(i))<.097*span,'web remains at the root');
  const middle=Math.hypot(p.getX(2)-O.headX*span,p.getZ(2));
  assert.ok(middle<Math.hypot(p.getX(1)-O.headX*span,p.getZ(1))*.65,'scalloped edge retracts between arms');
  assert.ok(p.getY(2)>p.getY(1)+.009*span,'web has volume instead of a flat plate');
 }
 disposeModelResources(a.root);
});

test('Crawl timing leaves supporting arms, coils preserve length, and phase wrapping is continuous',()=>{
 const r=createOctopusRig(3,42);
 for(let frame=0;frame<80;frame++){
  const phase=frame/80*Math.PI*2;
  const cycles=O.angles.map((_,i)=>crawlCycle(phase,i,42/4096));
  assert.ok(cycles.filter(c=>c.lift<1e-8).length>=4,'several arms support while others reach');
  r.pose(phase,0,false);
  for(const arm of r.arms){let length=0;for(let i=1;i<arm.length;i++)length+=arm[i].position.distanceTo(arm[i-1].position);assert.ok(length>O.armLength*3*.88&&length<O.armLength*3*1.14,`arm length ${length}`);}
 }
 r.pose(0,0,false);const first=r.arms.flat().map(b=>b.position.clone());r.pose(Math.PI*2-1e-7,0,false);
 r.arms.flat().forEach((b,i)=>assert.ok(b.position.distanceTo(first[i])<1e-5));
 assert.ok(mantlePulse(.22*Math.PI*2)>.999);assert.equal(mantlePulse(0),0);
 assert.ok(mantlePulse(.11*Math.PI*2)>.49&&mantlePulse(.5*Math.PI*2)>.49,'refill lasts longer than contraction');
 r.skeleton.dispose();
});
test('Paired suckers face out of the underside and inherit the adjacent arm weights',()=>{
 const a=createModelAssembly('cups');buildArms(a,createFishMaterial(),3,42);
 for(let arm=0;arm<8;arm++){
  const cups=a.parts.get(`arm-${arm+1}-suckers`)!;assert.equal(cups.children.length,14);
  for(const child of cups.children){
   const g=(child as Mesh).geometry,p=g.attributes.position,idx=g.index!,normal=new Vector3(),v=new Vector3(),w=new Vector3(),center=new Vector3();
   for(let j=0;j<idx.count;j+=3){center.fromBufferAttribute(p,idx.getX(j));v.fromBufferAttribute(p,idx.getX(j+1)).sub(center);w.fromBufferAttribute(p,idx.getX(j+2)).sub(center);normal.crossVectors(v,w);assert.ok(normal.y<0,'cup openings point down');}
   const bones=g.attributes.skinIndex,weights=g.attributes.skinWeight;
   for(let i=0;i<p.count;i++){assert.ok(bones.getX(i)>=2+arm*O.bonesPerArm&&bones.getY(i)<2+(arm+1)*O.bonesPerArm);assert.ok(Math.abs(weights.getX(i)+weights.getY(i)-1)<1e-6);}
  }
 }
 disposeModelResources(a.root);
});
test('Octopus has reproducible pigment, eight nine-frame arms and a fixed budget across 60 seeds',()=>{
 for(let seed=0;seed<60;seed++){
  const m=create({seed}),skin=surface(m);assert.equal(m.root.userData.seed,seed);assert.equal(skin.skeleton.bones.length,74);
  for(const state of ['alive','caught'] as const){m.setLifeState(state);const stats=modelStats(m.root).model;assert.equal(stats.drawCalls,2);assert.equal(stats.triangles,state==='alive'?4482:4234);assert.ok(stats.triangles<=O.budget.triangles);}
  m.root.traverse(o=>{if(o instanceof Mesh){assert.ok(o.material instanceof MeshToonMaterial);for(const attr of Object.values(o.geometry.attributes) as BufferAttribute[])assert.ok(Array.from(attr.array).every(Number.isFinite));}});
  assert.equal(m.root.userData.sourceParts.filter((p:string)=>/^arm-\d$/.test(p)).length,8);m.dispose();
 }
 const a=create({seed:42}),b=create({seed:42}),c=create({seed:7});
 assert.deepEqual(surface(a).geometry.attributes.color.array,surface(b).geometry.attributes.color.array);
 assert.notDeepEqual(surface(a).geometry.attributes.color.array,surface(c).geometry.attributes.color.array);
 for(const m of [a,b,c])m.dispose();
 for(const seed of [-1,.5,NaN,2**32])assert.throws(()=>create({seed}));
 for(const armSpanMeters of [-1,0,NaN,Infinity])assert.throws(()=>create({armSpanMeters}));
});

test('Crawl explores independently, jet narrows the arms and pulses the mantle without uploading geometry',()=>{
 const m=create({seed:42}),skin=surface(m),positions=skin.geometry.attributes.position as BufferAttribute,version=positions.version;
 const bones=skin.skeleton.bones,armTips=bones.filter(b=>/^arm-\d-8$/.test(b.name));
 const slowWidth=Math.max(...armTips.map(b=>b.position.z))-Math.min(...armTips.map(b=>b.position.z));
 const start=armTips.map(b=>b.position.clone());for(let i=0;i<60;i++)m.update(1/60);
 assert.equal(new Set(armTips.map((b,i)=>b.position.distanceTo(start[i]).toFixed(4))).size,8);
 m.setSwimMode('fast',true);const jetWidth=Math.max(...armTips.map(b=>b.position.z))-Math.min(...armTips.map(b=>b.position.z));assert.ok(jetWidth<slowWidth*.4);
 assert.ok(armTips.every(b=>b.position.x>.9));
 const mantle=bones.find(b=>b.name==='mantle')!,scale=mantle.scale.clone();m.update(.1);assert.notDeepEqual(mantle.scale.toArray(),scale.toArray());
 assert.equal(positions.version,version);assert.deepEqual(m.root.position.toArray(),[0,0,0]);assert.deepEqual(m.root.scale.toArray(),[1,1,1]);
 m.setLifeState('caught');const stopped=bones.map(b=>[...b.position.toArray(),...b.quaternion.toArray()]);m.update(.1);
 assert.deepEqual(bones.map(b=>[...b.position.toArray(),...b.quaternion.toArray()]),stopped);assert.equal(m.getState().frequency,0);
 assert.ok(m.parts.get('caught-details')!.visible&&!m.parts.get('head-details')!.visible);m.dispose();
});

test('Octopus skin remains inside its culling envelope and above the resting plane throughout crawl and transitions',()=>{
 for(const seed of [0,7,42]){
  const m=create({seed}),skin=surface(m),p=new Vector3();
  for(const mode of ['slow','fast','slow'] as const){
   m.setSwimMode(mode);
   for(let frame=0;frame<80;frame++){
    m.update(.1);m.root.updateMatrixWorld(true);skin.skeleton.update();
    for(let i=0;i<skin.geometry.attributes.position.count;i++){
     skin.getVertexPosition(i,p);assert.ok(skin.boundingBox!.containsPoint(p),`box ${p.toArray()}`);assert.ok(skin.boundingSphere!.containsPoint(p),`sphere ${p.toArray()}`);
     if(m.getState().blend<.00001)assert.ok(p.y+m.root.userData.floorOffsetMeters>=0,`floor ${p.y}`);
    }
   }
  }
  m.dispose();
 }
});

test('Octopus rates are frame independent, geometry scales with arm span and physics retains root ownership',()=>{
 const a=create({seed:4}),b=create({seed:4}),half=create({seed:4,armSpanMeters:1.5});
 a.setSwimMode('fast');b.setSwimMode('fast');for(let i=0;i<60;i++)a.update(1/60);for(let i=0;i<30;i++)b.update(1/30);
 assert.ok(Math.abs(a.getState().phase-b.getState().phase)<1e-10);
 const ap=surface(a).geometry.attributes.position,hp=surface(half).geometry.attributes.position;
 for(let i=0;i<ap.count;i++)assert.ok(new Vector3().fromBufferAttribute(ap,i).multiplyScalar(.5).distanceTo(new Vector3().fromBufferAttribute(hp,i))<1e-7);
 assert.equal(half.physics.colliders[0].radius,a.physics.colliders[0].radius*.5);
 a.setSwimMode('slow',true);const route=createSwimmer(a,O.speed);assert.ok(Math.abs(a.root.position.y+TANK_SIZE.height/2-a.root.userData.floorOffsetMeters)<1e-9);
 a.setSwimMode('fast',true);route.update(.1,1);assert.ok(a.root.position.y>-3.3);
 a.setMotionOwner('physics');a.root.position.set(2,3,4);a.root.rotation.set(.2,.3,.4);const q=a.root.quaternion.clone();route.update(.1,1);route.resume();a.update(.1);
 assert.deepEqual(a.root.position.toArray(),[2,3,4]);assert.ok(a.root.quaternion.equals(q));
 const disposals=new Map<object,number>();a.root.traverse(o=>{if(o instanceof Mesh)for(const r of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!disposals.has(r)){disposals.set(r,0);r.addEventListener('dispose',()=>disposals.set(r,disposals.get(r)!+1));}});
 const skeleton=surface(a).skeleton;let released=0;const dispose=skeleton.dispose.bind(skeleton);skeleton.dispose=()=>{released++;dispose();};
 a.dispose();a.dispose();for(const n of disposals.values())assert.equal(n,1);assert.equal(released,1);[b,half].forEach(m=>m.dispose());
});
