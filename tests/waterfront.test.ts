import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, InstancedMesh } from 'three';
import { createWaterfrontArea, WATERFRONT, WATERFRONT_BUDGET, waterfrontHeight, projectWaterfront } from '../src/viewer/mapStudy/waterfront';
import { createLodController } from '../src/models/shared/lod/controller';
import { groundHeight } from '../src/viewer/testingGym/elevation';
test('waterfront has retained provenance, bounded geometry and shared projection/LOD',async()=>{
 assert.equal(WATERFRONT.license,'ODbL 1.0');assert(WATERFRONT.coast.length>250);assert(WATERFRONT.terrain.values.every(Number.isFinite));
 assert(Math.abs(waterfrontHeight(0,130)-groundHeight(0,130))<.001);
 assert.deepEqual(projectWaterfront([123,456],WATERFRONT.origin as [number,number]),[123,456]);
 const area=createWaterfrontArea(),lod=createLodController();let triangles=0,draws=0;
 area.root.traverse(o=>{if(o instanceof Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o instanceof InstancedMesh?o.count:1);assert(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));}});
 assert(triangles<=WATERFRONT_BUDGET.triangles,`${triangles} triangles`);assert(draws<=WATERFRONT_BUDGET.draws,`${draws} draws`);assert.deepEqual(area.root.scale.toArray(),[1,1,1]);
 await lod.register(area.root);const stats=lod.stats(area.root);assert(stats.far.triangles<stats.mid.triangles&&stats.mid.triangles<stats.near.triangles);lod.dispose();area.dispose();area.dispose();
});
