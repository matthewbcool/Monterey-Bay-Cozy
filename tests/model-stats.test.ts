import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicMaterial } from 'three';
import {modelStats} from '../src/viewer/modelStats';

test('Model stats honor state visibility, instance count and grouped meshes',()=>{
  const root=new Group(),geometry=new BoxGeometry(),material=new MeshBasicMaterial();
  const school=new InstancedMesh(geometry,material,48);root.add(school);
  const hidden=new Group();hidden.visible=false;hidden.add(new Mesh(geometry,material));root.add(hidden);

  assert.deepEqual(modelStats(root),{model:{drawCalls:1,triangles:576}});
  school.count=16;assert.equal(modelStats(root).model.triangles,192);
  school.count=0;assert.deepEqual(modelStats(root).model,{drawCalls:0,triangles:0});
  geometry.dispose();material.dispose();
});
test('Material groups, hidden materials and draw ranges constrain counts',()=>{
  const geometry=new BoxGeometry(),a=new MeshBasicMaterial(),b=new MeshBasicMaterial();
  const mesh=new Mesh(geometry,[a,b]);geometry.clearGroups();geometry.addGroup(0,18,0);geometry.addGroup(18,18,1);
  assert.deepEqual(modelStats(mesh).model,{drawCalls:2,triangles:12});
  b.visible=false;assert.deepEqual(modelStats(mesh).model,{drawCalls:1,triangles:6});
  geometry.setDrawRange(3,6);assert.deepEqual(modelStats(mesh).model,{drawCalls:1,triangles:2});
  geometry.dispose();a.dispose();b.dispose();
});
