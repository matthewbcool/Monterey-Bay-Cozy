import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = process.env.ARTIFACT_DIR ?? 'artifacts/gym-reef-current';
await fs.mkdir(out, { recursive: true });
const sources = ['src/viewer/avatarWorkbench.ts', 'src/viewer/nodeStyle.ts', 'src/viewer/testingGym/reef.ts', 'src/viewer/water.ts', 'src/viewer/gymWeatherSystem.ts', 'tests/gym-reef-browser.mjs', 'src/models/habitat/anemone/createAnemone.ts', 'src/models/habitat/anemone/definition.ts', 'src/models/habitat/anemone/giantGreenGeometry.ts'];
async function sourceHash() {
  const digest = createHash('sha256');
  for (const path of sources) digest.update(path).update(await fs.readFile(path));
  return digest.digest('hex');
}
const before = await sourceHash(), results = [];
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
try {
  for (const backend of ['webgpu', 'webgl']) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 800 } }), errors = [];
    await page.route('https://api.weather.gov/**', route => route.abort());
    await page.routeWebSocket(u => u.hostname === '127.0.0.1' && u.port === '5191' && u.searchParams.has('token'), socket => socket.send(JSON.stringify({ type: 'connected' })));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /shader|wgsl|glsl|compile|render pipeline|validation/i.test(message.text())) errors.push(message.text());
    });
    await page.goto(`${url}?tab=gym${backend === 'webgl' ? '&webgl' : ''}`);
    await page.waitForFunction(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      return viewer.avatarWorkbench?.getSnapshot().gymReady && viewer.avatarWorkbench.getSnapshot().backend;
    }, undefined, { timeout: 45000 });
    await page.locator('#gym-menu > summary').click();
    await page.locator('.gym-weather > summary').click();
    await page.selectOption('#gym-weather-mode', 'clear');
    await page.selectOption('#gym-weather-clock', 'preview');
    await page.locator('#gym-weather-date').fill('2026-10-23T13:00');
    await page.locator('#gym-weather-date').dispatchEvent('change');
    await page.locator('#gym-menu > summary').click();
    await page.waitForTimeout(200);
    // The regional bay wraps the local roots in a visibility group. Retain the actual
    // Scene before setActive(null) pauses the workbench and its scene getter changes.
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      window.gymReefReviewScene=viewer.avatarWorkbench.scene;
    });
    const metrics = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench, scene = window.gymReefReviewScene, reef = w.gym.reef, c = reef.center;
      w.setActive(null);
      reef.setViewer(c.x, c.z);
      w.camera.position.set(c.x + 14, -.4, c.z + 8);
      w.camera.lookAt(c.x, -2, c.z);
      w.camera.updateMatrixWorld(true);
      scene.fog.color.set('#2e6f78'); scene.fog.near=.8; scene.fog.far=24; scene.background=scene.fog.color.clone();
      w.weather.update({time:12,dt:60,underwater:true,overview:false,reducedMotion:false,water:w.gym.water});
      const kelp = reef.root.children.filter(o => o.name.startsWith('gym-reef-kelp-'));
      const levels = [];
      for (const mode of ['near', 'mid', 'far', 'auto']) {
        w.lod.setMode(mode);
        w.lod.update(w.camera, 800, 0, true);
        await w.renderer.compileAsync(scene, w.camera);
        w.renderer.render(scene, w.camera); // warm light transforms before measuring the held frame
        w.renderer.info.reset();
        w.renderer.render(scene, w.camera);
        levels.push({ mode, reef: reef.stats(), submitted: {
          draws: w.renderer.info.render.drawCalls,
          triangles: w.renderer.info.render.triangles,
        } });
      }
      return { backend: w.getSnapshot().backend, active: reef.active, kelp: kelp.map(o => ({ count: o.count, sway: !!o.material.positionNode })), levels };
    });
    await page.locator('#gym-viewport canvas').screenshot({ path: `${out}/${backend}-reef-auto.png` });
    metrics.surface = await page.evaluate(async () => {
      const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w = viewer.avatarWorkbench, c = w.gym.reef.center, scene = window.gymReefReviewScene;
      w.camera.position.set(c.x + 18, 5, c.z + 12);
      w.camera.lookAt(c.x, 1, c.z);
      w.camera.updateMatrixWorld(true);
      w.weather.update({time:12,dt:60,underwater:false,overview:false,reducedMotion:false,water:w.gym.water});
      w.lod.update(w.camera, 800, 0, true);
      await w.renderer.compileAsync(scene, w.camera);
      w.renderer.render(scene, w.camera);
      w.renderer.info.reset(); w.renderer.render(scene, w.camera);
      return { draws: w.renderer.info.render.drawCalls, triangles: w.renderer.info.render.triangles };
    });
    await page.locator('#gym-viewport canvas').screenshot({ path: `${out}/${backend}-reef-surface.png` });
    // Reproduce the sorting failure: look upward at oral tissue with opaque ocean behind it.
    // The bell is hidden here so it cannot conceal a missing tissue pass.
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench,scene=window.gymReefReviewScene;
      const jellies=w.gym.reef.swimmers.filter(s=>s.model.root.userData.assetId==='moon-jelly').map(s=>s.model.root);
      jellies.forEach((j,i)=>j.visible=i===0);const jelly=jellies[0],p=jelly.position;
      w.camera.position.set(p.x+.18,p.y-.25,p.z+.18);w.camera.lookAt(p);w.camera.near=.03;w.camera.updateProjectionMatrix();w.camera.updateMatrixWorld(true);
      scene.fog.color.set('#2e6f78');scene.fog.near=.8;scene.fog.far=24;scene.background=scene.fog.color.clone();
      w.weather.update({time:12,dt:60,underwater:true,overview:false,reducedMotion:false,water:w.gym.water});
      w.lod.setMode('near');w.lod.update(w.camera,800,0,true);
      jelly.children.find(m=>m.name==='moon-jelly-bell').visible=false;
      await w.renderer.compileAsync(scene,w.camera);w.renderer.render(scene,w.camera);w.renderer.render(scene,w.camera);
    });
    const tissue=await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-jelly-tissue.png`});
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench;w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root.visible=false;w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    const noTissue=await page.locator('#gym-viewport canvas').screenshot();
    assert(!tissue.equals(noTissue),'jelly tissue remains visible against water behind it');
    // Negative control: the former transparent-water ordering must erase this same tissue.
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench;w.gym.water.material.transparent=true;w.gym.water.material.needsUpdate=true;
      w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root.visible=true;
      await w.renderer.compileAsync(window.gymReefReviewScene,w.camera);w.renderer.render(window.gymReefReviewScene,w.camera);w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    const legacyTissue=await page.locator('#gym-viewport canvas').screenshot();
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench;w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root.visible=false;w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    const legacyHidden=await page.locator('#gym-viewport canvas').screenshot();
    assert(legacyTissue.equals(legacyHidden),'negative control reproduces tissue erased by former ordering');
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench,j=w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root;
      w.gym.water.material.transparent=false;w.gym.water.material.needsUpdate=true;
      j.visible=true;j.children.forEach(m=>m.visible=true);await w.renderer.compileAsync(window.gymReefReviewScene,w.camera);w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-jelly-below.png`});
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench,p=w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root.position;
      w.camera.position.set(p.x+.18,1.6,p.z+.18);w.camera.lookAt(p);w.camera.updateMatrixWorld(true);
      w.renderer.render(window.gymReefReviewScene,w.camera);w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    const above=await page.locator('#gym-viewport canvas').screenshot({path:`${out}/${backend}-jelly-surface-occlusion.png`});
    await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench;w.gym.reef.swimmers.find(s=>s.model.root.userData.assetId==='moon-jelly').model.root.visible=false;w.renderer.render(window.gymReefReviewScene,w.camera);
    });
    assert(above.equals(await page.locator('#gym-viewport canvas').screenshot()),'surface still occludes the submerged jelly from above');
    metrics.caustics=await page.evaluate(async () => {
      const {viewer}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
      const w=viewer.avatarWorkbench,c=w.weather.environment.caustics,graph=w.gym.water.material.colorNode;
      const result={};
      for(const [name,mode,date] of [['clear','clear','2026-10-23T13:00'],['overcast','overcast','2026-10-23T13:00'],['fog','fog','2026-10-23T13:00'],['night','clear','2026-10-23T21:30']]){
        for(const [id,value] of [['gym-weather-mode',mode],['gym-weather-date',date]]){const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}
        w.weather.update({time:12,dt:60,underwater:true,overview:false,reducedMotion:false,water:w.gym.water});result[name]=c.illumination.value;
      }
      result.sameGraph=graph===w.gym.water.material.colorNode;w.weather.setActive(false);result.inactive=c.illumination.value;return result;
    });
    assert(metrics.caustics.clear>.8);assert(metrics.caustics.overcast<.01);assert.equal(metrics.caustics.fog,0);assert.equal(metrics.caustics.night,0);assert.equal(metrics.caustics.inactive,0);assert(metrics.caustics.sameGraph);
    assert.equal(metrics.backend, backend === 'webgpu' ? 'WebGPU' : 'WebGL 2');
    assert(metrics.active && metrics.kelp.length === 3 && metrics.kelp.every(k => k.count === 8 && k.sway));
    assert.equal(metrics.levels[0].reef.draws, 42);
    assert.equal(metrics.levels[0].reef.triangles, 78_466);
    assert(metrics.levels[2].reef.triangles < metrics.levels[1].reef.triangles && metrics.levels[1].reef.triangles < metrics.levels[0].reef.triangles);
    assert(metrics.levels.every(l => l.submitted.draws > 0 && l.submitted.triangles > 0));
    assert(metrics.surface.draws > 0 && metrics.surface.triangles > 0);
    assert.deepEqual(errors, []);
    results.push({ ...metrics, errors });
    console.log(`PASS ${metrics.backend}: 24 kelp, Near/Far/Auto, visible jelly tissue, weather caustics and renderer counters`);
    await page.close();
  }
  assert.equal(await sourceHash(), before, 'sources stayed stable during browser checks');
} finally {
  await fs.writeFile(`${out}/browser-metrics.json`, JSON.stringify({ date: new Date().toISOString(), url, sourceHash: before, results,
    note: 'Chrome on this Mac with clear weather and an October 23, 2026 13:00 Pacific preview. Renderer totals include the visible gym, avatar, sky and output pass. Underwater fixtures explicitly apply the player fog range (0.8–24 m) and warm lighting transforms before captures. Weather requests are blocked; preview conditions supply the fixture. The earlier before folder used the old fixture and is historical, not a pixel-identical comparison. Reef stats include all visible reef meshes before camera culling. LOD stats are runtime geometry counts, not GPU memory or physical-phone performance.' }, null, 2) + '\n');
  await browser.close();
}
