import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Object3D, Vector3 } from 'three';
import { AVATAR_DIVE, AVATAR_SWIMMING, createAvatarController, type AvatarInput, type GymBounds } from '../src/viewer/avatarController';
import { createGamepadReader, PAD } from '../src/viewer/gamepad';
import { SEAFLOOR } from '../src/viewer/testingGym/seafloor';
import { surveyedHeight } from '../src/viewer/testingGym/bathymetry';
import { createTestingGym } from '../src/viewer/testingGym';

const bounds: GymBounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
const step = 1 / 60, still: AvatarInput = { x: 0, z: 0, run: false };
// Beach for x < 2, then a seabed sloping to 4 m below a surface at y = 0.
const bed = (x: number) => x < 2 ? .2 : Math.max(-4, -(x - 2) * .5);
const water = { surfaceHeight: (x: number) => x >= 2 ? 0 : undefined, bounds };
function diver(x = 10) {
  const root = new Object3D();
  return { root, controller: createAvatarController({ root, spawn: new Vector3(x, 0, 0), bounds, colliders: [], groundHeight: bed, water }) };
}

test('holding dive descends, releasing floats back up, and jump swims up faster', () => {
  const { root, controller } = diver();
  let state = controller.update(step, still); assert(state.swimming && state.diveDepth === 0);
  const surfaceY = root.position.y;
  for (let i = 0; i < 90; i++) state = controller.update(step, { ...still, dive: true });
  assert(state.diving && state.submerged && state.diveDepth > 1, `depth ${state.diveDepth}`);
  assert(Math.abs(root.position.y - (surfaceY - state.diveDepth)) < 1e-9, 'the root sinks by the dive depth');
  assert(state.verticalVelocity < 0, 'descent is reported for the dive pose');
  // From the same depth, holding jump rises further than letting buoyancy work.
  const twin = diver(); twin.controller.update(step, still);
  for (let i = 0; i < 90; i++) twin.controller.update(step, { ...still, dive: true });
  for (let i = 0; i < 45; i++) { state = controller.update(step, still); twin.controller.update(step, { ...still, jump: true }); }
  assert(twin.controller.getState().diveDepth! < state.diveDepth, 'swimming up beats passive buoyancy');
  for (let i = 0; i < 240; i++) state = controller.update(step, still);
  assert.equal(state.diveDepth, 0); assert(!state.diving && Math.abs(root.position.y - surfaceY) < 1e-9);
});

test('a dive stops above the seabed and a rising seabed pushes the diver up', () => {
  const { root, controller } = diver(12);
  let state = controller.update(step, still);
  // Five seconds of held dive reaches the floor here without exhausting breath (rescue is tested elsewhere).
  for (let i = 0; i < 300; i++) state = controller.update(step, { ...still, dive: true });
  const floorY = bed(root.position.x) + 0;
  assert(root.position.y >= floorY + AVATAR_DIVE.seabedClearance - 1e-9, 'never below the seabed clearance');
  assert(Math.abs(root.position.y - floorY - AVATAR_DIVE.seabedClearance) < .01, 'reaches the floor when held');
  // Swim toward the beach while staying down: depth shrinks with the water.
  for (let i = 0; i < 1200 && state.swimming; i++) state = controller.update(step, { x: -1, z: 0, run: false, dive: true });
  assert(!state.swimming && state.diveDepth === 0, 'shallows end the dive');
});

test('only submerged swimming drains breath', () => {
  const surface = diver(), under = diver();
  surface.controller.update(step, still); under.controller.update(step, still);
  for (let i = 0; i < 60; i++) under.controller.update(step, { ...still, dive: true });
  const start = [surface.controller.getState().breath, under.controller.getState().breath];
  for (let i = 0; i < 120; i++) { surface.controller.update(step, still); under.controller.update(step, { ...still, dive: true }); }
  const used = [start[0] - surface.controller.getState().breath, start[1] - under.controller.getState().breath];
  assert(used[0] === 0, `surface used ${used[0]}`);
  assert(Math.abs(used[1] - 2 * AVATAR_DIVE.underwaterDrain) < .05, `submerged used ${used[1]}`);
  assert(AVATAR_SWIMMING.breathSeconds === 20);
});

test('dive depth survives a snapshot round trip; older snapshots resume at the surface', () => {
  const a = diver(); a.controller.update(step, still);
  for (let i = 0; i < 70; i++) a.controller.update(step, { ...still, dive: true });
  const saved = JSON.parse(JSON.stringify(a.controller.getState()));
  assert(saved.diveDepth > .5);
  const b = diver(); assert(b.controller.restoreState(saved));
  assert(Math.abs(b.controller.getState().diveDepth! - saved.diveDepth) < 1e-9 && Math.abs(b.root.position.y - a.root.position.y) < 1e-9);
  const legacy = { ...saved }; delete legacy.diveDepth;
  const c = diver(); c.controller.restoreState(legacy); assert.equal(c.controller.getState().diveDepth, 0);
});

test('gamepad reader: radial dead zone, press edges and clear() silencing held buttons', () => {
  const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
  const pad = { connected: true, mapping: 'standard', axes: [.1, .1, 0, -1], buttons };
  Object.defineProperty(globalThis, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true });
  const reader = createGamepadReader();
  let s = reader.poll(); assert.equal(s.moveX, 0); assert.equal(s.moveY, 0); assert(s.lookY < -.99);
  pad.axes[0] = 1; pad.axes[1] = 0; s = reader.poll(); assert(Math.abs(s.moveX - 1) < 1e-9);
  buttons[PAD.a].pressed = true; reader.poll(); assert(reader.pressed(PAD.a) && reader.held(PAD.a));
  reader.poll(); assert(!reader.pressed(PAD.a) && reader.held(PAD.a));
  reader.clear(); reader.poll(); assert(!reader.held(PAD.a) && !reader.pressed(PAD.a), 'cleared button stays silent while held');
  buttons[PAD.a].pressed = false; reader.poll(); buttons[PAD.a].pressed = true; reader.poll(); assert(reader.pressed(PAD.a), 'a fresh press works again');
  pad.mapping = ''; s = reader.poll(); assert(!s.connected && !reader.held(PAD.a), 'non-standard pads are ignored');
});

test('the gym seabed matches the swim floor and stays inside separate scene ceilings', () => {
  const gym = createTestingGym();
  try {
    let draws = 0, triangles = 0;
    gym.root.traverse((object: any) => { if (object.isMesh) { draws++; triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1); } });
    assert(draws <= 38, `${draws} park draws`); assert(triangles <= 69472, `${triangles} park triangles`);
    assert.notEqual(gym.seafloor.root.parent,gym.root,'The expanded measured floor has a separate budget');
    assert.equal(gym.seafloor.root.children.length,1);assert(gym.seafloor.triangles<=SEAFLOOR.budget.triangles);
    assert.equal(gym.swimGroundHeight(250,-200),surveyedHeight(250,-200));
    assert(gym.swimGroundHeight(250,-200)<-5,'Offshore depth follows the survey instead of the former cap');
  } finally { gym.dispose(); }
});

test('scuba gear stays in the one skinned batch and never runs out of air', async () => {
  const { createAvatarModel } = await import('../src/models/avatar');
  const { AVATAR_OPTIONS } = await import('../src/models/avatar/design');
  const { SCUBA_AIR } = await import('../src/viewer/avatarController');
  let worst = 0;
  for (const hairStyle of AVATAR_OPTIONS.hairStyle) for (const faceLines of AVATAR_OPTIONS.faceLines) for (const bodyBuild of [.8, 1.25]) for (const heightMeters of [1.2, 1.8]) {
    const base = createAvatarModel(); const model = createAvatarModel({ ...base.design, hairStyle, faceLines, bodyBuild, heightMeters }, { gear: 'scuba' });
    worst = Math.max(worst, model.stats.triangles); assert.equal(model.stats.draws, 1); assert.equal(model.gear, 'scuba');
    assert.equal(model.design.hairStyle, hairStyle, 'gear never rewrites the saved appearance'); base.dispose(); model.dispose();
  }
  assert(worst <= 5000, `${worst} scuba triangles`);
  const root = new Object3D();
  const controller = createAvatarController({ root, spawn: new Vector3(10, 0, 0), bounds, colliders: [], groundHeight: bed, water, air: SCUBA_AIR });
  let state = controller.update(step, still);
  for (let i = 0; i < 60 * 90; i++) state = controller.update(step, { ...still, dive: i % 600 < 300 });
  assert.equal(state.breath, state.breathCapacity, '90 s of diving uses no air'); assert(!state.lowBreath && !state.exhausted && !state.rescued);
  // From the surface, the same second of held dive goes deeper in scuba gear.
  const scubaRoot = new Object3D(), suited = createAvatarController({ root: scubaRoot, spawn: new Vector3(10, 0, 0), bounds, colliders: [], groundHeight: bed, water, air: SCUBA_AIR });
  const plain = diver(); suited.update(step, still); plain.controller.update(step, still);
  for (let i = 0; i < 60; i++) { suited.update(step, { ...still, dive: true }); plain.controller.update(step, { ...still, dive: true }); }
  assert(suited.getState().diveDepth! > plain.controller.getState().diveDepth!);
});
