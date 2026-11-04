import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,Raycaster,Vector3} from 'three';
import {createFlightController,OTTER_FLIGHT} from '../src/viewer/testingGym/flightController';
import {canStandAt,touchesFootprint,type GymCollider} from '../src/viewer/avatarController';
import {createAvatarModel} from '../src/models/avatar';
import {createNodeStyleEnvironment} from '../src/viewer/nodeStyle';
import {createOtterDiveEffects} from '../src/viewer/testingGym/otterDiveEffects';
import {addParkLandmarks} from '../src/viewer/testingGym/landmarks';
import {createWaterfrontArea,waterfrontHeight} from '../src/viewer/mapStudy/waterfront';
import {nearestCoastalTrail} from '../src/viewer/mapStudy/waterfrontTrail';
const bounds={minX:-100,maxX:100,minZ:-100,maxZ:100};
test('powered suit crosses the surface, hovers underwater, respects seabed and resurfaces',()=>{
 const root=new Group();root.position.set(0,4,0);const c=createFlightController(root,bounds,()=>-4,[],()=>1);c.launch();
 for(let i=0;i<240;i++)c.update(1/60,{x:0,z:0,run:false,dive:true});assert(c.getState().submerged);assert(c.active);assert(root.position.y>=-4+OTTER_FLIGHT.clearance);
 for(let i=0;i<180;i++)c.update(1/60,{x:1,z:0,run:false});assert(c.getState().velocity[0]<=OTTER_FLIGHT.underwaterCruise+.001);
 for(let i=0;i<240;i++)c.update(1/60,{x:0,z:0,run:false,jump:true});assert(!c.getState().submerged);assert(root.position.y>1);
});
test('rotated solid footprints leave their empty box corners walkable and flyable',()=>{
 const footprint=[[-4,0],[0,-4],[4,0],[0,4]] as const;
 const box={kind:'box' as const,minX:-4,maxX:4,minZ:-4,maxZ:4,top:8,footprint};
 assert(canStandAt(3.5,3.5,bounds,[box]));assert(!canStandAt(1,1,bounds,[box]));
 const root=new Group();root.position.set(3.5,4,3.5);const c=createFlightController(root,bounds,()=>0,[box]);c.launch();
 for(let i=0;i<5;i++)assert(!c.update(1/60,{x:1,z:0,run:false}).blocked);
 assert(root.position.y<5,'Empty AABB corner must not raise the player to the roof');
});
test('pool collision follows its real fence and rails stay attached to adjacent posts',()=>{
 const scenery=new Group(),overlays=new Group(),colliders:GymCollider[]=[];const {poolGate}=addParkLandmarks(scenery,overlays,colliders);
 const pool=colliders.find(c=>c.kind==='box'&&c.footprint&&touchesFootprint(-16,38,c.footprint,0))!;assert(pool.kind==='box'&&pool.footprint);
 let corners=0;
 for(let x=pool.minX+.3;x<pool.maxX;x+=.5)for(let z=pool.minZ+.3;z<pool.maxZ;z+=.5){
  if(!touchesFootprint(x,z,pool.footprint,.28)){assert(canStandAt(x,z,bounds,[pool]));corners++;}
 }assert(corners>10);
 const rails=scenery.children.filter(c=>c.name.includes('terrain-following rail'));assert(rails.length>8);assert(rails.every(c=>c.userData.elevationPlaced));
 for(const group of [scenery,overlays,poolGate.root])group.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();if(!Array.isArray(o.material))o.material.dispose();}});
});
test('submerged suit suppresses every flame, emits bounded bubbles and restores air exhaust',()=>{
 const avatar=createAvatarModel(undefined,{gear:'otter-man'}),environment=createNodeStyleEnvironment();environment.headlamp.enabled=true;
 const effects=createOtterDiveEffects(environment);avatar.root.position.y=-2;
 for(let i=0;i<120;i++){avatar.update(1/60,{flying:true,speed:4,submerged:true});effects.update(1/60,avatar,true,true,false,false,1);}
 assert.equal(avatar.getState().footThrust,0);assert.equal(avatar.getState().handThrust,0);assert(avatar.getState().flightPitch>1.4);
 assert(effects.getState().activeBubbles>0&&effects.getState().activeBubbles<=24);assert(effects.getState().headlamp);
 for(let i=0;i<120;i++)avatar.update(1/60,{flying:true,speed:18,submerged:false});assert(avatar.getState().footThrust>0);
 effects.update(1/60,avatar,false,false,false,false,1);assert.equal(effects.getState().activeBubbles,0);assert.equal(environment.headlamp.strength.value,0);
 effects.dispose();avatar.dispose();environment.dispose();
});
test('coastal trail terrain is single-layer and matches the walking sampler',()=>{
 const area=createWaterfrontArea();area.root.updateMatrixWorld(true);
 const meshes:Mesh[]=[];area.root.traverse(o=>{if(o instanceof Mesh&&o.name.startsWith('pacific-grove-waterfront'))meshes.push(o);});
 const ray=new Raycaster(new Vector3(),new Vector3(0,-1,0));let checked=0;
 // Cross-sections through the extended coastal route. Ignore buildings by probing within 30 cm of ground.
 for(let x=120;x<1200;x+=17.13){const p=nearestCoastalTrail(x,280+x*.3);if(p.distance>180)continue;
  for(const offset of [-.7,.2,.8]){const xx=p.x-p.dz*offset,zz=p.z+p.dx*offset,y=waterfrontHeight(xx,zz);ray.ray.origin.set(xx,y+.3,zz);ray.far=.6;
   const hits=ray.intersectObjects(meshes,false);assert.equal(hits.length,1,`${xx},${zz} layered or missing trail`);assert(Math.abs(hits[0].point.y-y)<.003);checked++;}
 }assert(checked>60);area.dispose();
});
