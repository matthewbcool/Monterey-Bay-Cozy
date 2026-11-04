import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Mesh, Object3D, Raycaster, Vector3 } from 'three';
import { createLodController } from '../src/models/shared/lod/controller';
import { BAY_REGION_BUDGET } from '../src/viewer/mapStudy/bayRegion';
import { createTestingGym } from '../src/viewer/testingGym';
import { createGymBayExtension } from '../src/viewer/testingGym/bayExtension';
import { createFlightController } from '../src/viewer/testingGym/flightController';

test('the Testing Gym uses the shared bay at its metre origin with a separate detail cutout and flight samples', async () => {
  const gym = createTestingGym({ whaleSightingRoll: .99 });
  const bay = createGymBayExtension(gym);
  const lod = createLodController();
  try {
    assert.deepEqual(bay.root.scale.toArray(), [1, 1, 1]);
    assert(bay.flightBounds.maxX - bay.flightBounds.minX > 37000);
    assert(bay.flightBounds.maxZ - bay.flightBounds.minZ > 53000);
    assert.equal(bay.floorAt(0, 0), gym.flightFloor(0, 0));
    assert.equal(bay.waterAt(100, -80), gym.flightWater(100, -80));
    const offshore = bay.point(-121.98, 36.8);
    assert.equal(bay.waterAt(offshore.x, offshore.z), -.3);
    assert(bay.floorAt(offshore.x, offshore.z) < -1);
    assert.equal(bay.waterAt(bay.point(-122.02, 37).x, bay.point(-122.02, 37).z), undefined);
    const remoteLand = bay.point(-121.89, 36.6);
    assert.equal(bay.canLandAt(0, 0), true);
    assert.equal(bay.canLandAt(remoteLand.x, remoteLand.z), false);
    const flyer = new Object3D(); flyer.position.set(remoteLand.x, bay.floorAt(remoteLand.x, remoteLand.z) + .35, remoteLand.z);
    const flight = createFlightController(flyer, bay.flightBounds, bay.floorAt, [], bay.waterAt, bay.canLandAt);
    flight.launch();
    for (let i = 0; i < 180; i++) flight.update(1 / 60, { x: 0, z: 0, run: false, dive: true });
    assert(flight.active, 'The coarse regional terrain must not hand off to the local walking controller');
    const ray = new Raycaster(new Vector3(0, 2000, 0), new Vector3(0, -1, 0));
    const terrain: Mesh[] = [];
    bay.root.traverse(object => { if (object instanceof Mesh && object.name.startsWith('Bay terrain')) terrain.push(object); });
    bay.root.updateMatrixWorld(true);
    assert.equal(ray.intersectObjects(terrain).length, 0, 'The detailed park owns the local terrain');
    await lod.register(bay.root);
    const cost = lod.stats(bay.root);
    assert(cost.near.triangles <= BAY_REGION_BUDGET.triangles);
    assert(cost.near.draws <= BAY_REGION_BUDGET.draws);
    assert(cost.far.triangles < cost.near.triangles);
  } finally {
    lod.dispose();
    bay.dispose();
    gym.dispose();
  }
});
