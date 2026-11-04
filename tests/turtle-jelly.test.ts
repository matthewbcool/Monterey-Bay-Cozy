import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Bone,Box3,BufferAttribute,Mesh,Vector3} from 'three';
import {createGreenSeaTurtleModel} from '../src/models/green-sea-turtle/createGreenSeaTurtleModel';
import {createMoonJellyModel} from '../src/models/moon-jelly/createMoonJellyModel';
import {createHarbor} from '../src/viewer/harbor';
import {fishCollection} from '../src/models/catalogue';
import {propCollection} from '../src/models/props/catalogue';
const stats=(root:ReturnType<typeof createMoonJellyModel>['root'])=>{let triangles=0,calls=0;root.traverseVisible(o=>{if(o instanceof Mesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {triangles,calls};};
for(const [name,create,cap] of [['turtle',createGreenSeaTurtleModel,1800],['jelly',createMoonJellyModel,1600]] as const){
 test(`${name}: slow/fast/caught, static buffers, physics ownership and disposal`,()=>{
  const m=create({seed:42}),buffers:BufferAttribute[]=[];m.root.traverse(o=>{if(o instanceof Mesh)buffers.push(o.geometry.attributes.position as BufferAttribute);});const versions=buffers.map(b=>b.version);
  m.root.position.set(2,3,4);m.setMotionOwner('physics');const start=m.root.position.clone();
  for(const life of ['alive','caught'] as const){m.setLifeState(life);const s=stats(m.root);console.log(name,life,s);assert.ok(s.triangles<=cap);assert.equal(s.calls,2);}
  const phase=m.getState().phase;m.update(.1);assert.equal(m.getState().phase,phase);
  m.setLifeState('alive');m.setSwimMode('fast');for(let i=0;i<120;i++)m.update(1/60);assert.ok(m.getState().blend>.99);assert.ok(m.root.position.equals(start));assert.deepEqual(buffers.map(b=>b.version),versions);
  assert.deepEqual(m.root.scale.toArray(),[1,1,1]);assert.equal(m.getState().motionOwner,'physics');
  const geometries=new Set(),materials=new Set(),skeletons=new Set();let releases=0;
  m.root.traverse((o:any)=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);if(o.skeleton)skeletons.add(o.skeleton);});
  for(const r of [...geometries,...materials] as any[])r.addEventListener('dispose',()=>releases++);
  for(const r of skeletons as Set<any>){const dispose=r.dispose.bind(r);r.dispose=()=>{releases++;dispose();};}
  m.dispose();m.dispose();assert.equal(releases,geometries.size+materials.size+skeletons.size);assert.ok(m.getState().disposed);
 });
 test(`${name}: transition phase agrees at 30/60/120 Hz`,()=>{
  const phases=[30,60,120].map(hz=>{const m=create({seed:7});m.setSwimMode('fast');for(let i=0;i<hz*2;i++)m.update(1/hz);const p=m.getState().phase;m.dispose();return p;});assert.ok(Math.max(...phases)-Math.min(...phases)<1e-10);
 });
}
test('Turtle scale, four flipper hinges, immutable body, seed stability and buried roots',()=>{
 const a=createGreenSeaTurtleModel({seed:42}),b=createGreenSeaTurtleModel({seed:42,lengthMeters:2.3});
 const size=new Box3().setFromObject(a.root,true).getSize(new Vector3()),large=new Box3().setFromObject(b.root,true).getSize(new Vector3());assert.ok(Math.abs(large.x/size.x-2)<1e-6);assert.ok(size.x>1.1&&size.x<1.2);assert.ok(size.z>1.3&&size.z<1.6);
 const bones:Bone[]=[];a.visual.traverse(o=>{if(o instanceof Bone)bones.push(o);});assert.equal(bones.length,5);const positions=bones.map(b=>b.position.clone());a.update(.1);assert.ok(bones[1].rotation.x!==0);assert.equal(bones[0].rotation.x,0);bones.forEach((b,i)=>assert.ok(b.position.equals(positions[i])));
 for(const p of positions.slice(1))assert.ok(Math.abs(p.z)<.255*1.15,'hinge buried inside shell width');
 assert.equal(b.physics.colliders[0].radius/a.physics.colliders[0].radius,2);a.dispose();b.dispose();
 for(const lengthMeters of [0,-1,NaN])assert.throws(()=>createGreenSeaTurtleModel({lengthMeters}));
});
test('Moon jelly is a creature, not a prop, and remains eyeless when caught',()=>{
 assert.ok(fishCollection.some(e=>e.id==='moon-jelly'));assert.ok(!propCollection.some(e=>(e.id as string)==='moon-jelly'));
 const m=createMoonJellyModel({seed:42});const meshes=m.visual.children as Mesh[];m.update(.1);assert.equal(meshes[0].morphTargetInfluences![0],meshes[1].morphTargetInfluences![0]);m.setLifeState('caught');assert.equal(meshes[0].morphTargetInfluences![0],1);assert.equal(m.getState().frequency,0);m.dispose();
});
test('Harbor retains sea stars and receives an instanced urchin colony',()=>{const h=createHarbor();assert.equal(h.seaStars.batch.count,3);assert.equal(h.urchins.batch.count,6);assert.ok(h.urchins.attachments.every(a=>a.getState().attached));h.update(.1);h.dispose();});

test('Turtle variation is deterministic, finite and stays within budget across seeds',()=>{
 let first:Float32Array|undefined;
 for(let seed=0;seed<60;seed++){
  const m=createGreenSeaTurtleModel({seed});assert.ok(stats(m.root).triangles<=1800);
  const g=(m.parts.get('surface')!.children[0] as Mesh).geometry;
  assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
  if(seed===42)first=new Float32Array(g.attributes.position.array);
  m.dispose();
 }
 const again=createGreenSeaTurtleModel({seed:42});assert.deepEqual((again.parts.get('surface')!.children[0] as Mesh).geometry.attributes.position.array,first);again.dispose();
});
