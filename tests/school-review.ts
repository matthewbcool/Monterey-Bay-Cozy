import { AmbientLight, Color, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createSardineSchool } from '../src/models/pacific-sardine/createSardineSchool';
import { applyNodeStyle } from '../src/viewer/nodeStyle';
import type { FishLifeState, SwimMode } from '../src/models/types';

export async function reviewSchool() {
  const params = new URLSearchParams(location.search);
  const renderer = params.has('classic') ? new WebGLRenderer({ antialias: true }) : new WebGPURenderer({ antialias: true, forceWebGL: params.has('webgl') });
  renderer.setSize(innerWidth, innerHeight); document.body.append(renderer.domElement);
  if (renderer instanceof WebGPURenderer) await renderer.init();
  renderer.info.autoReset = false;
  const scene = new Scene(); scene.background = new Color('#153740');
  scene.add(new AmbientLight('#d7e8df', 2)); const sun = new DirectionalLight('#e5f4d9', 2.2); sun.position.set(-1, 3, 4); scene.add(sun);
  const start = performance.now(), school = createSardineSchool(); const generationMs = performance.now() - start;
  const camera = new PerspectiveCamera(35, innerWidth / innerHeight, .01, 100);
  const direction = new Vector3(-.3, .38, 1).normalize();
  let frame = 0, previous = performance.now(), running = false;
  function frameSchool() { camera.position.copy(direction).multiplyScalar(school.bounds.getSize(new Vector3()).length() * 1.85); camera.lookAt(school.bounds.getCenter(new Vector3())); }
  async function render() {
    renderer.info.reset();
    if (renderer instanceof WebGPURenderer) await renderer.renderAsync(scene, camera); else renderer.render(scene, camera);
  }
  // Measure the empty renderer, including the node renderer's color-output triangle.
  await render();
  const overheadCalls = renderer instanceof WebGPURenderer ? renderer.info.render.drawCalls : renderer.info.render.calls;
  const overheadTriangles = renderer.info.render.triangles;
  scene.add(school.root);
  if (renderer instanceof WebGPURenderer) applyNodeStyle(school.root);
  function stats() {
    const r = renderer.info.render;
    const totalCalls = renderer instanceof WebGPURenderer ? renderer.info.render.drawCalls : r.calls;
    return { count: school.count, backend: renderer instanceof WebGPURenderer ? renderer.backend.constructor.name : 'WebGLRenderer', calls: totalCalls - overheadCalls, triangles: r.triangles - overheadTriangles, totalCalls, totalTriangles: r.triangles, overheadCalls, overheadTriangles,
      generationMs, sharedGeometryBytes: school.root.userData.sharedGeometryBytes, weightBytes: school.batches.alive.morphTexture!.image.data.byteLength,
      matrixBytes: school.batches.alive.instanceMatrix.array.byteLength + school.batches.caught.instanceMatrix.array.byteLength };
  }
  async function show(count: number, mode: SwimMode = 'slow', life: FishLifeState = 'alive') {
    school.setCount(count); school.setLifeState(life); school.setSwimMode(mode, true); school.update(.1); frameSchool(); await render();
    const result = stats(); document.getElementById('details')!.textContent = `${count} fish · ${result.calls} draw · ${result.triangles.toLocaleString()} triangles · ${mode}`; return result;
  }
  async function tick(now: number) {
    if (!running) return;
    school.update(Math.min((now - previous) / 1000, .05)); previous = now; await render(); frame = requestAnimationFrame(tick);
  }
  await show(48);
  return { school, renderer, scene, camera, show, stats, render,
    play() { if (running) return; running = true; previous = performance.now(); frame = requestAnimationFrame(tick); },
    pause() { running = false; cancelAnimationFrame(frame); },
    dispose() { running = false; cancelAnimationFrame(frame); school.dispose(); renderer.dispose(); },
  };
}
