import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, InstancedMesh, Material, Mesh, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three';
import { createGymGulls, GYM_GULLS } from '../src/viewer/testingGym/gulls';
import { createTestingGym } from '../src/viewer/testingGym';
import { coastalDistance, coastalIsWater } from '../src/viewer/testingGym/coastalLife';
import { groundHeight, GYM_WATER_LEVEL } from '../src/viewer/testingGym/elevation';
import { canStandAt } from '../src/viewer/avatarController';
import { getGullState } from '../src/models/habitat/western-gull/createWesternGull';
import { createLodController } from '../src/models/shared/lod/controller';
import { LOD_LEVELS, prepareGeometryLods } from '../src/models/shared/lod/geometry';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

type Gulls = ReturnType<typeof createGymGulls>;
const makeGulls = () => createGymGulls({ groundHeight, surfaceY: GYM_WATER_LEVEL, isWater: coastalIsWater });
const close = (actual: number, expected: number, tolerance = 1e-7) => assert(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

function transforms(gulls: Gulls) {
  return {
    ground: gulls.grounded.map(bird => ({ id: bird.id, position: bird.root.position.toArray(), rotation: bird.root.quaternion.toArray(), state: getGullState(bird.root) })),
    flight: gulls.flights.map(cell => ({ id: cell.id, matrices: Array.from(cell.flock.mesh.instanceMatrix.array), time: cell.flock.timeSeconds })),
  };
}

function assertSameMotion(a: Gulls, b: Gulls) {
  close(a.stats().elapsed, b.stats().elapsed);
  a.grounded.forEach((bird, index) => {
    const other = b.grounded[index];
    assert(bird.root.position.distanceTo(other.root.position) < 1e-8);
    assert(bird.root.quaternion.angleTo(other.root.quaternion) < 1e-7);
    const state = getGullState(bird.root)!, otherState = getGullState(other.root)!;
    assert.equal(state.pose, otherState.pose); close(state.time, otherState.time);
  });
  a.flights.forEach((cell, index) => {
    assert.deepEqual(cell.flock.mesh.instanceMatrix.array, b.flights[index].flock.mesh.instanceMatrix.array);
    close(cell.flock.timeSeconds, b.flights[index].flock.timeSeconds);
  });
}

test('Park gulls stand and stroll on real terrain without entering water or solid scenery', () => {
  const gym = createTestingGym({ whaleSightingRoll: .99 });
  const gulls = createGymGulls({ groundHeight: gym.groundHeight, surfaceY: GYM_WATER_LEVEL, isWater: coastalIsWater });
  const point = new Vector3(), initial = gulls.grounded.map(bird => bird.root.position.clone());
  const moved = new Set<string>(), walked = new Set<string>(), rested = new Set<string>();
  try {
    gulls.setViewer(25, -35, true);
    assert.equal(gulls.grounded.length, 6); assert.equal(gulls.grounded.filter(bird => bird.walking).length, 2);
    assert.deepEqual(new Set(gulls.grounded.map(bird => bird.sex)), new Set(['male', 'female']));
    assert.deepEqual(gulls.root.scale.toArray(), [1, 1, 1]);
    for (let frame = 0; frame < 300; frame++) {
      gulls.update(.1);
      for (const [index, bird] of gulls.grounded.entries()) {
        const p = bird.root.position, state = getGullState(bird.root)!;
        assert(!coastalIsWater(p.x, p.z), `${bird.id} stays out of the ocean`);
        assert(canStandAt(p.x, p.z, gym.bounds, gym.colliders, .18), `${bird.id} has a clear ground footprint`);
        close(p.y, gym.groundHeight(p.x, p.z) + .02);
        assert(p.distanceTo(bird.home) < 1.2, `${bird.id} remains within its small park patch`);
        if (p.distanceTo(initial[index]) > .1) moved.add(bird.id);
        if (state.pose === 'walking') walked.add(bird.id); else rested.add(bird.id);
        assert(['standing', 'walking'].includes(state.pose), 'Ambient birds never start an autonomous effect');
        if (frame % 10) continue;
        const mesh = bird.root.children[0]; assert(mesh instanceof SkinnedMesh);
        // SkinnedMesh.updateMatrixWorld also refreshes the attached bind inverse.
        bird.root.updateMatrixWorld(true); mesh.skeleton.update();
        const joints = mesh.geometry.getAttribute('skinIndex');
        let lowestClearance = Infinity;
        for (let vertex = 0; vertex < joints.count; vertex++) {
          if (![5, 6].includes(joints.getX(vertex))) continue;
          mesh.getVertexPosition(vertex, point); point.applyMatrix4(mesh.matrixWorld);
          lowestClearance = Math.min(lowestClearance, point.y - gym.groundHeight(point.x, point.z));
        }
        assert(lowestClearance >= -.015 && lowestClearance < .06, `${bird.id} foot clearance ${lowestClearance}`);
      }
    }
    assert.deepEqual(moved, new Set(gulls.grounded.filter(bird => bird.walking).map(bird => bird.id)));
    assert.deepEqual(walked, moved, 'Only the two walking birds change position');
    assert.equal(rested.size, 6, 'Every bird has a standing interval');
  } finally { gulls.dispose(); gym.dispose(); }
});

test('Coastal gulls fly more slowly on individual changing routes and face their measured travel', () => {
  const gulls = makeGulls(), point = new Vector3(), delta = new Vector3(), forward = new Vector3();
  const minSpeeds = Array.from({ length: 18 }, () => Infinity), maxSpeeds = Array(18).fill(0);
  const speeds = Array.from({ length: 18 }, () => [] as number[]);
  try {
    gulls.setViewer(25, -35, true);
    assert.equal(gulls.flights.length, 3); assert.equal(gulls.stats().flying, 18);
    let greatestInlandReach = 0;
    for (const cell of gulls.flights) {
      assert.equal(cell.flock.count, 6); assert.equal(cell.flock.root.children.length, 1);
      assert(cell.flock.mesh instanceof InstancedMesh); assert.equal(cell.flock.mesh.castShadow, false);
      assert.deepEqual(cell.flock.root.scale.toArray(), [1, 1, 1]);
      assert.equal(cell.routes.members.length, 6);
      assert(new Set(cell.routes.members.map(member => member.speed)).size > 3, 'Individual speeds do not form a uniform procession');
      let inlandSamples = 0, waterSamples = 0, deepestInland = 0;
      // Broad routes visit land and sea while retaining safe cruising clearance.
      for (let sample = 0; sample < 360; sample++) for (let slot = 0; slot < 6; slot++) {
        cell.routes.sample(slot, sample * 1.3, point, forward);
        if(coastalIsWater(point.x, point.z)) waterSamples++;
        else { inlandSamples++; deepestInland=Math.max(deepestInland,coastalDistance(point.x,point.z)); }
        assert(point.y > groundHeight(point.x,point.z) + 12, 'Flights clear inland terrain');
      }
      assert(inlandSamples > 100 && waterSamples > 100, `${cell.id} crosses between land and water`);
      greatestInlandReach = Math.max(greatestInlandReach, deepestInland);
      assert(deepestInland > 5, `${cell.id} reaches inland, including the narrow headland`);
      assert(cell.routes.members.every(member=>member.circuitSeconds > 80), 'Longer circuits avoid short repetitive loops');
    }
    assert(greatestInlandReach > 25, 'The population reaches at least 25 m inland');
    // Measure actual rendered instance transforms. Different nominal speeds by
    // themselves would not catch stale transforms or incorrectly facing birds.
    for (let step = 0; step < 900; step++) {
      const before = gulls.flights.map(cell => Array.from({ length: cell.flock.count }, (_, index) => new Vector3().setFromMatrixPosition(cell.flock.getTransformAt(index))));
      gulls.update(.1);
      gulls.flights.forEach((cell, cellIndex) => {
        for (let slot = 0; slot < cell.flock.count; slot++) {
          const matrix = cell.flock.getTransformAt(slot), index = cellIndex * 6 + slot;
          point.setFromMatrixPosition(matrix); delta.copy(point).sub(before[cellIndex][slot]);
          const speed = delta.length() / .1;
          minSpeeds[index] = Math.min(minSpeeds[index], speed); maxSpeeds[index] = Math.max(maxSpeeds[index], speed);
          speeds[index].push(speed);
          assert(speed > 2 && speed < 5.2, `${cell.id}/${slot} travels at a restrained ${speed.toFixed(2)} m/s`);
          forward.set(0, 0, -1).transformDirection(matrix);
          assert(forward.dot(delta.normalize()) > .98, `${cell.id}/${slot} faces its measured travel`);
          assert(cell.flock.bounds.containsPoint(point), 'Current batch bounds include every member');
          point.add(cell.center); assert(point.y > groundHeight(point.x,point.z) + 12);
        }
      });
    }
    for (let slot = 0; slot < 18; slot++) {
      const mean = speeds[slot].reduce((sum, speed) => sum + speed, 0) / speeds[slot].length;
      assert(mean < 4.6, 'Mean route speed is substantially below the former 6.8–7.4 m/s');
      assert(maxSpeeds[slot] - minSpeeds[slot] > .08, 'Each flight has gentle pace variation');
    }
    for (const cell of gulls.flights) {
      // After one nominal circuit, a slowly evolving route should no longer
      // place a bird on the identical point of a rigid oval.
      const member = cell.routes.members[0];
      cell.routes.sample(0, 0, point, forward);
      const start = point.clone();
      cell.routes.sample(0, member.circuitSeconds, point, forward);
      assert(point.distanceTo(start) > .5, `${cell.id} changes position at the next nominal circuit phase`);
      assert(new Set(cell.routes.members.map(member => member.direction)).size > 1, 'Birds can pass in both coastal directions');
      assert(Number.isFinite(member.speed));
    }
  } finally { gulls.dispose(); }
});

test('Ground gulls respond only to a nearby enabled player at ground height, independently of the viewing camera', () => {
  const gulls = createGymGulls({ groundHeight: () => 2, surfaceY: 0 });
  const bird = gulls.grounded[1];
  const isAirborne = () => getGullState(bird.root)?.pose === 'flight';
  try {
    gulls.setViewer(bird.home.x, bird.home.z, true);
    gulls.update(.1); assert(!isAirborne(), 'An overview camera beside a gull does not frighten it');
    gulls.setPlayer(bird.home.x + .2, bird.home.y, bird.home.z, false);
    gulls.update(.1); assert(!isAirborne(), 'Disabled player input cannot trigger a scare');
    gulls.setPlayer(bird.home.x + 3.01, bird.home.y, bird.home.z);
    gulls.update(.1); assert(!isAirborne(), 'A player beyond the 3 m trigger does not disturb a resting bird');
    gulls.setPlayer(bird.home.x + .2, bird.home.y + 1.81, bird.home.z);
    gulls.update(.1); assert(!isAirborne(), 'A player flying above the gull does not create a phantom ground scare');
    gulls.setPlayer(bird.home.x + .2, bird.home.y - 1.81, bird.home.z);
    gulls.update(.1); assert(!isAirborne(), 'A player below the surface does not frighten a ground gull');
    gulls.setPlayer(bird.home.x + 3, bird.home.y, bird.home.z);
    gulls.update(.1); assert(isAirborne(), 'Reaching the 3 m boundary triggers takeoff');
    assert.equal(bird.escape.phase, 'departing');
  } finally { gulls.dispose(); }
});

test('Startled gulls lift continuously away from the player and settle on a new clear patch without changing assets', () => {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const gulls = createGymGulls({ groundHeight: () => 2, surfaceY: 0, canLandAt: () => true });
    const bird = gulls.grounded[1], start = bird.root.position.clone(), oldHome = bird.home.clone();
    const player = start.clone().add(new Vector3(dx * .6, 0, dz * .6));
    const away = start.clone().sub(player).normalize(), previous = start.clone();
    const meshes: Mesh[] = []; bird.root.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
    const geometry = meshes.map(mesh => mesh.geometry), materials = meshes.map(mesh => mesh.material), uuid = bird.root.uuid;
    let greatestHeight = 0, settled = false;
    try {
      gulls.setViewer(start.x, start.z, true); gulls.setPlayer(player.x, player.y, player.z);
      for (let frame = 0; frame < 300; frame++) {
        gulls.update(.1);
        const p = bird.root.position;
        assert(p.distanceTo(previous) < 1, 'Takeoff and landing cannot teleport the model'); previous.copy(p);
        assert(p.y >= 2.015, 'The root never drops through the landing surface');
        greatestHeight = Math.max(greatestHeight, p.y - start.y);
        if (frame === 9) assert(p.clone().sub(start).dot(away) > .3, 'Initial escape creates distance in the direction away from the player');
        if (frame > 10 && bird.escape.phase === 'grounded') { settled = true; break; }
        assert.equal(getGullState(bird.root)?.pose, 'flight', 'Every airborne phase has an actual flight pose');
      }
      assert(settled, 'A clear landing patch allows a finite escape to finish');
      assert(greatestHeight > 1, 'The gull visibly takes flight');
      assert(bird.home.distanceTo(oldHome) > 5, 'It chooses a different resting patch instead of resetting under the player');
      assert(Math.hypot(bird.home.x - player.x, bird.home.z - player.z) >= 2.2, 'Landing leaves the player a clear buffer');
      assert.equal(bird.root.uuid, uuid); assert.deepEqual(meshes.map(mesh => mesh.geometry), geometry); assert.deepEqual(meshes.map(mesh => mesh.material), materials);
      assert.equal(gulls.stats().draws, 9, 'An escape reuses the original rig, without creating an extra draw');
      // Allow the landing to settle, then approach the same persistent bird again.
      gulls.setPlayer(500, 2, 500); for (let frame = 0; frame < 100; frame++) gulls.update(.1);
      gulls.setPlayer(bird.root.position.x + .5, bird.root.position.y, bird.root.position.z); gulls.update(.1);
      assert.equal(bird.escape.phase, 'departing', 'The same gull can respond to later player approaches');
    } finally { gulls.dispose(); }
  }
});

test('Blocked landing sites and a player standing on the target keep an escaping gull safely airborne', () => {
  let allowLanding = false;
  const gulls = createGymGulls({ groundHeight: () => 2, surfaceY: 0, canLandAt: () => allowLanding });
  const bird = gulls.grounded[1], start = bird.root.position.clone(), phase = () => bird.escape.phase;
  try {
    gulls.setViewer(start.x, start.z, true); gulls.setPlayer(start.x + .5, start.y, start.z);
    for (let frame = 0; frame < 160; frame++) {
      gulls.update(.1);
      assert.equal(getGullState(bird.root)?.pose, 'flight', 'An unavailable landing surface never causes a ground reset');
      assert(bird.root.position.y >= 2.015);
    }
    assert.equal(phase(), 'circling');
    allowLanding = true; gulls.setPlayer(500, 2, 500);
    // Wait only until a destination has been selected, then obstruct it before touchdown.
    for (let frame = 0; frame < 300 && phase() === 'circling'; frame++) gulls.update(.1);
    assert.notEqual(phase(), 'circling', 'A new safe patch is eventually considered');
    const target = bird.escape.target.clone(); gulls.setPlayer(target.x, target.y, target.z);
    for (let frame = 0; frame < 120; frame++) {
      gulls.update(.1);
      if (phase() === 'grounded') assert(Math.hypot(bird.root.position.x - target.x, bird.root.position.z - target.z) >= 2.2, 'A gull must not settle on the player occupying its previous target');
    }
    gulls.setPlayer(500, 2, 500);
    for (let frame = 0; frame < 300 && phase() !== 'grounded'; frame++) gulls.update(.1);
    assert.equal(phase(), 'grounded', 'Clearing the landing area allows recovery');
  } finally { gulls.dispose(); }
});

test('Escapes on actual park terrain remain dry, above the floor and clear of scenery when landing', () => {
  const gym = createTestingGym({ whaleSightingRoll: .99 });
  const clearLanding = (x: number, z: number) => !coastalIsWater(x, z) && canStandAt(x, z, gym.bounds, gym.colliders, .7);
  const gulls = createGymGulls({ groundHeight: gym.groundHeight, surfaceY: GYM_WATER_LEVEL, isWater: coastalIsWater, canLandAt: clearLanding });
  try {
    gulls.setViewer(25, -35, true);
    for (const bird of gulls.grounded) {
      const start = bird.root.position.clone();
      gulls.setPlayer(start.x + .5, start.y, start.z); gulls.update(.1);
      assert.notEqual(bird.escape.phase, 'grounded', `${bird.id} responds to the nearby player`);
      for (let frame = 0; frame < 300 && bird.escape.phase !== 'grounded'; frame++) {
        gulls.update(.1);
        const p = bird.root.position;
        assert(p.y >= gym.groundHeight(p.x, p.z) + .005, `${bird.id} clears the real terrain during flight`);
      }
      assert.equal(bird.escape.phase, 'grounded', `${bird.id} finds a usable nearby park patch`);
      assert(clearLanding(bird.root.position.x, bird.root.position.z), `${bird.id} lands outside water and solid scenery`);
      close(bird.root.position.y, gym.groundHeight(bird.root.position.x, bird.root.position.z) + .02);
      gulls.setPlayer(500, 2, 500);
    }
  } finally { gulls.dispose(); gym.dispose(); }
});

test('A relocated walking gull rests when its new stroll lane meets scenery, water or a sharp step', () => {
  for (const hazard of ['scenery', 'water', 'step'] as const) {
    let barrierX = Infinity;
    const floor = (x: number) => hazard === 'step' && x > barrierX ? 2.5 : 2;
    // Preserve the real offshore mask during construction; the local fixture
    // adds a water edge only after the bird has chosen its safe landing patch.
    const water = (x: number, z: number) => coastalIsWater(x, z) || (hazard === 'water' && x > barrierX && Math.abs(z + 39) < 2);
    const gulls = createGymGulls({ groundHeight: floor, surfaceY: 0, isWater: water, canLandAt: x => hazard !== 'scenery' || x <= barrierX });
    const bird = gulls.grounded[0], start = bird.root.position.clone(), phase = () => bird.escape.phase;
    try {
      assert(bird.walkAllowed, 'The authored lawn lane permits the original stroll');
      gulls.setViewer(start.x, start.z, true); gulls.setPlayer(start.x - .5, start.y, start.z); gulls.update(.1);
      assert.equal(phase(), 'departing');
      barrierX = bird.escape.target.x + .7;
      for (let frame = 0; frame < 300 && phase() !== 'grounded'; frame++) gulls.update(.1);
      assert.equal(phase(), 'grounded', `${hazard} leaves the selected touchdown patch usable`);
      assert(!bird.walkAllowed, `${hazard} blocks the new lane beyond that patch`);
      const landed = bird.root.position.clone(); gulls.setPlayer(500, 2, 500);
      for (let frame = 0; frame < 350; frame++) {
        gulls.update(.1);
        assert(bird.root.position.distanceTo(landed) < 1e-8, `${hazard} cannot cause a later stroll into the obstacle`);
        assert.equal(getGullState(bird.root)?.pose, 'standing');
      }
    } finally { gulls.dispose(); }
  }
});

test('An unavailable perch produces a continuous holding-circle entry above the nearby raised terrain', () => {
  const floor = (x: number, z: number) => x > 47 && x < 49 && z > -36.5 ? 9 : 2;
  const gulls = createGymGulls({ groundHeight: floor, surfaceY: 0, canLandAt: () => false });
  const bird = gulls.grounded[1], start = bird.root.position.clone(), phase = () => bird.escape.phase;
  try {
    gulls.setViewer(start.x, start.z, true); gulls.setPlayer(start.x - .5, start.y, start.z);
    for (let frame = 0; frame < 3000 && phase() !== 'circling'; frame++) gulls.update(.01);
    assert.equal(phase(), 'circling');
    const entry = bird.root.position.clone();
    gulls.update(.0001);
    assert(Math.abs(bird.root.position.y - entry.y) < .0001, 'Starting the sine-based holding motion cannot introduce a vertical jump');
    assert(bird.root.position.distanceTo(entry) < .001, 'The first holding-circle step stays proportional to elapsed time');
    let crossedRaisedPatch = false;
    for (let frame = 0; frame < 1300; frame++) {
      gulls.update(.01);
      const p = bird.root.position, height = floor(p.x, p.z);
      if (height === 9) crossedRaisedPatch = true;
      assert(p.y >= height + 1, 'The escape climbs before circling over a nearby raised bank');
      assert.equal(phase(), 'circling', 'No valid perch means no sudden reset to the ground');
    }
    assert(crossedRaisedPatch, 'The terrain check actually covers the raised part of the holding circle');
  } finally { gulls.dispose(); }
});

test('Reduced motion freezes both takeoff triggers and in-flight escape without losing persistent state', () => {
  const gulls = createGymGulls({ groundHeight: () => 2, surfaceY: 0 });
  const bird = gulls.grounded[1], start = bird.root.position.clone();
  try {
    gulls.setViewer(start.x, start.z, true); gulls.setPlayer(start.x + .5, start.y, start.z);
    const resting = transforms(gulls);
    for (let frame = 0; frame < 30; frame++) gulls.update(.1, false);
    assert.deepEqual(transforms(gulls), resting); assert.equal(bird.escape.phase, 'grounded');
    gulls.update(.1); assert.equal(bird.escape.phase, 'departing');
    for (let frame = 0; frame < 5; frame++) gulls.update(.1);
    const flying = transforms(gulls), phase = bird.escape.phase, elapsed = gulls.stats().elapsed;
    for (let frame = 0; frame < 30; frame++) gulls.update(.1, false);
    assert.deepEqual(transforms(gulls), flying); assert.equal(bird.escape.phase, phase); assert.equal(gulls.stats().elapsed, elapsed);
    gulls.setPlayer(500, 2, 500); gulls.update(.1);
    assert(bird.root.position.distanceTo(start) > .1, 'Resuming continues the same escape');
  } finally { gulls.dispose(); }
});

test('Visibility sleeps animation work, reentry restores canonical routes, and reduced motion freezes time', () => {
  const active = makeGulls(), slept = makeGulls();
  try {
    active.setViewer(25, -35, true); slept.setViewer(25, -35, true);
    for (let frame = 0; frame < 21; frame++) { active.update(.1); slept.update(.1); }
    assertSameMotion(active, slept);
    const ids = slept.grounded.map(bird => bird.root.uuid).concat(slept.flights.map(cell => cell.flock.root.uuid));
    slept.setViewer(5000, 5000); assert.equal(slept.stats().activeDraws, 0);
    const dormant = transforms(slept), versions = slept.flights.map(cell => cell.flock.mesh.instanceMatrix.version);
    for (let frame = 0; frame < 109; frame++) { active.update(.1); slept.update(.1); }
    assert.deepEqual(transforms(slept), dormant, 'Sleeping birds do not change bones, GPU clocks or matrices');
    assert.deepEqual(slept.flights.map(cell => cell.flock.mesh.instanceMatrix.version), versions, 'No hidden instance uploads');
    close(slept.stats().elapsed, active.stats().elapsed, 1e-12);
    slept.setViewer(25, -35, true); slept.update(.1); active.update(.1);
    assertSameMotion(active, slept);
    assert.deepEqual(slept.grounded.map(bird => bird.root.uuid).concat(slept.flights.map(cell => cell.flock.root.uuid)), ids);
    const paused = transforms(slept), elapsed = slept.stats().elapsed;
    for (let frame = 0; frame < 30; frame++) slept.update(.1, false);
    for (const invalid of [0, -1, NaN, Infinity]) slept.update(invalid);
    slept.setViewer(NaN, Infinity);
    assert.equal(slept.stats().elapsed, elapsed); assert.deepEqual(transforms(slept), paused);
  } finally { active.dispose(); slept.dispose(); }
});

test('Ground and sky interest bands use hysteresis instead of rebuilding birds at the boundary', () => {
  const gulls = makeGulls();
  const settle = (x: number, z: number) => { gulls.setViewer(x, z); for (let i = 0; i < 3; i++) gulls.update(.1, false); };
  try {
    const bird = gulls.grounded[0], cell = gulls.flights[0];
    settle(bird.home.x + 150, bird.home.z); assert(!bird.active);
    settle(bird.home.x + 100, bird.home.z); assert(!bird.active, 'Entry waits for the tighter band');
    settle(bird.home.x + 80, bird.home.z); assert(bird.active);
    settle(bird.home.x + 100, bird.home.z); assert(bird.active, 'Exit keeps the wider band');
    settle(cell.center.x + 560, cell.center.z); assert(!cell.active);
    settle(cell.center.x + 525, cell.center.z); assert(!cell.active);
    settle(cell.center.x + 490, cell.center.z); assert(cell.active);
    settle(cell.center.x + 525, cell.center.z); assert(cell.active);
    gulls.setViewer(5000, 5000, true); assert.equal(gulls.stats().activeDraws, 9, 'Local overview includes all authored birds');
    assert.equal(gulls.stats().elapsed, 0, 'Interest selection does not advance motion');
  } finally { gulls.dispose(); }
});

test('All park gull LODs meet measured budgets without changing identity, route, physics or instance slots', async () => {
  const gulls = makeGulls(), lod = createLodController(), camera = new PerspectiveCamera(45, 1, .01, 10000);
  try {
    gulls.setViewer(25, -35, true);
    const startled = gulls.grounded[1]; gulls.setPlayer(startled.home.x + .5, startled.home.y, startled.home.z);
    gulls.update(.1); assert.equal(startled.escape.phase, 'departing'); applyNodeStyle(gulls.root);
    await lod.register(gulls.root);
    const costs = lod.stats(gulls.root);
    assert.equal(costs.meshes, 9); assert.equal(costs.bytes, 266844);
    assert.deepEqual(LOD_LEVELS.map(level => costs[level].triangles), [8112, 3360, 624]);
    assert(LOD_LEVELS.every(level => costs[level].draws === GYM_GULLS.budget.drawCalls));
    const original = transforms(gulls), routes = gulls.flights.map(cell => cell.routes);
    const slots = gulls.flights.map(cell => cell.flock.mesh.instanceMatrix);
    const physics = gulls.grounded.map(bird => JSON.stringify(bird.root.userData.physics));
    for (const level of LOD_LEVELS) {
      lod.setMode(level); lod.update(camera, 900, 0, true);
      assert.deepEqual(transforms(gulls), original, `${level} preserves motion state`);
      assert.deepEqual(gulls.grounded.map(bird => JSON.stringify(bird.root.userData.physics)), physics);
      gulls.flights.forEach((cell, index) => { assert.equal(cell.routes, routes[index]); assert.equal(cell.flock.mesh.instanceMatrix, slots[index]); });
      assert.equal(lod.inspect(gulls.root).filter(row => row.level === level).length, 9);
    }
    lod.setMode('auto'); camera.position.set(100, 300, 1500); camera.lookAt(50, 10, 0);
    lod.update(camera, 900, 1, true); assert(lod.inspect(gulls.root).every(row => row.level === 'far'), 'Distant park/sky birds select their cheapest silhouettes');
    const closeBird = gulls.grounded[0]; camera.position.copy(closeBird.root.position).add(new Vector3(0, .6, 1.8)); camera.lookAt(closeBird.root.position.clone().add(new Vector3(0, .3, 0)));
    lod.update(camera, 900, 1, true); assert(lod.inspect(closeBird.root).every(row => row.level === 'near'), 'A nearby bird restores readable geometry');
  } finally { gulls.dispose(); lod.dispose(); }
});

test('Gull world disposal releases every reduced geometry, converted material, instance and skeleton once', async () => {
  const gulls = makeGulls(), lod = createLodController(), camera = new PerspectiveCamera(45, 1, .01, 10000);
  const geometries = new Map<BufferGeometry, number>(), materials = new Map<Material, number>(), instances = new Map<InstancedMesh, number>();
  const skeletons = new Map<SkinnedMesh['skeleton'], number>(), meshes: Mesh[] = [];
  gulls.setViewer(25, -35, true); applyNodeStyle(gulls.root);
  gulls.root.traverse(node => { if (node instanceof Mesh) meshes.push(node); });
  for (const mesh of meshes) {
    for (const geometry of new Set(Object.values(await prepareGeometryLods(mesh.geometry)))) {
      if (geometries.has(geometry)) continue;
      geometries.set(geometry, 0); geometry.addEventListener('dispose', () => geometries.set(geometry, geometries.get(geometry)! + 1));
    }
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (materials.has(material)) continue;
      materials.set(material, 0); material.addEventListener('dispose', () => materials.set(material, materials.get(material)! + 1));
    }
    if (mesh instanceof InstancedMesh) { instances.set(mesh, 0); mesh.addEventListener('dispose', () => instances.set(mesh, instances.get(mesh)! + 1)); }
    if (mesh instanceof SkinnedMesh) {
      const skeleton = mesh.skeleton, original = skeleton.dispose.bind(skeleton); skeletons.set(skeleton, 0);
      skeleton.dispose = () => { skeletons.set(skeleton, skeletons.get(skeleton)! + 1); original(); };
    }
  }
  await lod.register(gulls.root); lod.setMode('far'); lod.update(camera, 900, 0, true);
  const elapsed = gulls.stats().elapsed;
  gulls.dispose(); gulls.dispose(); gulls.update(.1); gulls.setViewer(0, 0, true);
  assert.equal(gulls.root.children.length, 0); assert.equal(gulls.stats().elapsed, elapsed); assert.equal(lod.size, 0);
  assert.equal(instances.size, 3); assert.equal(skeletons.size, 6);
  assert([...geometries.values()].every(count => count === 1), 'Every Near/Mid/Far buffer releases once');
  assert([...materials.values()].every(count => count === 1), 'Every converted material releases once');
  assert([...instances.values()].every(count => count === 1), 'Every flight instance resource releases once');
  assert([...skeletons.values()].every(count => count === 1), 'Every grounded rig releases once');
  lod.dispose();
});
