import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh} from 'three';
import {seabedDepth} from '../src/viewer/bathymetry';
import {createSeabed} from '../src/viewer/seabed';
import {createHarbor} from '../src/viewer/harbor';
import {disposeObject} from '../src/models/props/primitives';

test('The harbor shelf has metre-scale depth and open space for an underwater camera',()=>{
 assert.ok(seabedDepth(-8,0)>1&&seabedDepth(-8,0)<1.5);
 assert.ok(seabedDepth(14,0)>=7.4);
 const bottom=createSeabed(),p=bottom.sand.geometry.attributes.position;
 for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getY(i)+seabedDepth(p.getX(i),p.getZ(i)))<1e-5);
 let calls=0,triangles=0;bottom.root.traverse(o=>{if(o instanceof Mesh){calls++;triangles+=((o.geometry.index?.count??o.geometry.attributes.position.count)/3)*('count' in o?Number(o.count):1);}});
 // Ceiling raised from 5,500 for the giant-kelp forest (11 factory plants, still one draw).
 assert.equal(calls,5);assert.ok(triangles<9000,`${triangles} seabed triangles`);disposeObject(bottom.root);
});
test('Underwater wildlife keeps metre scale, pauses with harbor time and releases resources',()=>{
 const harbor=createHarbor();harbor.update(3);const a=harbor.wildlife.map(f=>({position:f.root.position.toArray(),phase:f.getState().phase}));harbor.update(3);
 assert.deepEqual(harbor.wildlife.map(f=>({position:f.root.position.toArray(),phase:f.getState().phase})),a);
 for(const fish of harbor.wildlife){assert.deepEqual(fish.root.scale.toArray(),[1,1,1]);assert.ok(fish.root.position.y<-.5);assert.ok(fish.root.position.y>-seabedDepth(fish.root.position.x,fish.root.position.z));}
 let materials=0;harbor.water.material.addEventListener('dispose',()=>materials++);harbor.dispose();assert.equal(materials,1);
});
