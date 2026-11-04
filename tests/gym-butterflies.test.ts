import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { createGymButterflies, GYM_BUTTERFLY_OFFSETS } from '../src/viewer/testingGym/butterflies';
import { LOVERS_POINT_ARTWORKS } from '../src/data/lovers-point-artworks';
import { artworkLocalPosition } from '../src/viewer/testingGym/statues';
import { groundHeight } from '../src/viewer/testingGym/elevation';
import { createLodController } from '../src/models/shared/lod/controller';

test('Six gym monarchs fly bounded metre-scale routes and share one draw at every LOD',async()=>{
 const statue=LOVERS_POINT_ARTWORKS.find(a=>a.id==='butterfly-statue')!,anchor=artworkLocalPosition(statue.coordinates);
 const group=createGymButterflies(groundHeight,anchor),lod=createLodController(),camera=new PerspectiveCamera(45,1,.01,1000),matrix=new Matrix4(),point=new Vector3();
 try{
  await lod.register(group.root);const counts=lod.stats(group.root);
  assert.deepEqual([counts.near.triangles,counts.mid.triangles,counts.far.triangles],[5472,3360,1272]);
  assert([counts.near,counts.mid,counts.far].every(level=>level.draws===1));
  const geometry=group.batch.mesh.geometry.attributes.position.array.slice();
  const before=group.batch.mesh.instanceMatrix.array.slice();
  for(const time of [1,8,20,60]){
   group.update(time);
   for(let i=0;i<6;i++){
    group.batch.getTransformAt(i,matrix);point.setFromMatrixPosition(matrix).add(group.root.position);
    const [x,z]=GYM_BUTTERFLY_OFFSETS[i];assert(Math.abs(point.x-anchor.x-x)<=.651&&Math.abs(point.z-anchor.z-z)<=.401);
    const distance=Math.hypot(point.x-anchor.x,point.z-anchor.z);assert(distance<3&&distance>statue.baseRadiusMeters+.15,'All routes stay close to, and clear of, the sculpture');
    assert(point.y-groundHeight(point.x,point.z)>1&&point.y-groundHeight(point.x,point.z)<2);
   }
  }
  assert.notDeepEqual(group.batch.mesh.instanceMatrix.array,before);assert.deepEqual(group.batch.mesh.geometry.attributes.position.array,geometry);
  const stopped=group.batch.mesh.instanceMatrix.array.slice(),clock=group.batch.timeSeconds;group.update(60);
  assert.deepEqual(group.batch.mesh.instanceMatrix.array,stopped);assert.equal(group.batch.timeSeconds,clock);
  group.update(0);const reduced=group.batch.mesh.instanceMatrix.array.slice();group.update(0);assert.deepEqual(group.batch.mesh.instanceMatrix.array,reduced);
  lod.setMode('far');lod.update(camera,900,0,true);let releases=0;group.batch.mesh.addEventListener('dispose',()=>releases++);
  group.dispose();group.dispose();assert.equal(releases,1);assert.equal(lod.size,0);
 }finally{group.dispose();lod.dispose();}
});
