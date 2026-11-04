import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Mesh,MeshToonMaterial,Vector3} from 'three';
import {propCollection} from '../src/models/props/catalogue';
import {PROP_BUDGETS} from '../src/models/props/dimensions';
import {disposeObject} from '../src/models/props/primitives';
import {createTunaModel} from '../src/models/tuna/createTunaModel';
import {createWater} from '../src/viewer/water';
import {createObjectPreview} from '../src/viewer/objects';
for(const entry of propCollection)test(`${entry.name}: procedural metre-scale geometry and rendering budget`,()=>{
 const root=entry.create();assert.equal(root.userData.units,'metres');assert.ok(root.scale.equals(new Vector3(1,1,1)));
 let calls=0,triangles=0;root.traverseVisible(o=>{if(o instanceof Mesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;assert.ok(o.material instanceof MeshToonMaterial,'Props share the toon ramp');assert.ok(o.geometry.attributes.color,'Baked colors preserve appearance in shared batches');}});
 const budget=PROP_BUDGETS[entry.id];assert.ok(calls<=budget.drawCalls,`${calls} draws`);assert.ok(triangles<=budget.triangles,`${triangles} triangles`);disposeObject(root);
});
test('Real object sizes stay distinct in the inspector and comparison',()=>{
 const view=createObjectPreview();const tackle=view.select('tackle-box'),boat=view.select('cabin-boat');
 assert.ok(Math.abs(tackle.size.x-.41)<.001);assert.ok(boat.size.z>5.5&&boat.size.z<6);assert.ok(view.selected!.scale.equals(new Vector3(1,1,1)));
 view.setCompare(true);assert.equal(view.comparison.visible,true);view.comparison.traverse(o=>{if(o.userData.assetId)assert.ok(o.scale.equals(new Vector3(1,1,1)));});view.dispose();
});
test('Tuna visual, mouth anchor and collider scale together in metres',()=>{
 const a=createTunaModel(),b=createTunaModel({lengthMeters:2.4});
 assert.ok(Math.abs(new Box3().setFromObject(a.root,true).getSize(new Vector3()).x-1.2)<.01);
 assert.ok(a.root.scale.equals(new Vector3(1,1,1)));assert.equal(b.physics.colliders[0].radius,a.physics.colliders[0].radius*2);assert.equal(b.physics.anchors.mouth[0],a.physics.anchors.mouth[0]*2);
 a.dispose();b.dispose();
});
test('Large water tiles stay below the surface tessellation budget',()=>{
 const water=createWater({width:48,depth:27});assert.ok(water.root.geometry.index!.count/3<=6000);water.dispose();
});
