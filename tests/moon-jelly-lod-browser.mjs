import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = process.env.ARTIFACT_DIR ?? 'artifacts/moon-jelly-lod';
const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const results = [], errors = [];
try {
  for (const webgl of [false, true]) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
    await page.route('https://api.weather.gov/**', route => route.abort());
    await page.routeWebSocket(u => u.hostname === '127.0.0.1' && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /shader|wgsl|glsl|pipeline|validation/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(`${url}?tab=gym&whales=hide${webgl ? '&webgl' : ''}`);
    const deadline = Date.now() + 120000;
    while (!await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench;
      if (!w?.gym || !w.getSnapshot().gymReady) return false;
      window.jellyLodWorkbench = w;
      return true;
    })) {
      assert(Date.now() < deadline, 'Gym did not become ready');
      await page.waitForTimeout(250);
    }

    // Controlled render fixture: use the actual Gym specimen and its registered LODs.
    // Fixed camera/placement and an opaque white diagnostic material isolate the silhouette.
    const result = await page.evaluate(async () => {
      const w = window.jellyLodWorkbench;
      const T = await import('/node_modules/.vite/deps/three_webgpu.js');
      const { applyJellyPose } = await import('/src/models/habitat/moon-jelly/motion.ts');
      const { prepareGeometryLods } = await import('/src/models/shared/lod/geometry.ts');
      const r = w.renderer;
      w.setActive(null); await w.lod.ready();
      w.gym.reef.setViewer(w.gym.reef.center.x, w.gym.reef.center.z);
      w.lod.setMode('near'); w.lod.update(w.camera, 800, 0, true);
      const jelly = w.gym.reef.swimmers.find(s => s.model.root.userData.assetId === 'moon-jelly').model.root;
      const meshes = jelly.children, source = meshes.map(m => m.geometry), original = meshes.map(m => m.material);
      const scene = new T.Scene(); scene.background = new T.Color(0); scene.add(jelly);
      const position = jelly.position.toArray(), scale = jelly.scale.toArray();
      for (const mesh of meshes) {
        mesh.material = mesh.material.clone();
        mesh.material.vertexColors = false; mesh.material.color.set(0xffffff);
        mesh.material.emissive.set(0xffffff); mesh.material.emissiveNode = null;
        mesh.material.transparent = false; mesh.material.opacity = 1; mesh.material.depthWrite = true;
        mesh.material.needsUpdate = true;
      }
      const size = 512, target = new T.RenderTarget(size, size), camera = new T.PerspectiveCamera(38, 1, .001, 200);
      camera.position.copy(jelly.position).add(new T.Vector3(.35, .45, .55)); camera.lookAt(jelly.position);
      camera.updateMatrixWorld(true); r.shadowMap.enabled = false;
      const v = new T.Vector3(), box = new T.Box3();
      async function measure() {
        r.setRenderTarget(target); await r.renderAsync(scene, camera); await r.renderAsync(scene, camera);
        const bytes = new Uint8Array(await r.readRenderTargetPixelsAsync(target, 0, 0, size, size));
        let minX = size, minY = size, maxX = -1, maxY = -1;
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
          if (bytes[(y * size + x) * 4] < 128) continue;
          minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        box.makeEmpty(); jelly.updateWorldMatrix(true, true);
        for (const mesh of meshes) for (const index of new Set(mesh.geometry.index.array)) {
          mesh.getVertexPosition(index, v); box.expandByPoint(v.applyMatrix4(mesh.matrixWorld).project(camera));
        }
        const expected = [(box.max.x - box.min.x) * size / 2, (box.max.y - box.min.y) * size / 2];
        const actual = [maxX - minX + 1, maxY - minY + 1];
        return { expected, actual, error: Math.max(...actual.map((n, i) => Math.abs(n - expected[i]))) };
      }
      const samples = [];
      for (const mode of ['near', 'mid', 'far', 'near', 'far', 'mid', 'near']) {
        w.lod.setMode(mode); w.lod.update(camera, size, 0, true);
        for (const phase of [0, .15, .3, .5, .7, .9]) {
          applyJellyPose(meshes, phase * Math.PI * 2);
          const sample = { mode, phase, ...await measure() }; samples.push(sample);
          if (sample.error > 6) throw Error(`Rendered jelly diverged from its posed geometry: ${JSON.stringify(sample)}`);
        }
        applyJellyPose(meshes, 0, true);
        const caught = { mode, caught: true, ...await measure() }; samples.push(caught);
        if (caught.error > 6) throw Error(`Caught jelly diverged: ${JSON.stringify(caught)}`);
      }
      // Controller teardown is another geometry swap and must restore valid Near bindings.
      w.lod.setMode('far'); w.lod.update(camera, size, 0, true); await measure();
      w.lod.dispose();
      const restored = await measure();
      if (restored.error > 6 || meshes.some((m, i) => m.geometry !== source[i])) throw Error('Near restoration retained stale morph bindings');

      // Negative control replays the old geometry-only swap. This must fail the pixel check.
      const levels = await Promise.all(source.map(prepareGeometryLods));
      applyJellyPose(meshes, .45 * Math.PI * 2); await measure();
      meshes.forEach((m, i) => { m.geometry = levels[i].far; });
      const legacy = await measure();
      if (legacy.error < 20) throw Error(`Negative control did not expose stale animation data: ${JSON.stringify(legacy)}`);
      meshes.forEach((m, i) => { m.geometry = source[i]; m.material.dispose(); m.material = original[i]; m.material.needsUpdate = true; });
      const unchanged = JSON.stringify(position) === JSON.stringify(jelly.position.toArray()) && JSON.stringify(scale) === JSON.stringify(jelly.scale.toArray());
      r.setRenderTarget(null); target.dispose();
      // Normal-material close view after restoring the fixture; no gameplay state is saved.
      scene.background.set('#163c4a'); scene.add(new T.HemisphereLight('#fff1d7', '#99b6c0', 2));
      const sun = new T.DirectionalLight('#fff0dd', 2); sun.position.set(1, 3, 2); scene.add(sun);
      camera.aspect = r.domElement.width / r.domElement.height; camera.updateProjectionMatrix();
      await r.renderAsync(scene, camera); await r.renderAsync(scene, camera);
      return { backend: w.getSnapshot().backend, seed: jelly.userData.seed, diameterMeters: jelly.userData.diameterMeters,
        unchanged, samples, restored, legacy, screenshot: r.domElement.toDataURL() };
    });
    assert.equal(result.backend, webgl ? 'WebGL 2' : 'WebGPU'); assert(result.unchanged);
    const image = result.screenshot; delete result.screenshot;
    await fs.writeFile(`${out}/${webgl ? 'webgl' : 'webgpu'}-jelly.png`, Buffer.from(image.split(',')[1], 'base64'));
    results.push(result);
    console.log(`PASS ${result.backend}: ${result.samples.length} rendered pulse/caught bounds, repeated detail changes, restoration and failing legacy control`);
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await fs.writeFile(`${out}/browser-checks.json`, JSON.stringify({ results, errors }, null, 2));
  await browser.close();
}
