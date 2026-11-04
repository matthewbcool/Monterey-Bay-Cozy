import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh,Box3,Vector3,Quaternion} from 'three';
import {TunaCelMaterial} from '../src/models/tuna/toon';
import {createTunaModel} from '../src/models/tuna/createTunaModel';
import {createSwimmer,pathLength,routePose,TANK_SIZE} from '../src/viewer/swimPath';
const near=(a:number,b:number,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);

test('Fish stays within the geometry budget with finite, three-dimensional geometry',()=>{
 const f=createTunaModel();let triangles=0,drawCalls=0;
 const size=new Box3().setFromObject(f.root).getSize(new Vector3());assert.ok(size.z>.15&&Math.abs(size.x-1.2)<.01&&size.y>.3);
 f.root.traverseVisible(o=>{if(o instanceof Mesh){drawCalls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const name of ['position','normal'])for(const value of o.geometry.getAttribute(name).array)assert.ok(Number.isFinite(value),`${o.name} ${name}`);}});
 assert.ok(triangles<=3368,`Fish budget: ${triangles} triangles`);assert.ok(drawCalls<=2,`Fish budget: ${drawCalls} draw calls`);
 console.log(`Fish: ${triangles} triangles, ${drawCalls} draw calls`);f.dispose();
});

test('Fast swim tucks pectorals while keeping the primary dorsal visibly raised',()=>{
 const f=createTunaModel(),slow=f.getState(),extended=f.parts.get('pectoral-near')!.rotation.y;
 f.setSwimMode('fast');assert.equal(f.getState().blend,0,'switching preserves pose continuity');
 for(let i=0;i<120;i++)f.update(1/60);
 const fast=f.getState();assert.ok(fast.frequency>slow.frequency*3);assert.ok(fast.finExtension>.60&&fast.finExtension<.65);
 assert.ok(Math.abs(f.parts.get('pectoral-near')!.rotation.y)<Math.abs(extended));assert.ok(f.parts.get('dorsal-primary')!.scale.y>.60);
 f.setSwimMode('slow');for(let i=0;i<120;i++)f.update(1/60);assert.ok(f.getState().finExtension>.99);f.dispose();
});

test('Batched tuna keeps matte fin paint and a shared material in both life states',()=>{
 const f=createTunaModel(),body=f.parts.get('body')!.children[0] as Mesh;
 const mask=body.geometry.attributes.fishMatte,joints=body.geometry.attributes.tunaJoint;
 const seen=new Set<number>();let matte=0,skin=0;
 for(let i=0;i<mask.count;i++){
  seen.add(joints.getX(i));if(mask.getX(i)===1)matte++;else skin++;
  if(joints.getX(i)>0)assert.equal(mask.getX(i),1,'Every hinged fin remains matte');
 }
 assert.deepEqual([...seen].sort(),[0,1,2,3,4]);assert.ok(matte>0&&skin>0);
 for(const state of ['alive','caught'] as const){
  f.setLifeState(state);let draws=0;
  f.root.traverseVisible(o=>{if(o instanceof Mesh){draws++;assert.equal(o.material,body.material);}});
  assert.equal(draws,2);assert.ok(body.material instanceof TunaCelMaterial);
 }
 f.dispose();
});

test('Transition timing is stable at 30, 60 and 120 updates per second',()=>{
 const states=[30,60,120].map(fps=>{const f=createTunaModel();f.setSwimMode('fast');for(let i=0;i<fps;i++)f.update(1/fps);const s=f.getState();f.dispose();return s;});
 for(const s of states.slice(1)){near(s.blend,states[0].blend);near(s.phase,states[0].phase);}
});

test('GPU animation keeps vertex buffers static while fin hinges follow the wave',()=>{
 const f=createTunaModel();f.setSwimMode('fast',true);const versions=new Map<object,number>();
 f.root.traverse(o=>{if(o instanceof Mesh)for(const name of ['position','normal'])versions.set(o.geometry.attributes[name],o.geometry.attributes[name].version);});
 const body=f.parts.get('body')!.children[0] as Mesh;const mat=body.material as TunaCelMaterial,phase=mat.uniforms.swimPhase.value;
 for(let i=0;i<37;i++)f.update(1/60);
 assert.notEqual(mat.uniforms.swimPhase.value,phase);assert.equal(mat.uniforms.bendEnabled.value,1);
 f.root.traverse(o=>{if(o instanceof Mesh)for(const name of ['position','normal'])assert.equal(o.geometry.attributes[name].version,versions.get(o.geometry.attributes[name]));});
 assert.ok(Math.abs(f.parts.get('tail')!.position.z)>.01);f.dispose();
});

test('Disposal releases each resource once and invalid updates do not change the pose',()=>{
 const f=createTunaModel(),phase=f.getState().phase,resources=new Set<{addEventListener:Function}>();
 f.root.traverse(o=>{if(o instanceof Mesh){resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])resources.add(m);}});
 const counts=new Map<object,number>();for(const r of resources)r.addEventListener('dispose',()=>counts.set(r,(counts.get(r)??0)+1));
 f.update(NaN);f.update(-1);near(f.getState().phase,phase);f.dispose();f.dispose();assert.equal(f.parts.size,0);for(const r of resources)assert.equal(counts.get(r),1);
});

test('The complete route keeps the animated fish inside the aquarium and points it forward',()=>{
 const f=createTunaModel();f.setSwimMode('fast',true);
 for(let i=0;i<240;i++){
  const pose=routePose(i/240*pathLength);f.root.position.copy(pose.position);f.root.rotation.copy(pose.rotation);f.update(1/30);
  const heading=new Vector3(-1,0,0).applyQuaternion(new Quaternion().setFromEuler(pose.rotation));assert.ok(heading.dot(pose.direction)>.999);
  const box=new Box3().setFromObject(f.root);
  for(const [axis,half] of [['x',TANK_SIZE.width/2],['y',TANK_SIZE.height/2],['z',TANK_SIZE.depth/2]] as const){assert.ok(box.min[axis]>-half,`route ${i}, min ${axis}`);assert.ok(box.max[axis]<half,`route ${i}, max ${axis}`);}
 }
 const a=routePose(0),b=routePose(pathLength);near(a.position.distanceTo(b.position),0);f.dispose();
});

test('Fast swimming travels farther and the route has stable timing across frame rates',()=>{
 const distances=(blend:number)=>[30,60,120].map(fps=>{const f=createTunaModel(),swimmer=createSwimmer(f),start=swimmer.getDistance();for(let i=0;i<fps;i++)swimmer.update(1/fps,blend);const d=swimmer.getDistance()-start;f.dispose();return d;});
 const slow=distances(0),fast=distances(1);assert.ok(fast[0]>slow[0]*3);for(const list of [slow,fast])for(const d of list)near(d,list[0]);
});
