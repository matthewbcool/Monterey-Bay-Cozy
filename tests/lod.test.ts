import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BufferGeometry, Group, Mesh, PerspectiveCamera, SphereGeometry, MeshBasicMaterial, Vector3 } from 'three';
import { fishCollection } from '../src/models/catalogue';
import { propCollection } from '../src/models/props/catalogue';
import { createSardineSchool } from '../src/models/pacific-sardine/createSardineSchool';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController, chooseLod } from '../src/models/shared/lod/controller';
import { prepareGeometryLods, LOD_LEVELS, triangles } from '../src/models/shared/lod/geometry';

const camera=new PerspectiveCamera(40,1,.01,10000);camera.position.set(0,0,10);camera.updateMatrixWorld();
for(const entry of [...fishCollection,...propCollection])test(`LOD: ${entry.id} preserves attributes, ownership and budgets in every state`,async()=>{
 const object=entry.create(),root='root' in object?object.root:object,lod=createLodController();
 root.position.set(2,3,4);const base=new Map<Mesh,BufferGeometry>();root.traverse(o=>{if(o instanceof Mesh)base.set(o,o.geometry);});
 await lod.register(root);
 for(const state of ['alive','caught'] as const){
  if('setLifeState' in object)object.setLifeState(state);
  const s=lod.stats(root);// Tiny furniture can already be cheaper than a useful simplified silhouette.
  assert.ok(s.near.triangles<=100?s.far.triangles<=s.near.triangles:s.far.triangles<s.near.triangles*.7,JSON.stringify(s));assert.ok(s.mid.triangles<=s.near.triangles);assert.equal(s.far.draws,s.near.draws);
  for(const level of LOD_LEVELS){lod.setMode(level);lod.update(camera,800,0,true);
   for(const [mesh,source] of base){if(!mesh.visible)continue;const g=mesh.geometry;assert.ok(triangles(g)<=triangles(source));
    assert.deepEqual(Object.keys(g.attributes),Object.keys(source.attributes));assert.equal(g.morphTargetsRelative,source.morphTargetsRelative);
    for(const [key,targets] of Object.entries(g.morphAttributes)){assert.equal(targets.length,source.morphAttributes[key as 'position']!.length);targets.forEach(a=>assert.equal(a.count,g.attributes.position.count));}
    for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
    assert.ok(!g.index||Array.from(g.index.array).every(i=>i<g.attributes.position.count));
    if(g.hasAttribute('skinWeight')){const w=g.attributes.skinWeight;for(let i=0;i<w.count;i++)assert.ok(Math.abs(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)-1)<1e-5);}
   }
   if('update' in object){object.update(.05);assert.deepEqual(root.position.toArray(),[2,3,4]);}
   assert.ok(root.scale.equals(new Vector3(1,1,1)));
  }
 }
 const tracked=lod.size;assert.ok(tracked>0);if('dispose' in object)object.dispose();else disposeObject(root);assert.equal(lod.size,0,'factory disposal releases inactive variants and controller references');lod.dispose();
});

test('LOD uses projected size, hysteresis, camera zoom and physical scale',async()=>{
 assert.equal(chooseLod(160,'near'),'near');assert.equal(chooseLod(200,'mid'),'mid');assert.equal(chooseLod(210,'mid'),'near');
 assert.equal(chooseLod(50,'far'),'far');assert.equal(chooseLod(65,'far'),'mid');
 const root=new Group(),mesh=new Mesh(new SphereGeometry(1,24,16),new MeshBasicMaterial());root.add(mesh);
 const lod=createLodController();await lod.register(root);lod.update(camera,800,0,true);assert.equal(lod.inspect(root)[0].level,'near');
 camera.position.z=100;lod.update(camera,800,0,true);assert.equal(lod.inspect(root)[0].level,'far');
 camera.zoom=12;camera.updateProjectionMatrix();lod.update(camera,800,0,true);assert.equal(lod.inspect(root)[0].level,'near');
 camera.zoom=1;camera.position.z=10;camera.updateProjectionMatrix();lod.dispose();disposeObject(root);
});

test('School LOD preserves one instanced draw, morph slots, count and caught extraction',async()=>{
 const school=createSardineSchool({count:48}),lod=createLodController();await lod.register(school.root);
 const texture=school.batches.alive.morphTexture,matrix=school.batches.alive.instanceMatrix;
 const s=lod.stats(school.root);assert.equal(s.far.draws,1);assert.ok(s.far.triangles<s.near.triangles*.5);
 lod.setMode('far');lod.update(camera,800,0,true);school.update(.05);assert.equal(school.batches.alive.morphTexture,texture);assert.equal(school.batches.alive.instanceMatrix,matrix);
 school.setCount(16);assert.equal(school.count,16);school.setCount(1);school.update(.05);
 const caught=school.takeFish(0);assert.equal(caught.getState().lifeState,'caught');assert.equal(school.count,0);caught.dispose();school.dispose();assert.equal(lod.size,0);lod.dispose();
});

test('Geometry families dispose each level once, including when a reduced geometry is active',async()=>{
 const source=new SphereGeometry(1,24,16),levels=await prepareGeometryLods(source),counts=new Map<BufferGeometry,number>();
 for(const g of new Set(Object.values(levels))){counts.set(g,0);g.addEventListener('dispose',()=>counts.set(g,counts.get(g)!+1));}
 levels.far.dispose();assert.deepEqual([...counts.values()],[1,1,1]);
});

test('Rapid selection cancellation does not retain meshes or reject pending preparation',async()=>{
 const mesh=new Mesh(new SphereGeometry(1,24,16),new MeshBasicMaterial()),lod=createLodController();
 const promise=lod.register(mesh);mesh.geometry.dispose();await promise;assert.equal(lod.size,0);lod.dispose();mesh.material.dispose();
});

test('Morph trajectories are not welded away and material groups retain their material indices',async()=>{
 const g=new SphereGeometry(1,20,12);g.clearGroups();g.addGroup(0,120,0);g.addGroup(120,g.index!.count-120,1);
 const target=g.attributes.position.clone();for(let i=0;i<target.count;i++)target.setY(i,target.getY(i)*1.5);g.morphAttributes.position=[target];
 const levels=await prepareGeometryLods(g);for(const level of ['mid','far'] as const){const r=levels[level];assert.deepEqual(r.groups.map(g=>g.materialIndex),[0,1]);assert.equal(r.morphAttributes.position![0].count,r.attributes.position.count);}
 g.dispose();
});

test('Seeded natural variants retain useful reductions and finite animated skin bounds',async()=>{
 const {createGiantPacificOctopusModel}=await import('../src/models/giant-pacific-octopus/createGiantPacificOctopusModel');
 const {createGiantKelp}=await import('../src/models/habitat/giantKelp');
 const {createBatStar}=await import('../src/models/habitat/batStar');
 const {createPurpleUrchin}=await import('../src/models/habitat/purple-urchin/createPurpleUrchin');
 for(let seed=0;seed<8;seed++)for(const create of [createGiantPacificOctopusModel,createGiantKelp,createBatStar,createPurpleUrchin]){
  const object=create({seed}),root='root' in object?object.root:object,lod=createLodController();await lod.register(root);const s=lod.stats(root);
  assert.ok(s.far.triangles<s.near.triangles*.7);lod.setMode('far');lod.update(camera,800,0,true);
  if('setSwimMode' in object)for(const mode of ['slow','fast'] as const){object.setSwimMode(mode,true);for(let i=0;i<8;i++){object.update(.1);root.updateMatrixWorld(true);const bounds=new Box3().setFromObject(root,true);assert.ok([...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite));}}
  if('dispose' in object)object.dispose();else disposeObject(root);lod.dispose();
 }
});

test('Camera LOD never changes surface attachment/crawl queries or picking geometry',async()=>{
 const {attachToSurface}=await import('../src/models/shared/surfaceAttachment');
 const a=new Mesh(new SphereGeometry(1,24,16),new MeshBasicMaterial()),b=a.clone();b.geometry=a.geometry.clone();
 const pa=new Group(),pb=new Group(),anchor={point:new Vector3(0,0,1),normal:new Vector3(0,0,1)};
 const options={speedMetersPerSecond:.005,maxTravelMeters:.1,probeMeters:.1};
 const crawlA=attachToSurface(pa,{...anchor,surface:a},options),crawlB=attachToSurface(pb,{...anchor,surface:b},options);
 const lod=createLodController(),original=a.raycast;await lod.register(a);
 for(let i=0;i<8;i++){lod.setMode(i%2?'far':'mid');lod.update(camera,800,0,true);crawlA.update(1);crawlB.update(1);assert.ok(pa.position.distanceTo(pb.position)<1e-10);}
 assert.ok(crawlA.getState().travelMeters>0);crawlA.detach();crawlB.detach();lod.dispose();assert.equal(a.raycast,original);disposeObject(a);b.geometry.dispose();
});

test('Morph LOD refreshes render bindings only on geometry changes, including restoration',async()=>{
 const root=new Group(),source=new SphereGeometry(1,24,16),target=source.attributes.position.clone();
 for(let i=0;i<target.count;i++)target.setY(i,target.getY(i)*.75);
 source.morphAttributes.position=[target];
 const materials=[new MeshBasicMaterial(),new MeshBasicMaterial()],mesh=new Mesh(source,materials);
 const staticMesh=new Mesh(new SphereGeometry(1,24,16),new MeshBasicMaterial());root.add(mesh,staticMesh);
 mesh.morphTargetInfluences![0]=.65;root.position.set(2,3,4);
 const lod=createLodController();await lod.register(root);
 const staticVersion=staticMesh.material.version;let versions=materials.map(m=>m.version);
 for(const mode of ['mid','far','near','far'] as const){
  lod.setMode(mode);lod.update(camera,800,0,true);
  materials.forEach((m,i)=>assert.equal(m.version,versions[i]+1,'morph texture bindings must refresh'));
  versions=materials.map(m=>m.version);lod.update(camera,800,0,true);
  assert.deepEqual(materials.map(m=>m.version),versions,'unchanged geometry must reuse its pipeline');
  assert.equal(staticMesh.material.version,staticVersion,'static detail switches need no shader refresh');
  assert.deepEqual(mesh.morphTargetInfluences,[.65]);assert.deepEqual(root.position.toArray(),[2,3,4]);
 }
 lod.dispose();assert.equal(mesh.geometry,source);
 materials.forEach((m,i)=>assert.equal(m.version,versions[i]+1,'restored Near geometry must refresh too'));
 disposeObject(root);
});
