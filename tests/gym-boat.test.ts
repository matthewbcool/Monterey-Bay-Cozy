import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Vector3 } from 'three';
import { canStandAt } from '../src/viewer/avatarController';
import { createTestingGym } from '../src/viewer/testingGym';
import { GYM_BOAT_BERTH } from '../src/viewer/testingGym/boatController';

test('rowboat starts beside a reachable dock at its registered metre scale', () => {
  const gym = createTestingGym();
  try {
    assert(gym.vessel.canFloatAt(GYM_BOAT_BERTH.x, GYM_BOAT_BERTH.z, GYM_BOAT_BERTH.yaw));
    assert(canStandAt(GYM_BOAT_BERTH.landingX, GYM_BOAT_BERTH.landingZ, gym.bounds, gym.colliders));
    assert.equal(gym.interactions.find(item => item.id === 'rowboat')?.action, 'board');
    assert.deepEqual(gym.boat.scale.toArray(), [1, 1, 1]);
    assert.equal(gym.boat.position.y, gym.water.root.position.y);
    assert(Math.hypot(gym.dock.position.x - gym.boat.position.x, gym.dock.position.z - gym.boat.position.z) < 4);
    const seat = gym.vessel.seatPose(new Vector3());
    assert(seat.y > gym.water.root.position.y && seat.y < gym.water.root.position.y + .4);
  } finally { gym.dispose(); }
});

test('rowing steers offshore, slows to a stop, and cannot drive through the coast', () => {
  const gym = createTestingGym();
  try {
    const vessel = gym.vessel;
    for (let i = 0; i < 80; i++) vessel.update(.05, { throttle: 1, steer: 0, fast: false });
    assert(gym.boat.position.z > GYM_BOAT_BERTH.z + 6);
    assert(vessel.speed > 2 && !vessel.nearDock());
    const beforeX = gym.boat.position.x;
    for (let i = 0; i < 60; i++) vessel.update(.05, { throttle: 1, steer: 1, fast: true });
    assert(gym.boat.position.x > beforeX + 1 && vessel.heading > .2);
    assert(vessel.canFloatAt(gym.boat.position.x, gym.boat.position.z, vessel.heading));
    vessel.reset();
    for (let i = 0; i < 160; i++) vessel.update(.05, { throttle: -1, steer: 0, fast: false });
    assert(gym.boat.position.z > GYM_BOAT_BERTH.z - 3, 'reverse cannot drive the stern onto land');
    assert(vessel.canFloatAt(gym.boat.position.x, gym.boat.position.z, vessel.heading));
    vessel.reset();
    assert.deepEqual(gym.boat.position.toArray(), [GYM_BOAT_BERTH.x, gym.water.root.position.y, GYM_BOAT_BERTH.z]);
    assert.equal(vessel.speed, 0);
  } finally { gym.dispose(); }
});
