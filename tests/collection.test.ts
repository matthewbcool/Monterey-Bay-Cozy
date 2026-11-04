import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import {fishCollection} from '../src/models/catalogue';
import {FISH_BUDGET} from '../src/models/types';

// Every future registration automatically inherits these browser-model requirements.
for(const entry of fishCollection)test(`${entry.name}: shared alive/caught, physics and performance contract`,()=>{
 const fish=entry.create();assert.equal(fish.visual.parent,fish.root);assert.ok(fish.physics.colliders.length>0&&fish.physics.colliders.length<=3);
 const rootPosition=fish.root.position.clone(),rootRotation=fish.root.quaternion.clone();
 for(const state of ['alive','caught'] as const){
  fish.setLifeState(state);fish.update(.03);assert.equal(fish.getState().lifeState,state);
  let triangles=0,calls=0;fish.root.traverseVisible(o=>{if(o instanceof Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;calls+=Array.isArray(o.material)?o.geometry.groups.length:1;}});
  assert.ok(triangles>0&&triangles<=FISH_BUDGET.maxTriangles,`${state}: ${triangles} triangles`);assert.ok(calls<=FISH_BUDGET.maxDrawCalls,`${state}: ${calls} calls`);
  assert.ok(fish.root.position.equals(rootPosition));assert.ok(fish.root.quaternion.equals(rootRotation));
 }
 fish.dispose();assert.ok(fish.getState().disposed);
});
