import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Box3, BoxGeometry, BufferAttribute, BufferGeometry, Group, InstancedMesh, Mesh, MeshToonMaterial, Vector3} from 'three';
import {createPurpleUrchin} from '../src/models/habitat/purple-urchin/createPurpleUrchin';
import {createUrchinColony} from '../src/models/habitat/purple-urchin/colony';
import {PURPLE_URCHIN as U} from '../src/models/habitat/purple-urchin/definition';
import {createMoonJelly, updateMoonJelly} from '../src/models/habitat/moon-jelly/createMoonJelly';
import {createToonMaterial, toonRamp} from '../src/models/shared/style';
import {disposeObject} from '../src/models/props/primitives';
import {toNodeToon} from '../src/viewer/nodeStyle';
import {createTank} from '../src/viewer/tank';
import {createObjectPreview} from '../src/viewer/objects';

function stats(root:Group){let triangles=0,drawCalls=0;root.traverseVisible(o=>{if(o instanceof Mesh){drawCalls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof InstancedMesh?o.count:1);}});return{triangles,drawCalls};}
test('Purple urchin: 60 seeded adults retain metre scale, valid geometry and one-draw budget',()=>{
 for(let seed=0;seed<60;seed++){
  const root=createPurpleUrchin({seed}),bounds=new Box3().setFromObject(root),size=bounds.getSize(new Vector3()),mesh=root.children[0] as Mesh;
  assert.ok(root.scale.equals(new Vector3(1,1,1)));assert.equal(root.userData.testDiameterMeters,.05);
  assert.ok(size.x>.065&&size.x<.085&&size.z<.085);assert.ok(bounds.min.y>=-1e-8&&bounds.min.y<1e-6,'Feet contact Y=0');
  assert.deepEqual(stats(root),{triangles:1818,drawCalls:1});assert.ok((mesh.material as MeshToonMaterial).gradientMap===toonRamp('matte'));
  for(const attr of Object.values(mesh.geometry.attributes))for(const n of attr.array)assert.ok(Number.isFinite(n));disposeObject(root);
 }
 const a=createPurpleUrchin({seed:52}),b=createPurpleUrchin({seed:52}),large=createPurpleUrchin({seed:52,testDiameterMeters:.10});
 assert.deepEqual((a.children[0] as Mesh).geometry.attributes.position.array,(b.children[0] as Mesh).geometry.attributes.position.array);
 assert.ok(Math.abs(new Box3().setFromObject(large).getSize(new Vector3()).x/new Box3().setFromObject(a).getSize(new Vector3()).x-2)<1e-6);
 [a,b,large].forEach(disposeObject);assert.throws(()=>createPurpleUrchin({seed:-1}));assert.throws(()=>createPurpleUrchin({testDiameterMeters:NaN}));
});
test('Urchin colony crawls one centimetre per real minute on floor and wall, stops at edge, and detaches cleanly',()=>{
 const surface=new Mesh(new BoxGeometry(3,.1,2),createToonMaterial());
 for(const wall of [false,true]){
  surface.rotation.z=wall?Math.PI/2:0;surface.updateMatrixWorld(true);
  const colony=createUrchinColony([{surface,point:new Vector3(0,.05,0),normal:new Vector3(0,1,0)}]);
  const start=colony.nodes[0].position.clone(),geometry=colony.batch.geometry,version=(geometry.attributes.position as BufferAttribute).version;
  for(let i=0;i<3600;i++)colony.update(1/60);
  const distance=colony.nodes[0].position.distanceTo(start);assert.ok(Math.abs(distance-.01)<.00018,`${distance} m`);
  assert.equal((geometry.attributes.position as BufferAttribute).version,version);assert.equal(colony.attachments[0].getState().speedMetersPerSecond,U.crawlSpeedMetersPerSecond);
  const old=colony.nodes[0].position.clone();colony.update(0);assert.ok(colony.nodes[0].position.equals(old));
  let releases=0;geometry.addEventListener('dispose',()=>releases++);colony.dispose();colony.dispose();assert.equal(releases,1);assert.equal(colony.attachments[0].getState().attached,false);
 }
 surface.rotation.z=0;
 const edge=createUrchinColony([{surface,point:new Vector3(1.4999,.05,0),normal:new Vector3(0,1,0)}]);edge.update(60);assert.ok(edge.nodes[0].position.x<1.5);edge.dispose();surface.geometry.dispose();(surface.material as MeshToonMaterial).dispose();
});
test('Moon jelly: two toon batches, coherent GPU morphs, real bell size and independent root ownership',()=>{
 const a=createMoonJelly({seed:0}),b=createMoonJelly({seed:0}),meshes=a.children as Mesh[];
 assert.deepEqual(stats(a),{triangles:1482,drawCalls:2});assert.ok(a.scale.equals(new Vector3(1,1,1)));
 assert.ok(new Box3().setFromObject(a).getSize(new Vector3()).x<.26);
 a.position.set(3,2,1);const buffers=meshes.map(m=>Array.from(m.geometry.attributes.position.array));
 updateMoonJelly(a,1);assert.notEqual(meshes[0].morphTargetInfluences![0],(b.children[0] as Mesh).morphTargetInfluences![0]);assert.equal(meshes[0].morphTargetInfluences![0],meshes[1].morphTargetInfluences![0]);assert.deepEqual(a.position.toArray(),[3,2,1]);
 meshes.forEach((m,i)=>assert.deepEqual(Array.from(m.geometry.attributes.position.array),buffers[i]));
 const before=meshes[0].morphTargetInfluences![0];updateMoonJelly(a,NaN);assert.equal(meshes[0].morphTargetInfluences![0],before);
 const weights=[30,60,120].map(fps=>{const root=createMoonJelly({seed:8});for(let i=0;i<fps;i++)updateMoonJelly(root,1/fps);const v=(root.children[0] as Mesh).morphTargetInfluences![0];disposeObject(root);return v;});weights.forEach(v=>assert.ok(Math.abs(v-weights[0])<1e-10));
 disposeObject(a);disposeObject(b);
});
test('Jelly material conversion preserves both translucent batches without changing transparency',()=>{
 const root=createMoonJelly(),bell=root.children[1] as Mesh,source=bell.material as MeshToonMaterial,node=toNodeToon(source);
 assert.equal(node.opacity,.22);assert.equal(node.transparent,true);assert.equal(node.depthWrite,false);assert.equal(node.forceSinglePass,true);
 updateMoonJelly(root,.4);
 assert.ok((root.children[0] as Mesh).material instanceof MeshToonMaterial);assert.equal(((root.children[0] as Mesh).material as MeshToonMaterial).opacity,.72);
 node.dispose();disposeObject(root);
});
test('Open Sea scene budgets, pause-by-omission and resource ownership',()=>{
 const tank=createTank(),cost=stats(tank.root);console.log('Open Sea scenery:',cost);
 assert.equal(cost.drawCalls,4);assert.ok(cost.triangles<3000);
 for(const name of ['urchin','star','jelly','shoal','fish','turtle','ray']){let found=false;tank.root.traverse(o=>{if(o.name.toLowerCase().includes(name))found=true;});assert.equal(found,false,name+' must not be tank scenery');}
 tank.update(60);tank.update(60);
 const geometries=new Set<BufferGeometry>();let releases=0;
 tank.root.traverse(o=>{if(o instanceof Mesh&&!geometries.has(o.geometry)){geometries.add(o.geometry);o.geometry.addEventListener('dispose',()=>releases++);}});
 tank.dispose();tank.dispose();assert.equal(releases,geometries.size);
});
test('Objects own animal motion separately from the turntable and dispose replaced attachments',()=>{
 const view=createObjectPreview();view.select('purple-sea-urchin');const start=view.selected!.position.clone();view.update(60);assert.ok(Math.abs(view.selected!.position.distanceTo(start)-.01)<1e-6);
 view.select('bat-star');view.setCompare(true);view.update(.5);view.dispose();
});
