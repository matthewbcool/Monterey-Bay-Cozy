import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import map from '../src/data/lovers-point-gym.json';
import { createTestingGym } from '../src/viewer/testingGym';
import { canStandAt, createAvatarController } from '../src/viewer/avatarController';
import { GYM_SWIM_APPROACH } from '../src/viewer/testingGym/swimming';
import { GYM_WATER_LEVEL } from '../src/viewer/testingGym/elevation';

test('ocean classification excludes the park, buildings, pool and dry beach and stays finite', () => {
  const gym = createTestingGym();
  try {
    for (const [x, z] of [[25,-35],[-15,38],[-8,16],[75,-48],[30,40]])
      assert.equal(gym.swimming.surfaceHeight(x,z), undefined, `${x},${z} is land or a landmark, not ocean`);
    assert.equal(gym.swimming.surfaceHeight(100,-48), GYM_WATER_LEVEL);
    for(const [x,z] of [[NaN,0],[0,Infinity],[10000,0],[-500,0],[0,-1000],[0,1000]]) assert.equal(gym.swimming.surfaceHeight(x,z),undefined);
    const bounds=gym.swimming.bounds;
    assert.equal(bounds.walkable,undefined,'The coastline must remain an internal land/water seam');
    assert([bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ].every(Number.isFinite));
    for(let x=bounds.minX;x<=bounds.maxX;x+=11) for(let z=bounds.minZ;z<=bounds.maxZ;z+=13) {
      const height=gym.swimGroundHeight(x,z), water=gym.swimming.surfaceHeight(x,z);
      assert(Number.isFinite(height)); assert(water===undefined || Number.isFinite(water));
      assert(height > -50, 'Surveyed bathymetry stays within this crop depth range');
    }
  } finally {gym.dispose();}
});

test('the accessible beach has a continuous wading transition and an offshore seabed instead of DEM water flattening', () => {
  const gym=createTestingGym();
  try {
    const z=gym.swimStart.z;
    const index=map.coast.findIndex((a,i)=>i>0 && (a[1]-z)*(map.coast[i-1][1]-z)<0);
    const a=map.coast[index-1],b=map.coast[index];
    const shorelineX=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);
    const left=gym.swimGroundHeight(shorelineX-.001,z),right=gym.swimGroundHeight(shorelineX+.001,z);
    assert(Math.abs(left-right)<.003,'No vertical step may appear at the beach-water seam');
    assert.equal(gym.swimming.surfaceHeight(shorelineX-.001,z),undefined);
    assert.equal(gym.swimming.surfaceHeight(shorelineX+.001,z),GYM_WATER_LEVEL);
    let previous=right;
    for(let distance=.1;distance<=35;distance+=.1) {
      const x=shorelineX+distance,height=gym.swimGroundHeight(x,z);
      assert(Math.abs(height-previous)<.06,'Wading steps must remain smaller than an ordinary stair riser');
      assert(canStandAt(x,z,gym.swimming.bounds,gym.colliders),'An offshore exercise point is obstructed');
      previous=height;
    }
    assert(gym.swimGroundHeight(shorelineX+12,z)<GYM_WATER_LEVEL-.75,'The avatar must reach swimming depth');
    assert(gym.terrainHeight(100,z)>GYM_WATER_LEVEL,'This fixture must retain the source DEM water-flattening limitation');
    assert(gym.swimGroundHeight(100,z)<GYM_WATER_LEVEL-.5,'Gameplay must not reuse an offshore DEM surface as a seabed');
    assert.equal(gym.swimDirection.length(),1); assert.equal(gym.swimDirection.y,0);
  } finally {gym.dispose();}
});

test('dry swim start is reachable from spawn through the actual beach access controller', () => {
  const gym=createTestingGym(),root=new Object3D();
  try {
    assert.equal(gym.swimming.surfaceHeight(gym.swimStart.x,gym.swimStart.z),undefined);
    assert(gym.swimStart.y>GYM_WATER_LEVEL+.1);
    assert(canStandAt(gym.swimStart.x,gym.swimStart.z,gym.bounds,gym.colliders));
    const controller=createAvatarController({root,spawn:gym.spawn.clone(),bounds:gym.bounds,colliders:gym.colliders,groundHeight:(x,z)=>gym.groundHeight(x,z)+.045});
    for(const [x,z] of GYM_SWIM_APPROACH) {
      for(let i=0;i<1100;i++) {
        const dx=x-root.position.x,dz=z-root.position.z,distance=Math.hypot(dx,dz);
        if(distance<.15)break;
        controller.update(1/60,{x:dx/distance,z:dz/distance,run:true});
      }
      assert(Math.hypot(x-root.position.x,z-root.position.z)<.2,`Beach access is blocked before ${x},${z}`);
    }
    assert(root.position.distanceTo(gym.swimStart)<.25);
    const offshore=gym.swimStart.clone().addScaledVector(gym.swimDirection,10+20*1.35);
    assert.equal(gym.swimming.surfaceHeight(offshore.x,offshore.z),GYM_WATER_LEVEL);
    assert(canStandAt(offshore.x,offshore.z,gym.swimming.bounds,gym.colliders),'Twenty seconds of swimming must stay in bounds');
    const berth=new Vector3(gym.vessel.landingX,0,gym.vessel.landingZ);
    assert.equal(gym.swimGroundHeight(berth.x,berth.z),gym.groundHeight(berth.x,berth.z),'Existing dock access heights must stay intact');
  } finally {gym.dispose();}
});
