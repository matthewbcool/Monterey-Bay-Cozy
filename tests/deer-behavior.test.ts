import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDeerHerd, DEER_BEHAVIOR, type DeerBehaviorWorld, type DeerHerdOptions } from '../src/viewer/testingGym/deerBehavior';
import { canStandAt, type GymCollider } from '../src/viewer/avatarController';

const bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
const flat: DeerBehaviorWorld = { heightAt: () => 0, canStandAt: () => true };
const inputs: DeerHerdOptions['members'] = [
  { id: 'mother', age: 'adult', x: 0, z: 0, yaw: 0 },
  { id: 'fawn', age: 'fawn', x: 1, z: 2, yaw: 0 },
];
const make = (extra: Partial<DeerHerdOptions> = {}) => createDeerHerd({ seed: 261027, members: inputs, bounds, world: flat, ...extra });
const snapshot = (herd: ReturnType<typeof make>) => JSON.stringify({ members: herd.members, phase: herd.phase, elapsed: herd.elapsed, steps: herd.steps, alerts: herd.alerts });
const separation = (herd: ReturnType<typeof make>) => Math.hypot(herd.members[0].x - herd.members[1].x, herd.members[0].z - herd.members[1].z);

test('seeded herds alternate rest, grazing and walking deterministically across frame partitions', () => {
  const a = make(), b = make(), different = make({ seed: 8844 });
  const refs = a.members.map(m => ({ member: m, velocity: m.velocity }));
  const poses = new Set<string>();
  for (let frame = 0; frame < 1800; frame++) {
    a.update(1 / 30); b.update(1 / 60); b.update(1 / 60); different.update(1 / 30);
    for (const member of a.members) {
      poses.add(member.pose);
      assert(Number.isFinite(member.x + member.y + member.z + member.yaw + member.speed));
      assert(member.gaitBlend >= 0 && member.gaitBlend <= 1);
      assert.equal(member.gaitBlend, 0, 'ambient walking never requests galloping footfall');
      assert(member.speed < 1.1, 'ambient motion remains a walk');
    }
    assert(separation(a) <= DEER_BEHAVIOR.maxSeparationMeters + 1e-8);
  }
  assert.deepEqual(poses, new Set(['idle', 'eat', 'walk']));
  assert.equal(snapshot(a), snapshot(b), 'the fixed simulation step removes render-frame partition drift');
  assert.notEqual(snapshot(a), snapshot(different), 'seeds vary ambient timing and directions');
  refs.forEach((ref, i) => { assert.equal(a.members[i], ref.member); assert.equal(a.members[i].velocity, ref.velocity); });
});

test('a player approach startles the whole family and increases each animal’s real distance', () => {
  const herd = make(), player = { x: 0, y: 0, z: -4 };
  const start = herd.members.map(m => Math.hypot(m.x - player.x, m.z - player.z));
  const farthest = [...start], galloped = new Set<string>();
  herd.setPlayer(player.x, player.y, player.z);
  for (let frame = 0; frame < 150; frame++) {
    const previous = herd.members.map(m => Math.hypot(m.x - player.x, m.z - player.z));
    herd.update(1 / 30);
    for (const [i, member] of herd.members.entries()) {
      const distance = Math.hypot(member.x - player.x, member.z - player.z);
      assert(distance + 1e-8 >= previous[i], 'fleeing never takes a first step toward the player');
      farthest[i] = Math.max(farthest[i], distance);
      if (member.pose === 'gallop') galloped.add(member.id);
      if (member.speed > .01) {
        const length = Math.hypot(member.velocity.x, member.velocity.z);
        assert(Math.abs(length - member.speed) < 1e-8);
        assert((-Math.sin(member.yaw) * member.velocity.x - Math.cos(member.yaw) * member.velocity.z) / length > .9999, 'model forward agrees with actual travel');
      }
    }
    assert(separation(herd) <= DEER_BEHAVIOR.maxSeparationMeters + 1e-8);
  }
  assert.equal(herd.alerts, 1);
  assert.deepEqual(galloped, new Set(['mother', 'fawn']));
  farthest.forEach((distance, i) => assert(distance > start[i] + 5, `${inputs[i].id} actually retreats rather than running in place`));

  const childFirst = make({ members: [...inputs].reverse() });
  childFirst.setPlayer(1, 0, 5);
  for (let i = 0; i < 90; i++) childFirst.update(1 / 30);
  assert.equal(childFirst.phase, 'fleeing');
  assert(childFirst.members.every(m => m.z < 2), 'a fawn alarm also moves the adult, independent of member order');
});

test('swept radius checks prevent crossing a thin fence, building, water or a steep bank while chased', () => {
  const localBounds = { minX: -15, maxX: 15, minZ: -15, maxZ: 15 };
  const colliders: GymCollider[] = [
    { kind: 'box', minX: 0, maxX: .025, minZ: -15, maxZ: 15 },
    { kind: 'box', minX: -6, maxX: -2, minZ: 7, maxZ: 11 },
  ];
  const heightAt = (x: number, z: number) => z < -8 ? 4 : x * .08;
  const world: DeerBehaviorWorld = {
    heightAt, canStandAt: (x, z, radius) => canStandAt(x, z, localBounds, colliders, radius),
    isWater: (_x, z) => z > 12,
  };
  const herd = make({ bounds: localBounds, world, members: inputs.map((m, i) => ({ ...m, x: -4 - i, z: i * 2, yaw: -Math.PI / 2 })) });
  let moved = 0;
  for (let frame = 0; frame < 900; frame++) {
    const leader = herd.members[0];
    herd.setPlayer(leader.x - 3, leader.y, leader.z - Math.sin(frame / 80) * 3);
    const previous = herd.members.map(m => [m.x, m.y, m.z]);
    herd.update(frame % 23 === 0 ? 2 : 1 / 30);
    for (const [i, m] of herd.members.entries()) {
      const before = previous[i], distance = Math.hypot(m.x - before[0], m.z - before[2]); moved += distance;
      assert(distance <= 4 * DEER_BEHAVIOR.maxFrameSeconds + 1e-8, 'large input frames never teleport');
      assert(m.x < -m.radius, 'never tunnels through the 2.5 cm fence');
      assert(m.z + m.radius < 12, 'whole ground footprint stays out of water');
      assert(m.z - m.radius > -8, 'does not climb the four-metre bank');
      assert(Math.abs(m.y - heightAt(m.x, m.z)) < 1e-9);
      for (let n = 0; n <= 12; n++) {
        const t = n / 12, x = before[0] + (m.x - before[0]) * t, z = before[2] + (m.z - before[2]) * t;
        assert(world.canStandAt(x, z, m.radius), 'every swept point remains clear, not just its destination');
        assert(!world.isWater!(x, z));
      }
    }
    assert(separation(herd) <= DEER_BEHAVIOR.maxSeparationMeters + 1e-8, 'adult waits for the baby near obstacles');
  }
  assert(moved > 3, 'the fixture exercises actual escaping movement');
});

test('a trapped deer stays put with stable alarm state instead of crossing walls or jittering between poses', () => {
  const herd = make({ members: [{ id: 'boxed', age: 'adult', x: 0, z: 0, yaw: 0, radius: .3 }],
    world: { heightAt: () => 0, canStandAt: (x, z) => Math.abs(x) < .03 && Math.abs(z) < .03 } });
  const member = herd.members[0];
  for (let frame = 0; frame < 600; frame++) {
    herd.setPlayer(0, 0, frame % 2 ? -5.9 : -6.1);
    herd.update(1 / 30);
    assert.equal(member.x, 0); assert.equal(member.z, 0); assert.equal(member.speed, 0);
    assert.equal(member.pose, 'idle');
  }
  assert.equal(herd.alerts, 1, '6m trigger chatter does not repeatedly restart the escape');
  assert.equal(herd.phase, 'fleeing', 'release requires a wider distance and a sustained calm interval');
  herd.setPlayer(0, 0, -20);
  for (let i = 0; i < 80; i++) herd.update(1 / 30);
  assert.equal(herd.phase, 'fleeing');
  for (let i = 0; i < 20; i++) herd.update(1 / 30);
  assert.equal(herd.phase, 'resting');
  const aerial = make(); aerial.setPlayer(0, 25, 0);
  aerial.update(.1); assert.equal(aerial.alerts, 0, 'an overhead flight is not a grounded chase');
});

test('sleep does no world or animation work, reduced motion preserves avoidance, and waking does not catch up', () => {
  let probes = 0;
  const herd = make({ world: { heightAt: () => { probes++; return 0; }, canStandAt: () => { probes++; return true; } } });
  herd.setActive(false); const sleeping = snapshot(herd), calls = probes;
  herd.setPlayer(0, 0, -4);
  for (let i = 0; i < 100; i++) assert.equal(herd.update(10), false);
  assert.equal(probes, calls); assert.equal(snapshot(herd), sleeping);
  herd.setPlayer(0, 0, 0, false); herd.setActive(true);
  for (let i = 0; i < 100; i++) assert.equal(herd.update(.1, false), false);
  assert.equal(probes, calls); assert.equal(snapshot(herd), sleeping);
  herd.setPlayer(0, 0, -4);
  for (let i = 0; i < 120; i++) herd.update(1 / 30, false);
  assert.equal(herd.alerts, 1); assert(herd.members[0].z > 4, 'reduced motion still reacts to the nearby player');
  const before = herd.members.map(m => [m.x, m.z]), time = herd.elapsed;
  herd.setActive(false); herd.update(1000); herd.setActive(true); herd.update(1000);
  assert(Math.abs(herd.elapsed - time - .1) < 1e-8);
  herd.members.forEach((m, i) => assert(Math.hypot(m.x - before[i][0], m.z - before[i][1]) <= .4 + 1e-8));
  const unchanged = snapshot(herd);
  for (const dt of [0, -1, NaN, Infinity]) assert.equal(herd.update(dt), false);
  assert.equal(snapshot(herd), unchanged);
});

test('unsafe placements are rejected instead of silently snapping wildlife through scenery', () => {
  const physicalBounds = { ...bounds, walkable: [[-40, -40], [40, -40], [40, 40], [-40, 40]] };
  assert.doesNotThrow(() => make({ bounds: physicalBounds }), 'accepts a shared world bounds object with additional polygon metadata');
  assert.throws(() => make({ members: [] }), /1–16/);
  assert.throws(() => make({ members: [{ ...inputs[0], x: 200 }] }), /Unsafe deer spawn/);
  assert.throws(() => make({ members: [inputs[0], { ...inputs[1], x: 20 }] }), /spawn together/);
  assert.throws(() => make({ world: { ...flat, isWater: () => true } }), /Unsafe deer spawn/);
  assert.throws(() => make({ world: { ...flat, heightAt: () => NaN } }), /Unsafe deer spawn/);
  assert.throws(() => make({ members: [inputs[0], inputs[0]] }), /unique/);
  assert.throws(() => make({ members: [inputs[0], { ...inputs[1], x: 0, z: .1 }] }), /overlap/);
});

test('the Caledonia-sized family never overlaps while wandering or escaping in a tight habitat', () => {
  const radius = 5.5;
  const herd = make({ seed: 891, bounds: { minX: -radius, maxX: radius, minZ: -radius, maxZ: radius },
    members: [{ id: 'adult', age: 'adult', x: 0, z: 0, yaw: -.65, radius: .92 }, { id: 'fawn', age: 'fawn', x: 0, z: 2.1, yaw: -.65, radius: .58 }],
    world: { heightAt: () => 0, canStandAt: (x, z, r) => Math.hypot(x, z) + r <= radius } });
  let minimum = Infinity, travelled = 0;
  for (let i = 0; i < 3600; i++) {
    const [adult, fawn] = herd.members;
    if (i === 1800) herd.setPlayer(-3, 0, 0);
    if (i === 2400) herd.setPlayer(0, 0, 0, false);
    const x = adult.x, z = adult.z;
    herd.update(1 / 30);
    minimum = Math.min(minimum, Math.hypot(adult.x - fawn.x, adult.z - fawn.z));
    travelled += Math.hypot(adult.x - x, adult.z - z);
    assert(minimum >= adult.radius + fawn.radius - 1e-8, 'the baby never enters the adult body clearance');
    assert(separation(herd) <= DEER_BEHAVIOR.maxSeparationMeters + 1e-8);
  }
  assert(travelled > 4, 'pair separation still permits actual travel in a small grass patch');
});
