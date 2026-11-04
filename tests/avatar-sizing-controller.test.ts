import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import { AVATAR_MOVEMENT, AVATAR_SWIMMING, canStandAt, createAvatarController, type AvatarControllerBody, type AvatarControllerOptions, type AvatarControllerState, type GymBounds, type GymCollider } from '../src/viewer/avatarController';

const still = { x: 0, z: 0, run: false };
const wide: GymBounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const land: GymBounds = { ...wide, walkable: [[-20,-20],[0,-20],[0,20],[-20,20]] };
const floor = (x: number) => 1 - .35 * x;
const bodyFor = (height: number, build = 1): AvatarControllerBody => ({
  radius: .28 * height / 1.45 * Math.max(1, build),
  swimDepth: .85 * height / 1.45,
  swimImmersion: .78 * height / 1.45,
});
const small = bodyFor(1.2, .8), large = bodyFor(1.8, 1.25);
const defaults = bodyFor(1.45);
const close = (actual: number, expected: number, epsilon = 1e-8) => assert(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
function fixture(body?: AvatarControllerBody, options: Partial<AvatarControllerOptions> = {}) {
  const root = new Object3D();
  const controller = createAvatarController({ root, spawn: new Vector3(-2, 0, 0), bounds: wide, colliders: [], body, ...options });
  return { root, controller };
}
function shore(body?: AvatarControllerBody, options: Partial<AvatarControllerOptions> = {}) {
  return fixture(body, { spawn: new Vector3(-2, floor(-2), 0), bounds: land, groundHeight: floor,
    water: { bounds: wide, surfaceHeight: x => x > 0 ? 1 : undefined }, ...options });
}
function advance(controller: ReturnType<typeof createAvatarController>, seconds: number, input = still) {
  let result = controller.update(0, input);
  for (let i = 0; i < Math.round(seconds * 60); i++) result = controller.update(1 / 60, input);
  return result;
}
function restore(controller: ReturnType<typeof createAvatarController>, position: [number, number, number], patch: Partial<AvatarControllerState> = {}) {
  return controller.restoreState({ ...controller.getState(), position, velocity: [0,0], ...patch });
}

test('body radius determines passage clearance without changing the visible root scale', () => {
  const colliders: GymCollider[] = [
    { kind: 'box', minX: 0, maxX: 1, minZ: .3, maxZ: 4 },
    { kind: 'box', minX: 0, maxX: 1, minZ: -4, maxZ: -.3 },
  ];
  const narrow = fixture(small, { colliders }), broad = fixture(large, { colliders });
  advance(narrow.controller, 2, { x: 1, z: 0, run: true });
  advance(broad.controller, 2, { x: 1, z: 0, run: true });
  assert(narrow.root.position.x > 1); assert(broad.root.position.x < 0);
  assert(canStandAt(broad.root.position.x, broad.root.position.z, wide, colliders, large.radius));
  assert.deepEqual(narrow.root.scale.toArray(), [1,1,1]); assert.deepEqual(broad.root.scale.toArray(), [1,1,1]);
});

test('each body retains its radius against thin boxes and round solids', () => {
  for (const body of [small, defaults, large]) for (const collider of [
    { kind: 'box' as const, minX: 1, maxX: 1.02, minZ: -4, maxZ: 4 },
    { kind: 'circle' as const, x: 1.5, z: 0, radius: .5 },
  ]) {
    const { root, controller } = fixture(body, { colliders: [collider] });
    advance(controller, 3, { x: 1, z: 0, run: true });
    assert(root.position.x <= 1 - body.radius); assert(root.position.x > 1 - body.radius - .1);
    assert(canStandAt(root.position.x, root.position.z, wide, [collider], body.radius));
  }
});

test('land polygon and outer ocean boundaries both retain body-specific clearance', () => {
  const polygon: GymBounds = { ...wide, walkable: [[-4,-4],[4,-4],[4,4],[-4,4]] };
  for (const body of [small, large]) {
    const dry = fixture(body, { bounds: polygon });
    advance(dry.controller, 4, { x: -1, z: -1, run: true });
    assert(dry.root.position.x >= -4 + body.radius); assert(dry.root.position.z >= -4 + body.radius);
    const wet = shore(body); assert(restore(wet.controller, [19,0,0]));
    advance(wet.controller, 2, { x: 1, z: 0, run: true });
    assert(wet.root.position.x <= 20 - body.radius); assert(wet.root.position.x > 20 - body.radius - .1);
  }
});

test('each height enters swimming at its own floor-depth threshold and immersion', () => {
  for (const body of [small, defaults, large]) {
    const { root, controller } = shore(body), thresholdX = body.swimDepth / .35;
    assert(restore(controller, [thresholdX - .01, 99, 0]));
    assert(controller.getState().wading); assert(!controller.getState().swimming); close(root.position.y, floor(thresholdX - .01));
    assert(restore(controller, [thresholdX + .01, 99, 0]));
    assert(controller.getState().swimming); assert(!controller.getState().wading); close(root.position.y, 1 - body.swimImmersion);
  }
});

test('small and tall bodies cross the continuous beach seam without bypassing its slope limit', () => {
  for (const body of [small, large]) {
    const { controller } = shore(body); let waded = false, swam = false;
    for (let i = 0; i < 360; i++) { const state = controller.update(1 / 60, { x: 1, z: 0, run: true }); waded ||= state.wading; swam ||= state.swimming; }
    assert(waded && swam); assert(controller.getState().safePosition[0] <= -body.radius);
    const cliff = shore(body, { groundHeight: x => x <= 0 ? 3 : -5 });
    advance(cliff.controller, 4, { x: 1, z: 0, run: true }); assert(cliff.root.position.x < 0); assert(!cliff.controller.getState().swimming);
  }
});

test('body size does not alter walk, run, swim speed or breath capacity and drain', () => {
  for (const body of [small, defaults, large]) {
    for (const run of [false, true]) {
      const dry = fixture(body), walking = advance(dry.controller, 2, { x: 1, z: 1, run });
      close(walking.speed, run ? AVATAR_MOVEMENT.run : AVATAR_MOVEMENT.walk, 1e-7);
      const wet = shore(body); assert(restore(wet.controller, [4,0,0]));
      const swimming = advance(wet.controller, 2, { x: 1, z: 1, run });
      close(swimming.speed, AVATAR_SWIMMING.speed, 1e-7); close(swimming.breath, 20); assert.equal(wet.controller.getState().exhausted, false);
    }
  }
});

test('recreating a controller for a new height preserves breath and recomputes water mode', () => {
  const before = shore(small); assert(restore(before.controller, [2.4,0,0])); advance(before.controller, 3);
  const saved = before.controller.getState(); assert(saved.swimming); close(saved.breath, 20);
  const after = shore(large, { state: saved });
  assert(after.controller.getState().wading); assert(!after.controller.getState().swimming);
  close(after.root.position.y, floor(2.4)); close(after.controller.getState().breath, 20);
  assert.deepEqual(after.controller.getState().safePosition, saved.safePosition);
  const smallerAgain = shore(small, { state: after.controller.getState() });
  assert(smallerAgain.controller.getState().swimming); close(smallerAgain.root.position.y, 1 - small.swimImmersion); close(smallerAgain.controller.getState().breath, 20);
});

test('growing inside insufficient clearance falls back to spawn with full breath', () => {
  const colliders: GymCollider[] = [{ kind: 'circle', x: 0, z: 0, radius: .5 }];
  const before = fixture(small, { colliders });
  assert(restore(before.controller, [-.8,0,0], { breath: 3, exhausted: true, safePosition: [-.8,0,0] }));
  const saved = before.controller.getState(), after = fixture(large, { colliders, state: saved });
  assert.deepEqual(after.root.position.toArray(), [-2,0,0]); assert.deepEqual(after.controller.getState().safePosition, [-2,0,0]);
  assert.equal(after.controller.getState().breath, 20); assert(!after.controller.getState().exhausted);
  assert(!after.controller.restoreState(saved)); assert.equal(after.controller.getState().breath, 20);
});

test('an enlarged swimmer rejects an obstructed saved shore point and rescues an exhausted diver with full breath', () => {
  const colliders: GymCollider[] = [{ kind: 'circle', x: 0, z: 0, radius: .5 }];
  const before = shore(small, { colliders });
  assert(restore(before.controller, [-.8,floor(-.8),0]));
  assert(restore(before.controller, [10,0,0], { breath: .05, diveDepth: 1 }));
  const after = shore(large, { colliders, state: before.controller.getState() });
  close(after.controller.getState().breath, .05); assert(after.controller.getState().swimming);
  assert.deepEqual(after.controller.getState().safePosition, [-2,floor(-2),0]);
  const result = after.controller.update(.1, still);
  assert(result.rescued); assert(!result.exhausted); assert.equal(result.breath, 20);
  assert.deepEqual(after.root.position.toArray(), [-2,floor(-2),0]);
  assert(restore(after.controller, [4,0,0])); assert.equal(after.controller.getState().breath, 20);
});

test('controller captures body dimensions rather than observing later object mutations', () => {
  const body = { ...small }, { root, controller } = shore(body);
  body.radius = 5; body.swimDepth = 99; body.swimImmersion = 99;
  assert(restore(controller, [4,0,0])); assert(controller.getState().swimming); close(root.position.y, 1 - small.swimImmersion);
  assert(restore(controller, [19.7,0,0]));
});

test('nonfinite and nonpositive body fields individually fall back to legacy dimensions', () => {
  for (const invalid of [NaN, Infinity, -Infinity, 0, -1]) {
    const fallback = shore({ radius: invalid, swimDepth: invalid, swimImmersion: invalid });
    assert(restore(fallback.controller, [2.4,0,0])); assert(fallback.controller.getState().wading);
    assert(restore(fallback.controller, [2.5,0,0])); assert(fallback.controller.getState().swimming); close(fallback.root.position.y, 1 - AVATAR_SWIMMING.immersion);
    assert(!restore(fallback.controller, [19.8,0,0]));
  }
  const mixed = shore({ radius: small.radius, swimDepth: NaN, swimImmersion: small.swimImmersion });
  assert(restore(mixed.controller, [19.75,0,0])); close(mixed.root.position.y, 1 - small.swimImmersion);
  assert(restore(mixed.controller, [2.4,0,0])); assert(mixed.controller.getState().wading);
});

test('omitting body config exactly matches explicit legacy dimensions', () => {
  const omitted = shore(), explicit = shore(defaults);
  for (let i = 0; i < 300; i++) {
    const input = { x: 1, z: i > 150 ? .25 : 0, run: i < 220 };
    assert.deepEqual(omitted.controller.update(1 / 60, input), explicit.controller.update(1 / 60, input));
    assert.deepEqual(omitted.controller.getState(), explicit.controller.getState());
  }
});
