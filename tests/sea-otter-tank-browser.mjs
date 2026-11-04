import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const out = process.env.ARTIFACT_DIR ?? 'artifacts/sea-otter-tank';
await fs.mkdir(out, { recursive: true });
const paths = ['src/main.ts', 'src/models/catalogue.ts', 'src/models/sizeRanges.ts', 'src/viewer/swimPath.ts', 'src/viewer/demoRoute.ts', 'src/viewer/seaOtterRoute.ts', 'src/viewer/tankDemo.ts', 'src/viewer/demoPopulation.ts', 'src/viewer/openSea/waterLook.ts', 'tests/sea-otter-tank-browser.mjs'];
for (const dir of ['src/models/sea-otter', 'src/models/habitat/sea-otter']) for (const name of await fs.readdir(dir)) if (name.endsWith('.ts')) paths.push(dir + '/' + name);
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async p => [p, createHash('sha256').update(await fs.readFile(p)).digest('hex')])));
const before = await hashes(), checks = [], errors = [], records = [];
const check = (ok, label) => { if (!ok) throw Error(label); checks.push(label); console.log('PASS', label); };
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const run = (p, fn, arg) => p.evaluate(({ source, arg }) => new Function('v', 'arg', `return (${source})(v,arg)`)(window.otterTank, arg), { source: fn.toString(), arg });
// Wait for submitted GPU work and canvas composition before comparing frames.
// A Playwright screenshot alone can still return the prior composited canvas.
const settleFrame = p => p.evaluate(async () => {
  const renderer = window.otterTank.renderer;
  if (renderer.backend.isWebGPUBackend) await renderer.backend.device.queue.onSubmittedWorkDone();
  else renderer.backend.gl?.finish();
  await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
});
const advance = (v, seconds) => {
  for (let left = seconds; left > 1e-8; left -= .05) { const dt = Math.min(.05, left); v.fish.update(dt); v.swimmer.update(dt, v.fish.getState().blend); }
  v.scene.updateMatrixWorld(true); v.setView('follow'); v.renderer.render(v.scene, v.camera);
};
const snapshot = v => ({ position: v.fish.root.position.toArray(), rotation: v.fish.root.quaternion.toArray(), state: v.fish.getState(), route: v.swimmer.getPhase(), pose: v.fish.getOtterPose() });
async function demoOtterVisibility(p, backend) {
  const frame = await run(p, async v => {
    const member = v.demo.members.find(m => m.speciesId === 'southern-sea-otter'), root = member.model.root;
    const lights = [], casters = [];
    v.scene.traverse(object => {
      if (object.isLight && object.shadow) { lights.push([object.shadow, object.shadow.intensity]); object.shadow.intensity = 0; }
      if (object.isMesh && object.castShadow) { casters.push(object); object.castShadow = false; }
    });
    window.otterDemoCapture = { root, lights, casters, visible: root.visible };
    root.visible = true;
    v.scene.updateMatrixWorld(true); v.renderer.render(v.scene, v.camera);
    const canvas = v.renderer.domElement.getBoundingClientRect(), point = root.position.clone();
    const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    root.traverseVisible(object => {
      if (!object.isMesh) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld).project(v.camera);
        const x = canvas.left + (point.x + 1) * canvas.width / 2, y = canvas.top + (1 - point.y) * canvas.height / 2;
        bounds.minX = Math.min(bounds.minX, x); bounds.maxX = Math.max(bounds.maxX, x);
        bounds.minY = Math.min(bounds.minY, y); bounds.maxY = Math.max(bounds.maxY, y);
      }
    });
    const controls = [...document.querySelectorAll('.creature-control,nav,header')].map(element => {
      const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    });
    return { bounds, controls, position: root.position.toArray() };
  });
  try {
    await settleFrame(p);
    const visible = await p.screenshot({ path: `${out}/${backend}-tank-demo-body.png` });
    await run(p, v => { window.otterDemoCapture.root.visible = false; v.renderer.render(v.scene, v.camera); });
    await settleFrame(p);
    const hidden = await p.screenshot();
    await run(p, v => v.renderer.render(v.scene, v.camera));
    await settleFrame(p);
    const repeated = await p.screenshot();
    const pixels = await p.evaluate(async ({ images, frame }) => {
      const decoded = await Promise.all(images.map(source => new Promise((resolve, reject) => {
        const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = 'data:image/png;base64,' + source;
      })));
      const canvas = document.createElement('canvas'); canvas.width = decoded[0].width; canvas.height = decoded[0].height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const data = decoded.map(image => { context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0); return context.getImageData(0, 0, canvas.width, canvas.height).data; });
      let bodyPixels = 0, noisePixels = 0;
      const { bounds, controls } = frame;
      for (let y = Math.max(0, Math.floor(bounds.minY)); y <= Math.min(canvas.height - 1, Math.ceil(bounds.maxY)); y++) {
        for (let x = Math.max(0, Math.floor(bounds.minX)); x <= Math.min(canvas.width - 1, Math.ceil(bounds.maxX)); x++) {
          if (controls.some(r => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) continue;
          const i = (y * canvas.width + x) * 4;
          if (Math.max(...[0, 1, 2].map(c => Math.abs(data[0][i + c] - data[1][i + c]))) > 6) bodyPixels++;
          if (Math.max(...[0, 1, 2].map(c => Math.abs(data[1][i + c] - data[2][i + c]))) > 6) noisePixels++;
        }
      }
      return { bodyPixels, noisePixels };
    }, { images: [visible, hidden, repeated].map(image => image.toString('base64')), frame });
    records.push({ backend, name: 'demo-visible-body', shadowCastersDisabled: true, shadowIntensitiesZero: true, ...frame, ...pixels });
    check(pixels.bodyPixels >= 20 && pixels.noisePixels === 0, backend + ' Demo otter body contributes visible pixels outside controls without shadows');
  } finally {
    await run(p, v => {
      const saved = window.otterDemoCapture; saved.root.visible = saved.visible;
      for (const [shadow, intensity] of saved.lights) shadow.intensity = intensity;
      for (const object of saved.casters) object.castShadow = true;
      delete window.otterDemoCapture; v.renderer.render(v.scene, v.camera);
    });
  }
}
async function capture(p, backend, name, level = 'near') {
  const row = await run(p, async (v, level) => {
    v.setLodMode(level); v.setView('follow'); await v.lod.ready(); v.scene.updateMatrixWorld(true);
    // Render through the normal synchronous path; async precompilation races the live frame loop.
    // Keep Three's ShadowNode setup active; suppress casters for color-pass counts.
    const reset = v.renderer.info.autoReset, casters = [];
    v.scene.traverse(object => { if (object.isMesh && object.castShadow) { casters.push(object); object.castShadow = false; } });
    v.renderer.info.autoReset = false;
    v.fish.root.visible = false; v.renderer.info.reset(); v.renderer.render(v.scene, v.camera); const empty = { ...v.renderer.info.render };
    v.fish.root.visible = true; v.renderer.info.reset(); v.renderer.render(v.scene, v.camera); const full = { ...v.renderer.info.render };
    for (const object of casters) object.castShadow = true; v.renderer.info.autoReset = reset;
    const canvas = v.renderer.domElement.getBoundingClientRect(), point = v.fish.root.position.clone();
    const projected = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    v.fish.root.traverseVisible(object => {
      if (!object.isMesh) return;
      for (let i = 0; i < object.geometry.attributes.position.count; i++) {
        object.getVertexPosition(i, point).applyMatrix4(object.matrixWorld).project(v.camera);
        const x = canvas.left + (point.x + 1) * canvas.width / 2, y = canvas.top + (1 - point.y) * canvas.height / 2;
        projected.minX = Math.min(projected.minX, x); projected.maxX = Math.max(projected.maxX, x);
        projected.minY = Math.min(projected.minY, y); projected.maxY = Math.max(projected.maxY, y);
      }
    });
    const freeSpace = { top: document.querySelector('.creature-control').getBoundingClientRect().bottom, bottom: document.querySelector('#pause').getBoundingClientRect().top, width: innerWidth };
    return { backend: v.state.backend, seed: v.fish.root.userData.seed, stats: v.lod.stats(v.fish.root), rendered: { draws: full.drawCalls - empty.drawCalls, triangles: full.triangles - empty.triangles }, projected, freeSpace, position: v.fish.root.position.toArray(), route: v.swimmer.getPhase(), pose: v.fish.getOtterPose() };
  }, level);
  records.push({ backend, name, level, ...row });
  check(row.rendered.draws === (name === 'caught' ? 2 : 1) && row.rendered.triangles > 0, `${backend} ${name} ${level}: model actually submitted`);
  await settleFrame(p);
  const visible = await p.screenshot({ path: `${out}/${backend}-tank-${name}-${level}.png` });
  check(row.projected.minX >= 0 && row.projected.maxX <= row.freeSpace.width && row.projected.minY >= row.freeSpace.top - 1 && row.projected.maxY <= row.freeSpace.bottom + 1, `${backend} ${name} ${level}: complete posed skin clears controls`);
  await run(p, v => { v.fish.root.visible = false; v.renderer.render(v.scene, v.camera); });
  await settleFrame(p);
  const hidden = await p.screenshot();
  check(!visible.equals(hidden), `${backend} ${name} ${level}: otter contributes visible pixels`);
  await run(p, v => { v.fish.root.visible = true; v.renderer.render(v.scene, v.camera); });
}
let failure;
try {
  for (const backend of ['webgpu', 'webgl']) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    await context.routeWebSocket(u => u.hostname === '127.0.0.1' && u.port === '5191', s => s.send(JSON.stringify({ type: 'connected' })));
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(e.message)); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(`http://127.0.0.1:5191/?creature=southern-sea-otter&view=follow&quality=standard${backend === 'webgl' ? '&webgl' : ''}`);
    await p.waitForFunction(async () => { const entry = document.querySelector('script[type=module][src*="/src/main.ts"]'); if (!entry) return false; const { viewer } = await import(entry.src); await viewer.started; window.otterTank = viewer; return viewer.state.creatureId === 'southern-sea-otter'; });
    await run(p, v => v.lod.ready());
    check(await run(p, (v, backend) => v.state.backend === (backend === 'webgpu' ? 'WebGPU' : 'WebGL 2') && v.state.paused && v.state.view === 'follow' && v.swimmer.getActivity() === 'cycle', backend), backend + ' deep link, real backend, natural cycle and reduced motion');
    check((await p.locator('#mode-slow').textContent()).includes('Surface rest') && (await p.locator('#mode-fast').textContent()).includes('Underwater swim') && (await p.locator('#mode-cycle').textContent()).includes('Natural cycle'), backend + ' species controls are readable');
    const still = await run(p, snapshot); await p.waitForTimeout(180); check(JSON.stringify(still) === JSON.stringify(await run(p, snapshot)), backend + ' reduced motion freezes route and pose');
    for (const level of ['near', 'mid', 'far']) await capture(p, backend, 'surface', level);
    let time = 0;
    for (const [target, name] of [[50, 'groom'], [73, 'dive'], [85, 'swim'], [97, 'resurface'], [102, 'returned-surface']]) {
      await run(p, advance, target - time); time = target;
      const state = await run(p, snapshot); records.push({ backend, name, ...state });
      check(state.route.stage === (name === 'returned-surface' ? 'float' : name), `${backend} natural ${name} phase`);
      await capture(p, backend, name);
      if (name === 'swim') for (const level of ['mid', 'far']) await capture(p, backend, name, level);
    }
    await p.locator('#mode-fast').click(); await run(p, advance, 6);
    check(await run(p, v => v.swimmer.getActivity() === 'swim' && v.swimmer.getPhase().depth > 2 && v.fish.getOtterPose() === 'swim'), backend + ' Underwater swim holds a submerged prone pose');
    await p.locator('#mode-slow').click(); await run(p, advance, 6);
    check(await run(p, v => v.swimmer.getActivity() === 'surface' && Math.abs(v.fish.root.position.y - 4.5) < 1e-6), backend + ' Surface rest returns to exact waterline');
    await p.locator('#pause').click(); await p.waitForTimeout(450); await p.locator('#pause').click();
    const frozen = await run(p, snapshot); await p.waitForTimeout(150); check(JSON.stringify(frozen) === JSON.stringify(await run(p, snapshot)), backend + ' play then pause freezes surface behavior');
    await p.selectOption('#life-state', 'caught'); const caught = await run(p, snapshot); await run(p, advance, 3);
    check(JSON.stringify(caught) === JSON.stringify(await run(p, snapshot)) && await p.locator('#mode-fast').isDisabled(), backend + ' caught freezes rig and path');
    for (const level of ['near', 'mid', 'far']) await capture(p, backend, 'caught', level);
    await p.selectOption('#life-state', 'alive');
    await p.locator('#mode-cycle').click(); const preserved = await run(p, snapshot);
    await p.locator('#demo-mode').check(); await run(p, v => v.lod.ready());
    check(await run(p, v => v.demo.count === 292 && v.demo.speciesCount === 15 && v.demo.members.filter(m => m.speciesId === 'southern-sea-otter').length === 1 && v.demo.members.find(m => m.speciesId === 'southern-sea-otter').route.surfaceAware), backend + ' Demo contains one otter with the same surface route');
    await demoOtterVisibility(p, backend);
    await settleFrame(p);
    await p.screenshot({ path: `${out}/${backend}-tank-demo.png` });
    await p.locator('#demo-mode').uncheck(); check(JSON.stringify(preserved) === JSON.stringify(await run(p, snapshot)), backend + ' Demo restores inspected otter state');
    await run(p, v => v.fish.setMotionOwner('physics')); const external = await run(p, v => v.fish.root.matrix.toArray()); await run(p, advance, 2);
    check(JSON.stringify(external) === JSON.stringify(await run(p, v => v.fish.root.matrix.toArray())), backend + ' route respects physics ownership');
    await p.selectOption('#creature-select', 'tuna'); await p.selectOption('#life-state', 'caught'); await p.selectOption('#creature-select', 'southern-sea-otter'); await run(p, v => v.lod.ready());
    check(await run(p, v => v.fish.getState().lifeState === 'caught' && v.fish.getState().motionOwner === 'external'), backend + ' caught selection leaves placement external');
    const releasedHeight = await run(p, v => v.fish.root.position.y);
    await p.selectOption('#life-state', 'alive');
    check(await run(p, (v, y) => Math.abs(v.fish.root.position.y - y) < 1e-8, releasedHeight), backend + ' release preserves safe depth before the blended ascent');
    await run(p, advance, 5);
    check(await run(p, v => v.fish.getState().motionOwner === 'path' && Math.abs(v.fish.root.position.y - 4.5) < 1e-6), backend + ' releasing caught selection explicitly restores surface path');
    await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(160);
    check(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth && ['#mode-slow', '#mode-fast', '#mode-cycle', '#pause'].every(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; })), backend + ' phone controls fit');
    await capture(p, backend, 'phone');
    await p.screenshot({ path: `${out}/${backend}-tank-phone.png` });
    await context.close();
  }
  check(errors.length === 0, 'no browser/shader errors'); check(JSON.stringify(before) === JSON.stringify(await hashes()), 'source stable during Tank validation');
} catch (error) { failure = String(error); throw error; }
finally { await fs.writeFile(out + '/tank-browser-checks.json', JSON.stringify({ passed: !failure, failure, checks, errors, records, sourceHashes: before }, null, 2)); await browser.close(); }
