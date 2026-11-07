import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,Vector3} from 'three';
import {createGymSurrey} from '../src/viewer/testingGym/surrey';
import {createSurrey} from '../src/models/props/surrey';
import {disposeObject} from '../src/models/props/primitives';
import {prepareGeometryLods} from '../src/models/shared/lod/geometry';
import {Mesh} from 'three';
import {createLodController} from '../src/models/shared/lod/controller';
import {createTestingGym} from '../src/viewer/testingGym';
import {ACCESS_SURFACES,accessHeight} from '../src/viewer/testingGym/access';
import {PHOTO_PIER} from '../src/viewer/testingGym/photoPier';
const bounds={minX:-500,maxX:500,minZ:-500,maxZ:500};
test('surrey has six animated batches, metre dimensions and useful LOD reductions',async()=>{
 const rig=createSurrey(),lod=createLodController();await lod.register(rig.root);
 try{const size=new Box3().setFromObject(rig.root).getSize(new Vector3()),stats=lod.stats(rig.root);
 assert(size.x>1.5&&size.x<1.6);assert(size.y>2.1&&size.y<2.2);assert(size.z>2.2&&size.z<2.3);
 assert.equal(stats.near.draws,6);assert(stats.near.triangles<=3000);assert(stats.far.triangles<stats.near.triangles*.7);
 const before=rig.root.position.clone();rig.animate(.33,.5);assert.equal(rig.wheels[0].rotation.x,1);assert.equal(rig.steering[0].rotation.y,.225);assert(rig.root.position.equals(before));
 const frame=(rig.root.children[0].children[0] as Mesh),far=(await prepareGeometryLods(frame.geometry)).far.getAttribute('position');
 for(const x of [-.57,.57])for(const z of [-.75,.85])assert(Array.from({length:far.count},(_,i)=>i).some(i=>Math.abs(far.getX(i)-x)<.025&&Math.abs(far.getZ(i)-z)<.025&&far.getY(i)>2),'Far retains each canopy support');
 console.log('SURREY_LOD',JSON.stringify(stats));
 }finally{disposeObject(rig.root);assert.equal(lod.size,0);lod.dispose();}
});
test('vehicle accelerates, brakes, reverses, steers and rejects thin central obstacles and cliffs',()=>{
 const obstacles:any[]=[];const vehicle=createGymSurrey(()=>5,bounds,obstacles);
 try{
 const start=vehicle.root.position.clone();for(let i=0;i<120;i++)vehicle.update(1/60,1,0);assert(vehicle.root.position.distanceTo(start)>4);assert(vehicle.speed<=3);
 const heading=vehicle.root.rotation.y;for(let i=0;i<30;i++)vehicle.update(1/60,1,.6);assert(vehicle.root.rotation.y>heading);
 for(let i=0;i<240;i++)vehicle.update(1/60,0,0);assert(Math.abs(vehicle.speed)<.001);
 for(let i=0;i<120;i++)vehicle.update(1/60,-1,0);assert(vehicle.speed<-.9&&vehicle.speed>=-1);
 obstacles.push({kind:'circle',x:vehicle.root.position.x,z:vehicle.root.position.z,radius:.05});assert(!vehicle.valid(vehicle.root.position.x,vehicle.root.position.z,vehicle.root.rotation.y));
 const phase=vehicle.crank.rotation.x;vehicle.update(.05,1,0);assert.equal(vehicle.speed,0);assert.equal(vehicle.crank.rotation.x,phase);
 const position=vehicle.root.position.clone();vehicle.update(NaN,1,0);assert(vehicle.root.position.equals(position));assert(vehicle.exit());
 }finally{vehicle.dispose();}
 const cliff=createGymSurrey((x)=>x>0?5:2,bounds,[]);assert(!cliff.valid(0,0,0));cliff.dispose();
});
test('real gym parking, route and exit are clear; pier landing has a shared physical section',()=>{
 const gym=createTestingGym({whaleSightingRoll:.8}),vehicle=createGymSurrey(gym.groundHeight,gym.bounds,gym.colliders);
 try{
 assert(vehicle.valid(vehicle.root.position.x,vehicle.root.position.z,vehicle.root.rotation.y),'parking footprint');assert(vehicle.exit(),'safe boarding point');
 const start=vehicle.root.position.clone();for(let i=0;i<180;i++)vehicle.update(1/60,1,0);assert(vehicle.root.position.distanceTo(start)>6,'clear coastal trail run');
 assert(vehicle.exit(),'safe exit after driving');
 const landing=ACCESS_SURFACES.find(s=>s.sourceId==='photo-pier-lower')!;assert.equal(landing.height,PHOTO_PIER.lower);assert.equal(accessHeight(landing.x,landing.z),PHOTO_PIER.lower);
 const steps=ACCESS_SURFACES.filter(s=>s.sourceId==='photo-pier-stairs');assert.equal(steps.length,16);assert(steps.every((s,i)=>!i||Math.abs(steps[i-1].height-s.height-.1625)<1e-6));
 }finally{vehicle.dispose();gym.dispose();}
});
