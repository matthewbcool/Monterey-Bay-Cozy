import { Box3, Color, DirectionalLight, Group, HemisphereLight, Matrix4, PerspectiveCamera, Scene, SkinnedMesh, Vector3 } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createWesternGull, getGullState, setGullPose, updateWesternGull } from '../src/models/habitat/western-gull/createWesternGull';
import { createGullFlock, type GullFlock } from '../src/models/habitat/western-gull/createGullFlock';
import type { GullPose, GullSex } from '../src/models/habitat/western-gull/definition';
import { disposeObject } from '../src/models/props/primitives';
import { createLodController } from '../src/models/shared/lod/controller';
import { STYLE } from '../src/models/shared/style';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

/** No scenery or animation loop: each capture is an explicit deterministic
 * pose, with the production material and shared LOD controller. */
export async function reviewGull(forceWebGL = false) {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL });
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(1); document.body.append(renderer.domElement); await renderer.init();
  const scene = new Scene(); scene.background = new Color('#38636e');
  const sun = new DirectionalLight(STYLE.sun.color, STYLE.sun.intensity); sun.position.copy(STYLE.sun.direction);
  scene.add(sun, new HemisphereLight(STYLE.sky.color, STYLE.sky.ground, STYLE.sky.intensity));
  const camera = new PerspectiveCamera(40, innerWidth / innerHeight, .01, 100000), lod = createLodController();
  let root: Group | undefined, flock: GullFlock | undefined;
  function release() { if (flock) flock.dispose(); else if (root) disposeObject(root); flock = undefined; root = undefined; }
  async function single(sex: GullSex = 'male', pose: GullPose = 'flight') {
    release(); root = createWesternGull({ sex, pose, seed: 42 }); scene.add(root); applyNodeStyle(root); await lod.register(root); frame();
    return root;
  }
  async function group(sex: GullSex = 'male', count = 32) {
    release(); flock = createGullFlock({ sex, count, capacity: 1024, seed: 42 }); root = flock.root; scene.add(root); applyNodeStyle(root); await lod.register(root); frame();
    return flock;
  }
  function frame(side = false) {
    const target = new Vector3(0, .34, 0), direction = new Vector3(side ? -1 : -.9, side ? .12 : .48, side ? -.1 : -1).normalize();
    let distance = 2.35;
    if (flock) { flock.bounds.getCenter(target); distance = Math.max(2.35, flock.bounds.getSize(new Vector3()).length() * 1.1); }
    camera.position.copy(target).add(direction.multiplyScalar(distance)); camera.lookAt(target); camera.updateMatrixWorld(true);
  }
  function update(dt: number) { if (flock) flock.update(dt); else if (root) updateWesternGull(root, dt); }
  function pose(value: GullPose) { if (root && !flock) setGullPose(root, value); }
  function snapshot() {
    return { state: root && !flock ? getGullState(root) : undefined, root: root?.position.toArray(), scale: root?.scale.toArray(),
      active: root ? lod.inspect(root) : [], stats: root ? lod.stats(root) : undefined,
      backend: renderer.backend.constructor.name, rendered: { ...renderer.info.render } };
  }
  async function render() {
    scene.updateMatrixWorld(true); root?.traverse(object => { if (object instanceof SkinnedMesh) object.skeleton.update(); });
    lod.update(camera, innerHeight, 0, true); await renderer.compileAsync(scene, camera); renderer.info.reset(); renderer.render(scene, camera);
    const full = { ...renderer.info.render }, visible = root?.visible;
    if (root) root.visible = false;
    renderer.info.reset(); renderer.render(scene, camera); const empty = { ...renderer.info.render };
    if (root) root.visible = visible!;
    renderer.info.reset(); renderer.render(scene, camera);
    // WebGPU uses one fullscreen background triangle; subtract that measured
    // empty pass instead of presenting scene overhead as an asset draw.
    return { ...snapshot(), sceneRendered: full, rendered: { ...full, drawCalls: full.drawCalls - empty.drawCalls, triangles: full.triangles - empty.triangles } };
  }
  await single(); await render();
  return { renderer, scene, camera, lod, frame, render, single, group, pose, update, snapshot, get root() { return root!; }, get flock() { return flock; },
    Matrix4, Vector3, Box3, dispose() { release(); lod.dispose(); renderer.dispose(); } };
}
