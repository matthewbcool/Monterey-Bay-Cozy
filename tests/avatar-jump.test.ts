import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import { AVATAR_JUMP, createAvatarController, type AvatarInput, type GymBounds } from '../src/viewer/avatarController';
import { createAvatarModel } from '../src/models/avatar';
import { JOINT } from '../src/models/avatar/geometry';

const bounds: GymBounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
const still: AvatarInput = { x: 0, z: 0, run: false };
const step = 1 / 60;
function flat(y = 0) { return () => y; }
function ledge(height: number) { return (x: number) => x >= 1 ? height : 0; }

test('a held jump rises to the authored height once, lands on the same ground and reports the impact', () => {
  const root = new Object3D(), controller = createAvatarController({ root, spawn: new Vector3(), bounds, colliders: [], groundHeight: flat() });
  let state = controller.update(step, { ...still, jump: true }), apex = 0, landings = 0, jumps = Number(state.jumped), landingSpeed = 0;
  assert(state.airborne && !state.grounded && state.verticalVelocity > 0);
  for (let i = 0; i < 120; i++) {
    state = controller.update(step, { ...still, jump: true });
    apex = Math.max(apex, root.position.y); jumps += Number(state.jumped);
    if (state.landed) { landings++; landingSpeed = state.landingSpeed; }
  }
  assert(Math.abs(apex - AVATAR_JUMP.height) < .05, `apex ${apex}`);
  assert.equal(jumps, 1, 'holding the button must not bunny-hop'); assert.equal(landings, 1);
  assert(landingSpeed > 2, 'landing speed drives the landing pose'); assert.equal(root.position.y, 0); assert(state.grounded);
  // Releasing and pressing again is a new jump.
  controller.update(step, still); state = controller.update(step, { ...still, jump: true }); assert(state.jumped);
});

test('releasing early cuts the rise for a short hop, and a press just before landing is buffered', () => {
  const root = new Object3D(), controller = createAvatarController({ root, spawn: new Vector3(), bounds, colliders: [], groundHeight: flat() });
  controller.update(step, { ...still, jump: true });
  let apex = 0, state = controller.update(step, still);
  for (let i = 0; i < 60 && !state.landed; i++) { state = controller.update(step, still); apex = Math.max(apex, root.position.y); }
  assert(apex < AVATAR_JUMP.height * .6 && apex > .05, `tap apex ${apex}`);
  // Jump again and press a second time while still falling, before touchdown.
  controller.update(step, { ...still, jump: true }); controller.update(step, still);
  let rebounded = false;
  for (let i = 0; i < 90; i++) {
    const falling = root.position.y > 0 && root.position.y < .08 && controller.getState().verticalVelocity! < 0;
    state = controller.update(step, { ...still, jump: falling });
    if (falling) { for (let k = 0; k < 4; k++) { state = controller.update(step, { ...still, jump: true }); if (state.jumped) rebounded = true; } break; }
  }
  assert(rebounded, 'a press within the buffer window fires on landing');
});

test('a jump clears a low ledge that walking cannot, but never a tall wall or a cliff drop', () => {
  const walk = (height: number, jump: boolean) => {
    const root = new Object3D(), controller = createAvatarController({ root, spawn: new Vector3(0, 0, 0), bounds, colliders: [], groundHeight: ledge(height) });
    // Run up, then hold jump from just before the edge, as a player would.
    for (let i = 0; i < 90; i++) controller.update(step, { x: 1, z: 0, run: true, jump: jump && root.position.x > .45 });
    for (let i = 0; i < 30; i++) controller.update(step, still);
    return root.position;
  };
  assert(walk(.5, false).x < 1, 'walking cannot step up half a metre');
  const hopped = walk(.5, true); assert(hopped.x > 1.5 && Math.abs(hopped.y - .5) < 1e-6, 'a jump lands on top of the ledge');
  assert(walk(1.2, true).x < 1, 'a 1.2 m wall is higher than the jump');
  // Jumping toward a 3 m drop stops at the edge exactly like walking does.
  const root = new Object3D(), controller = createAvatarController({ root, spawn: new Vector3(-1, 3, 0), bounds, colliders: [], groundHeight: x => x >= 1 ? 0 : 3 });
  for (let i = 0; i < 120; i++) controller.update(step, { x: 1, z: 0, run: true, jump: i % 40 < 20 });
  for (let i = 0; i < 40; i++) controller.update(step, still);
  assert(root.position.x < 1 && root.position.y === 3);
});

test('swimmers cannot jump; airborne bodies are not classified as swimming until they land', () => {
  const root = new Object3D();
  const water = { surfaceHeight: (x: number) => x > 2 ? 0 : undefined, bounds };
  const controller = createAvatarController({ root, spawn: new Vector3(4, -1.2, 0), bounds, colliders: [], groundHeight: x => x > 2 ? -3 : 0, water });
  let state = controller.update(step, still); assert(state.swimming);
  state = controller.update(step, { ...still, jump: true }); assert(!state.jumped && state.grounded && state.swimming);
});

test('controller state round-trips mid-air and identical input streams stay identical (replay / netcode)', () => {
  const make = () => { const root = new Object3D(); return { root, controller: createAvatarController({ root, spawn: new Vector3(), bounds, colliders: [], groundHeight: flat() }) }; };
  const a = make(), b = make();
  const inputs: AvatarInput[] = Array.from({ length: 140 }, (_, i) => ({ x: Math.sin(i * .1), z: Math.cos(i * .07), run: i > 50, jump: i % 37 < 9 }));
  for (const input of inputs) { a.controller.update(step, input); b.controller.update(step, input); }
  assert.deepEqual(a.root.position.toArray(), b.root.position.toArray());
  // Pause mid-hop, move the state to a fresh controller, and finish the jump there.
  a.controller.update(step, { ...still, jump: false }); a.controller.update(step, { ...still, jump: true });
  for (let i = 0; i < 6; i++) a.controller.update(step, { ...still, jump: true });
  const saved = JSON.parse(JSON.stringify(a.controller.getState()));
  assert.equal(saved.grounded, false); assert(saved.position[1] > 0);
  const c = make(); assert(c.controller.restoreState(saved));
  assert(c.root.position.y > 0 && c.controller.getState().grounded === false);
  let landed = false; for (let i = 0; i < 90 && !landed; i++) landed = c.controller.update(step, { ...still, jump: true }).landed;
  assert(landed && c.root.position.y === 0);
  // Older snapshots without vertical fields restore grounded.
  const legacy = { ...saved }; delete legacy.grounded; delete legacy.verticalVelocity;
  const d = make(); d.controller.restoreState(legacy); assert.equal(d.root.position.y, 0); assert(d.controller.getState().grounded);
});

test('the rig poses a hop and a landing with bones only; no geometry or draw changes', () => {
  const avatar = createAvatarModel(), geometry = avatar.mesh.geometry, position = geometry.getAttribute('position').array.slice();
  for (let i = 0; i < 20; i++) avatar.update(step, {});
  const idleKnee = avatar.bones[JOINT.leftKnee].rotation.x, idleHips = avatar.bones[JOINT.hips].position.y;
  for (let i = 0; i < 20; i++) avatar.update(step, { airborne: true, verticalVelocity: 2 });
  assert(avatar.getState().airborne > .95); assert(avatar.bones[JOINT.leftKnee].rotation.x > idleKnee + .5, 'knees tuck in the air');
  avatar.update(step, { airborne: false, landing: 4.5 }); for (let i = 0; i < 5; i++) avatar.update(step, {});
  assert(avatar.getState().landing && avatar.bones[JOINT.hips].position.y < idleHips - .02, 'landing bends the knees');
  for (let i = 0; i < 40; i++) avatar.update(step, {});
  assert(!avatar.getState().landing && Math.abs(avatar.bones[JOINT.hips].position.y - idleHips) < .02);
  assert.equal(avatar.mesh.geometry, geometry); assert.deepEqual(geometry.getAttribute('position').array, position);
  assert.deepEqual(avatar.root.position.toArray(), [0, 0, 0], 'the rig never moves its placement root');
  // Swimming suppresses the hop pose.
  for (let i = 0; i < 30; i++) avatar.update(step, { swimming: true, airborne: true });
  assert(avatar.getState().airborne < .05);
  avatar.dispose();
});
