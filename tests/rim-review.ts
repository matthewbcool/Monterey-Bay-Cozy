import { Box3, DirectionalLight, HemisphereLight, Mesh, PerspectiveCamera, Scene, Vector3, WebGPURenderer, CylinderGeometry, PCFShadowMap } from 'three/webgpu';
import { propCollection } from '../src/models/props/catalogue';
import { createBlueRockfishModel } from '../src/models/blue-rockfish/createBlueRockfishModel';
import { createSardineSchool } from '../src/models/pacific-sardine/createSardineSchool';
import { createToonMaterial, STYLE } from '../src/models/shared/style';
import { createSky } from '../src/viewer/sky';
import { applyNodeStyle } from '../src/viewer/nodeStyle';

/** Same lights, sky and toon ramp as the main viewer, on WebGPURenderer, with the TSL rim on or off. */
export async function reviewRim({ forceWebGL = false, rim = true, close = false } = {}) {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL, trackTimestamp: true });
  renderer.setPixelRatio(1); renderer.setSize(1280, 820); renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
  document.body.append(renderer.domElement); await renderer.init();
  const scene = new Scene(), sky = createSky(); scene.add(sky.root);
  scene.add(new HemisphereLight(STYLE.sky.color, STYLE.sky.ground, STYLE.sky.intensity));
  const sun = new DirectionalLight(STYLE.sun.color, STYLE.sun.intensity); sun.position.copy(STYLE.sun.direction).multiplyScalar(24); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, far: 80 }); sun.shadow.normalBias = .06; sun.shadow.bias = -.0006; scene.add(sun);
  const ground = new Mesh(new CylinderGeometry(9, 9, .1, 48), createToonMaterial({ color: '#4f7a72', rim: false })); ground.position.y = -.05; ground.receiveShadow = true; scene.add(ground);
  const places: Record<string, [number, number, number]> = { 'cabin-boat': [2.6, 0, -1.2], rowboat: [-2.4, 0, -.6], dock: [-5.2, 0, 2.8], 'tackle-box': [-.4, 0, 2.6], 'spinning-rod': [1.2, 0, 3.4], 'bamboo-rod': [3.4, 0, 3.6] };
  for (const entry of propCollection) {
    const model = entry.create(), bounds = new Box3().setFromObject(model), at = places[entry.id] ?? [0, 0, 0];
    model.position.set(at[0], -bounds.min.y, at[2]); model.rotation.y = entry.id.includes('rod') ? Math.PI / 2 : .5; scene.add(model);
  }
  const rockfish = createBlueRockfishModel(); rockfish.root.position.set(.2, 1.3, 4.2); rockfish.root.rotation.y = -.5; scene.add(rockfish.root);
  const school = createSardineSchool({ count: 64 }); school.root.position.set(-1.2, 1.8, 2.6); school.root.rotation.y = -.3; scene.add(school.root);
  const styled = applyNodeStyle(scene, rim);
  const camera = new PerspectiveCamera(38, 1280 / 820, .05, 320); if (close) { camera.position.set(1.5, 1.75, 5.6); camera.lookAt(new Vector3(-.2, 1.45, 3.4)); } else { camera.position.set(7.5, 5.2, 10.5); camera.lookAt(new Vector3(-.2, 1.1, .4)); }
  sky.root.position.copy(camera.position);
  const step = async () => { school.update(1 / 60); rockfish.update(1 / 60); await renderer.renderAsync(scene, camera); };
  for (let i = 0; i < 20; i++) await step(); // compile and settle
  const gpu: number[] = [], cpu: number[] = [];
  for (let i = 0; i < 90; i++) {
    const start = performance.now(); await step(); cpu.push(performance.now() - start);
    try { await renderer.resolveTimestampsAsync('render'); const t = renderer.info.render.timestamp; if (t > 0) gpu.push(t); } catch { /* timestamps unsupported */ }
  }
  renderer.info.reset(); renderer.info.autoReset = false; await step(); const frame = { drawCalls: renderer.info.render.drawCalls, triangles: renderer.info.render.triangles };
  const median = (a: number[]) => a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : null;
  return {
    backend: renderer.backend.constructor.name, forceWebGL, rim, nodeMaterials: styled.size,
    render: frame,
    gpuMs: median(gpu), cpuSubmitMs: median(cpu), gpuSamples: gpu.length,
  };
}
