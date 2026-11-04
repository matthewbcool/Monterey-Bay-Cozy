import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, BoxGeometry, BufferAttribute, Group, InstancedMesh, Matrix3, Matrix4, Mesh, MeshToonMaterial, Object3D, PlaneGeometry, Quaternion, Raycaster, Vector3 } from 'three';
import { BAT_STAR, createBatStar } from '../src/models/habitat/batStar';
import { createBatStarColony } from '../src/models/habitat/batStarColony';
import { attachToSurface, surfaceAnchorFromHit } from '../src/models/shared/surfaceAttachment';
import { disposeObject } from '../src/models/props/primitives';
import { toonRamp } from '../src/models/shared/style';

function floor(width = 2) { const mesh = new Mesh(new PlaneGeometry(width, width).rotateX(-Math.PI / 2)); mesh.updateMatrixWorld(true); return mesh; }
const anchor = (surface: Mesh) => ({ surface, point: new Vector3(), normal: new Vector3(0, 1, 0), heading: new Vector3(1, 0, 0) });

test('Bat star seeds reproduce broad five-arm geometry within the one-draw budget in metre scale', () => {
  const a = createBatStar(), same = createBatStar({ seed: a.userData.seed }), large = createBatStar({ seed: a.userData.seed, diameterMeters: .36 });
  const geometry = (a.children[0] as Mesh).geometry;
  assert.deepEqual(geometry.attributes.position.array, (same.children[0] as Mesh).geometry.attributes.position.array);
  const size = new Box3().setFromObject(a).getSize(new Vector3()), largeSize = new Box3().setFromObject(large).getSize(new Vector3());
  assert.ok(largeSize.distanceTo(size.clone().multiplyScalar(2)) < 1e-7);
  assert.deepEqual(a.scale.toArray(), [1, 1, 1]); assert.equal(a.userData.species, 'Patiria miniata');
  for (let seed = 0; seed < 60; seed++) {
    const star = createBatStar({ seed }), mesh = star.children[0] as Mesh, size = new Box3().setFromObject(star).getSize(new Vector3());
    assert.equal(star.children.length, 1); assert.equal(mesh.geometry.index!.count / 3, 814);
    assert.ok(mesh.geometry.index!.count / 3 <= BAT_STAR.budget.triangles);
    assert.ok(mesh.material instanceof MeshToonMaterial); assert.equal(mesh.material.gradientMap, toonRamp());
    assert.equal(mesh.material.userData.rim, false); assert.ok(Math.abs(Math.max(size.x, size.z) - .18) < 1e-7);
    assert.equal(mesh.geometry.boundingBox!.min.y, 0); assert.ok(size.y > .015 && size.y < .025);
    for (const attribute of Object.values(mesh.geometry.attributes)) for (const value of attribute.array) assert.ok(Number.isFinite(value));
    disposeObject(star);
  }
  [a, same, large].forEach(disposeObject);
  assert.throws(() => createBatStar({ diameterMeters: 0 })); assert.throws(() => createBatStar({ seed: NaN }));
});

test('Surface roots align their underside to floors, walls and ceilings without changing geometry', () => {
  const surface = new Mesh(new BoxGeometry(2, 2, 2));
  for (const normal of [new Vector3(0, 1, 0), new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1)]) {
    const star = createBatStar({ seed: 1 }), geometry = (star.children[0] as Mesh).geometry;
    const version = (geometry.attributes.position as BufferAttribute).version;
    const binding = attachToSurface(star, { surface, point: normal.clone(), normal });
    assert.ok(new Vector3(0, 1, 0).applyQuaternion(star.quaternion).distanceTo(normal) < 1e-10);
    assert.ok(star.position.distanceTo(normal.clone().multiplyScalar(1.0008)) < 1e-10);
    assert.throws(() => attachToSurface(star, anchor(surface)), /already/);
    assert.equal(binding.update(0), false); assert.equal((geometry.attributes.position as BufferAttribute).version, version);
    binding.detach(); disposeObject(star);
  }
  disposeObject(surface);
});

test('Photo-refined underside has outward-facing oral bands and the colony omits hidden feet', () => {
  const star = createBatStar({ seed: 17, color: 'orange' }), colony = createBatStar({ seed: 17, color: 'orange', detail: 'colony' });
  star.updateMatrixWorld(true);
  for (const [x, z] of [[.026, .009], [.04, -.008], [-.02, .008], [-.023, -.02]]) {
    const ray = new Raycaster(new Vector3(x, -.1, z), new Vector3(0, 1, 0)), hit = ray.intersectObject(star, true)[0];
    assert.ok(hit?.face && hit.face.normal.y < -.2, 'Underside must face away from the body');
  }
  assert.equal(star.userData.tubeFeet, 30); assert.equal(colony.userData.tubeFeet, 0);
  assert.equal((colony.children[0] as Mesh).geometry.index!.count / 3, 306);
  assert.ok(colony.userData.budget.triangles < star.userData.budget.triangles);
  [star, colony].forEach(disposeObject);
});

test('Crawling is imperceptibly slow, bounded, stable across update rates and never rewrites vertex buffers', () => {
  const surface = floor(), poses: Vector3[] = [];
  for (const fps of [30, 60, 120]) {
    const star = createBatStar({ seed: 5 }), mesh = star.children[0] as Mesh, version = (mesh.geometry.attributes.position as BufferAttribute).version;
    const binding = attachToSurface(star, anchor(surface)), start = star.position.clone();
    for (let i = 0; i < fps * 60; i++) binding.update(1 / fps);
    const distance = star.position.distanceTo(start);
    assert.ok(distance > .000117 && distance <= .000120001, `${fps} Hz: ${distance} m in one minute`);
    assert.equal((mesh.geometry.attributes.position as BufferAttribute).version, version); poses.push(star.position.clone());
    binding.update(20000); assert.ok(binding.getState().travelMeters <= .02); assert.ok(star.position.distanceTo(start) <= .020001);
    const caught = star.position.clone(); binding.detach(); star.position.set(2, 3, 4); binding.update(60);
    assert.deepEqual(star.position.toArray(), [2, 3, 4]); assert.equal(binding.getState().attached, false);
    assert.notDeepEqual(caught.toArray(), star.position.toArray()); disposeObject(star);
  }
  assert.ok(poses[0].distanceTo(poses[2]) < .0000021); disposeObject(surface);
});

test('Crawl projection stops at mesh edges and cannot jump to neighboring objects', () => {
  const surface = floor(.02), neighbor = floor(2); neighbor.position.y = -.01;
  const star = createBatStar({ diameterMeters: .01, seed: 3 });
  const binding = attachToSurface(star, { ...anchor(surface), point: new Vector3(.009, 0, 0) });
  const start = star.position.clone(); binding.update(1000);
  assert.ok(star.position.equals(start)); assert.equal(binding.getState().travelMeters, 0);
  binding.detach(); [star, surface, neighbor].forEach(disposeObject);
});

test('Attachments follow transformed instanced surfaces in world metres and release placement ownership', () => {
  const scene = new Group(), parent = new Group(), target = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshToonMaterial(), 2);
  parent.position.set(1, 2, 3); parent.rotation.z = .2; parent.scale.setScalar(2); scene.add(parent, target);
  target.position.set(-2, 0, 1); target.rotation.y = .4; target.scale.set(2, 1, .5);
  const instance = new Matrix4().makeTranslation(0, 0, 0); target.setMatrixAt(0, instance); target.setMatrixAt(1, new Matrix4().makeTranslation(3, 0, 0));
  scene.updateMatrixWorld(true);
  const point = new Vector3(0, .5, 0).applyMatrix4(target.matrixWorld), ray = new Raycaster(point.clone().add(new Vector3(0, 2, 0)), new Vector3(0, -1, 0));
  const hit = ray.intersectObject(target).find(hit => hit.instanceId === 0)!; assert.ok(hit);
  const star = createBatStar({ seed: 2 }); parent.add(star);
  const local = surfaceAnchorFromHit(hit), binding = attachToSurface(star, local, { speedMetersPerSecond: 0 });
  target.rotation.set(.2, .7, .3); instance.makeTranslation(.5, .3, -.1); target.setMatrixAt(0, instance);
  scene.updateMatrixWorld(true); assert.ok(binding.update(0)); scene.updateMatrixWorld(true);
  target.getMatrixAt(0, instance); // Instance matrices are stored as Float32, not the original JS doubles.
  const effective = target.matrixWorld.clone().multiply(instance), normal = local.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(effective)).normalize();
  const expected = local.point.clone().applyMatrix4(effective).addScaledVector(normal, .0008);
  assert.ok(star.getWorldPosition(new Vector3()).distanceTo(expected) < 1e-9);
  assert.ok(new Vector3(0, 1, 0).applyQuaternion(star.getWorldQuaternion(new Quaternion())).distanceTo(normal) < 1e-9);
  assert.ok(star.getWorldScale(new Vector3()).distanceTo(new Vector3(1, 1, 1)) < 1e-9);
  binding.detach(); const second = attachToSurface(star, local); second.detach();
  disposeObject(scene); target.dispose();
  assert.throws(() => surfaceAnchorFromHit({ object: new Object3D() } as any));
});

test('Colony uses one instance batch, skips static uploads and disposes each resource once', () => {
  const surface = floor(), colony = createBatStarColony([anchor(surface), { ...anchor(surface), point: new Vector3(.3, 0, 0) }]);
  assert.equal(colony.batch.count, 2); assert.equal(colony.batch.geometry.index!.count / 3, 306);
  const version = colony.batch.instanceMatrix.version, positions = (colony.batch.geometry.attributes.position as BufferAttribute).version;
  colony.update(.5); assert.equal(colony.batch.instanceMatrix.version, version);
  colony.update(.6); assert.equal(colony.batch.instanceMatrix.version, version + 1);
  assert.equal((colony.batch.geometry.attributes.position as BufferAttribute).version, positions);
  let geometry = 0, material = 0, instances = 0;
  colony.batch.geometry.addEventListener('dispose', () => geometry++);
  (colony.batch.material as MeshToonMaterial).addEventListener('dispose', () => material++); colony.batch.addEventListener('dispose', () => instances++);
  colony.dispose(); colony.dispose(); colony.update(1);
  assert.deepEqual({ geometry, material, instances }, { geometry: 1, material: 1, instances: 1 });
  assert.ok(colony.attachments.every(a => !a.getState().attached)); disposeObject(surface);
});
