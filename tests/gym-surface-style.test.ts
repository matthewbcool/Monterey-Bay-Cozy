import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BoxGeometry, Float32BufferAttribute, Group, Mesh } from 'three';
import { createToonMaterial } from '../src/models/shared/style';
import { applyNodeStyle, createNodeStyleEnvironment } from '../src/viewer/nodeStyle';
import { applyGymSurfaceStyle } from '../src/viewer/gymSurfaceStyle';

test('gym detail is scoped, repeat-safe and owns exactly one disposable contact field',()=>{
  const root=new Group(),geometry=new BoxGeometry(),environment=createNodeStyleEnvironment();
  geometry.setAttribute('color',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3).fill(.5),3));
  geometry.setAttribute('groundKind',new Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(1),1));
  const ground=new Mesh(geometry,createToonMaterial({vertexColors:true,rim:false}));
  ground.name='gym-ground-surface';ground.userData.singleGroundSurface=true;
  const prop=new Mesh(geometry,createToonMaterial({vertexColors:true}));prop.name='library-prop';root.add(ground,prop);
  const materials=applyNodeStyle(root,false,environment);
  try{
    applyGymSurfaceStyle(root,environment);
    const detail=ground.material.userData.gymContactTexture;
    assert(detail);assert.equal(detail.image.width,256);assert.equal(detail.image.height,256);
    assert.equal(detail.image.data.byteLength,262144);assert(detail.generateMipmaps);
    assert.equal(prop.material.userData.gymSurfaceStyle,undefined,'Library props retain their own shared style');
    const versions=[...materials].map(m=>m.version);
    applyGymSurfaceStyle(root,environment);
    assert.equal(ground.material.userData.gymContactTexture,detail);
    assert.deepEqual([...materials].map(m=>m.version),versions,'A repeated pass must not recompile');
    let disposed=0;detail.addEventListener('dispose',()=>disposed++);
    ground.material.dispose();ground.material.dispose();assert.equal(disposed,1);
  }finally{for(const m of materials)m.dispose();geometry.dispose();environment.dispose();}
});
