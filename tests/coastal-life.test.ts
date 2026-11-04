import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Matrix4,Mesh} from 'three';
import {createCoastalLife,COASTAL_LIFE,coastalDistance,coastalIsWater} from '../src/viewer/testingGym/coastalLife';
import {createLodController} from '../src/models/shared/lod/controller';
import {applyNodeStyle} from '../src/viewer/nodeStyle';
import {createWaterfrontArea,WATERFRONT_BUDGET} from '../src/viewer/mapStudy/waterfront';
import {nearestCoastalTrail,TRAIL_SOURCE} from '../src/viewer/mapStudy/waterfrontTrail';
test('coastal wildlife stays offshore, fits budgets and sleeps when distant',async()=>{
 const a=createCoastalLife(()=>-4),b=createCoastalLife(()=>-4),lod=createLodController();
 assert.equal(a.stats().kelp,120);assert.equal(a.stats().beds,12);assert.equal(a.stats().animals,54);
 assert(a.stats().draws<=COASTAL_LIFE.budget.draws);assert(a.stats().triangles<=COASTAL_LIFE.budget.triangles);
 assert.deepEqual(a.beds.map(b=>b.plants.map(p=>p.toArray())),b.beds.map(b=>b.plants.map(p=>p.toArray())));
 for(const bed of a.beds)for(const p of bed.plants){assert(coastalIsWater(p.x,p.z));assert(coastalDistance(p.x,p.z)>=9);}
 for(const s of a.swimmers)for(let i=0;i<512;i++){const p=s.curve.getPointAt(i/512);assert(coastalIsWater(p.x,p.z),s.id+' never crosses land');assert(coastalDistance(p.x,p.z)>6,s.id+' full body clears shore');assert(p.y<1);}
 const shark=a.swimmers.find(s=>s.id==='great-white-shark')!;assert.equal(shark.model.root.userData.seed,COASTAL_LIFE.seed+3);assert.equal(shark.model.root.userData.lengthMeters,4);assert.deepEqual(shark.model.root.scale.toArray(),[1,1,1]);
 const before=shark.model.root.position.clone();a.update(.1);assert(before.distanceTo(shark.model.root.position)>.05);
 a.setViewer(5000,5000);const asleep=shark.model.root.position.clone();a.update(.1);assert(shark.model.root.position.equals(asleep));assert(a.beds.every(b=>!b.root.visible));
 a.setViewer(210,-45);a.update(.1,false);assert(shark.model.root.position.equals(asleep));
 applyNodeStyle(a.root);a.swayKelp();const matrix=new Matrix4(),p=new Vector3();for(const batch of a.kelpBatches){batch.getMatrixAt(0,matrix);p.set(0,0,0).applyMatrix4(matrix);assert(p.y<0);assert(batch.boundingSphere!.radius>0);}
 await lod.register(a.root);const costs=lod.stats(a.root);assert(costs.far.triangles<costs.mid.triangles&&costs.mid.triangles<costs.near.triangles);
 lod.dispose();a.dispose();a.dispose();b.dispose();
});
test('waterfront trail retains source IDs, clear travel space and bounded shared geometry',()=>{
 const area=createWaterfrontArea();let triangles=0,draws=0;
 area.root.traverse(o=>{if(o instanceof Mesh){draws++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*('count'in o?Number(o.count):1);}});
 assert(triangles<WATERFRONT_BUDGET.triangles,`${triangles} triangles`);assert(draws<=WATERFRONT_BUDGET.draws);
 const ids=new Set(TRAIL_SOURCE.items.map(p=>p.id));assert(area.trail.records.some(r=>r.id.startsWith('node/')));
 for(const r of area.trail.records){if(r.id.startsWith('node/'))assert(ids.has(r.id));else assert(nearestCoastalTrail(r.x,r.z).distance>2.2);}
 assert(area.trail.plantCount>100);assert(area.trail.fenceCount>0);assert(area.trail.records.some(r=>r.kind==='bicycle_parking'));assert(area.trail.records.some(r=>r.kind==='information'));
 area.dispose();
});
