import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Color,Mesh,Raycaster,Vector3,PerspectiveCamera} from 'three';
import {CALEDONIA,CALEDONIA_BUDGET,COURT_FRAME,caledoniaHeight,courtPoint,createCaledoniaArea,caledoniaFootprint} from '../src/viewer/mapStudy/caledonia';
import {createLodController} from '../src/models/shared/lod/controller';
import {canStandAt} from '../src/viewer/avatarController';
import {waterfrontHeight} from '../src/viewer/mapStudy/waterfront';
import {createTestingGym} from '../src/viewer/testingGym';
import {CALEDONIA_FENCE,CALEDONIA_PARK_ENTRANCES} from '../src/viewer/mapStudy/caledoniaFence';
test('Caledonia preserves mapped park, court, playground and nearby street provenance',()=>{
 assert(CALEDONIA.features.some(f=>f.id==='way/871779748'&&f.name==='Caledonia Park'));
 assert.equal(CALEDONIA.features.filter(f=>f.kind==='playground').length,2);
 assert(COURT_FRAME.length>30&&COURT_FRAME.length<32);assert(COURT_FRAME.width>17&&COURT_FRAME.width<18);
 for(const name of ['Caledonia Street','Central Avenue','Jewell Avenue','19th Street','Union Street'])assert(CALEDONIA.paths.some(p=>p.name===name),name);
 assert.deepEqual(caledoniaFootprint([-121.91685,36.6256]),[[-430,90],[-240,90],[-240,15],[-145,15],[-145,450],[-430,450]]);
});
test('Caledonia has one terrain surface, a full park enclosure, open internal court and bounded LOD costs',async()=>{
 const a=createCaledoniaArea(),lod=createLodController(),ray=new Raycaster(),bounds={minX:-430,maxX:-145,minZ:90,maxZ:450};await lod.register(a.root);
 assert.deepEqual(a.root.scale.toArray(),[1,1,1]);assert.equal(a.court.hoops,2);assert(canStandAt(a.spawn.x,a.spawn.z,bounds,a.colliders));
 for(const point of a.court.entrances)assert(canStandAt(...point,bounds,a.colliders,.5),'entrance clears larger avatar');
 assert(canStandAt(...courtPoint(3,COURT_FRAME.width/2+.5),bounds,a.colliders),'court-side apron stays open inside the park');
 assert.equal(a.parkEntrances.length,5);assert.deepEqual(a.parkBoundary,CALEDONIA.features.find(f=>f.id==='way/871779748')!.points);
 for(const f of CALEDONIA.features.filter(f=>f.kind==='playground'||f.id==='way/435247876')){
  const center=f.points.reduce((p,q)=>[p[0]+q[0]/f.points.length,p[1]+q[1]/f.points.length],[0,0]);
  assert(a.containsPark(center[0],center[1]),'park enclosure includes '+f.id);
 }
 for(const run of a.fence.runs){const p=[(run.a[0]+run.b[0])/2,(run.a[1]+run.b[1])/2] as const;assert(!canStandAt(...p,bounds,a.colliders),'park boundary span blocks walking');}
 for(const gate of a.parkEntrances){
  assert(a.containsPark(...gate.inside));assert(!a.containsPark(...gate.outside));
  assert(gate.sourcePathIds.every(id=>CALEDONIA.paths.some(p=>p.id===id)),'gate retains mapped access provenance');
  for(let i=0;i<=20;i++){
   const t=i/20,x=gate.outside[0]+(gate.inside[0]-gate.outside[0])*t,z=gate.outside[1]+(gate.inside[1]-gate.outside[1])*t;
   assert(canStandAt(x,z,bounds,a.colliders,.5),gate.id+' passage clears larger avatar at '+t);
  }
 }
 for(const level of ['near','mid','far'] as const){lod.setMode(level);lod.update(new PerspectiveCamera(),900,0,true);assert(lod.inspect(a.root).every(e=>e.level===level));const stats=lod.stats(a.root)[level];assert(stats.triangles<=CALEDONIA_BUDGET.triangles);assert(stats.draws<=CALEDONIA_BUDGET.draws);
  for(const [x,z]of [courtPoint(3.13,3.13),courtPoint(-5.73,-3.73),[-267.33,255.17],[-232.37,157.19]]){ray.set(new Vector3(x,80,z),new Vector3(0,-1,0));const hits=ray.intersectObject(a.root,true).filter(h=>Math.abs(h.point.y-caledoniaHeight(x,z))<.02);assert.equal(hits.length,1,level+' one ground '+[x,z]);}
 }
 // A former authored spur crossed the woodchips beneath the slides. Keep its old endpoint mulch.
 ray.set(new Vector3(-260.8,80,240),new Vector3(0,-1,0));
 // LOD's picking wrapper uses Near faces; inspect the actual active render geometry here.
 const renderHits: ReturnType<Raycaster['intersectObject']>=[];a.root.traverse(o=>{if(o instanceof Mesh)Mesh.prototype.raycast.call(o,ray,renderHits);});
 const ground=renderHits.find(h=>Math.abs(h.point.y-caledoniaHeight(-260.8,240))<.02);assert(ground?.face);
 const color=(ground.object as Mesh).geometry.getAttribute('color'),expected=new Color('#d1ae79');
 for(const i of [ground.face.a,ground.face.b,ground.face.c]){assert(Math.abs(color.getX(i)-expected.r)<1e-5);assert(Math.abs(color.getY(i)-expected.g)<1e-5);assert(Math.abs(color.getZ(i)-expected.b)<1e-5);}
 for(const z of [150,210,270,330,390,450])assert(Math.abs(caledoniaHeight(-145,z)-waterfrontHeight(-145,z))<.015,'east seam at '+z);
 const fenceStats=lod.stats(a.fence.root);assert.equal(fenceStats.near.draws,2);assert(fenceStats.mid.triangles<fenceStats.near.triangles*.6);assert(fenceStats.far.triangles<fenceStats.near.triangles*.3,'distance removes diamond infill rather than preserving thin wire in terrain batch');
 console.log('Caledonia LOD',JSON.stringify(lod.stats(a.root)));lod.dispose();a.dispose();
});
test('Fence collision follows the park terrain, preserves real gate openings and survives camera LOD',async()=>{
 const a=createCaledoniaArea(),lod=createLodController();await lod.register(a.root);
 const before=JSON.stringify(a.fence.colliders),bounds={minX:-430,maxX:-145,minZ:90,maxZ:450};
 const tops:number[]=[];
 for(const c of a.fence.colliders){
  assert.equal(c.kind,'box');if(c.kind!=='box')continue;
  const x=(c.minX+c.maxX)/2,z=(c.minZ+c.maxZ)/2,height=caledoniaHeight(x,z);tops.push(c.top!);
  assert(c.top!>=height+CALEDONIA_FENCE.heightMeters-.01);
  assert(c.top!<height+CALEDONIA_FENCE.heightMeters+.3,'short footprint uses local terrain top, not distant maximum');
 }
 assert(Math.max(...tops)-Math.min(...tops)>1,'perimeter follows the actual grade instead of court-level floating rails');
 for(const level of ['near','mid','far'] as const){
  lod.setMode(level);lod.update(new PerspectiveCamera(),900,0,true);assert.equal(JSON.stringify(a.fence.colliders),before);
  for(const gate of CALEDONIA_PARK_ENTRANCES)assert(canStandAt(...gate.center,bounds,a.colliders,.5));
  a.fence.root.traverse(object=>{if(object instanceof Mesh){assert(!Array.isArray(object.material));assert.equal(object.material.transparent,false);assert.equal(object.material.userData.rim,false);assert(object.geometry.getAttribute('position').array.every(Number.isFinite));}});
 }
 lod.dispose();a.dispose();
});
test('Gym owns Caledonia land, walking, flight ground and independent collisions',()=>{
 const g=createTestingGym({whaleSightingRoll:.99}),p=g.caledonia.spawn;
 assert(canStandAt(p.x,p.z,g.bounds,g.colliders));assert.equal(g.swimming.surfaceHeight(p.x,p.z),undefined);assert.equal(g.flightWater(p.x,p.z),undefined);
 assert.equal(g.flightFloor(p.x,p.z),caledoniaHeight(p.x,p.z));assert.equal(g.swimGroundHeight(p.x,p.z),caledoniaHeight(p.x,p.z));
 assert(canStandAt(-145,210,g.bounds,[],.5),'old western boundary is open');assert(!canStandAt(-300,700,g.bounds,[]),'no invented walkable terrain below district crop');g.dispose();
});
