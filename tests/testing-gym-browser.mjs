import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
// The gym keeps its tools in one menu; open it before using a menu control. Touch pages tap.
async function openMenu(page,tap=false){if(!await page.locator('#gym-menu').evaluate(e=>e.open)){const s=page.locator('#gym-menu > summary');await(tap?s.tap():s.click());}}
async function menuClick(page,selector,tap=false){await openMenu(page,tap);const l=page.locator(selector);await(tap?l.tap():l.click());}

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = process.env.ARTIFACT_DIR ?? 'artifacts/testing-gym';
await fs.mkdir(out, { recursive: true });
async function sourceSnapshot(label) {
  const paths = new Set([
    'tests/testing-gym-browser.mjs', 'src/main.ts', 'src/viewer/testingGym.ts',
    'src/viewer/avatarWorkbench.ts', 'src/viewer/avatarWorkbench.css', 'src/viewer/avatarController.ts',
    'src/viewer/water.ts', 'src/viewer/sky.ts', 'src/viewer/nodeStyle.ts',
    'src/models/shared/style.ts', 'src/models/shared/staticAsset.ts',
    'src/models/shared/lod/controller.ts', 'src/models/shared/lod/geometry.ts',
    'package.json', 'package-lock.json',
  ]);
  async function collect(directory) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${item.name}`;
      if (item.isDirectory()) await collect(path);
      else if (item.isFile()) paths.add(path);
    }
  }
  await collect('src/viewer/testingGym');
  for (const name of await fs.readdir('src/data')) if (name.startsWith('lovers-point')) paths.add(`src/data/${name}`);
  const files = await Promise.all([...paths].sort().map(async path => {
    const bytes = await fs.readFile(path);
    return { path, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
  }));
  return { label, capturedAt: new Date().toISOString(), sha256: createHash('sha256').update(JSON.stringify(files)).digest('hex'), files };
}
const sourceBefore = await sourceSnapshot('before'), sourceSnapshots = [sourceBefore];
let sourceAfter, activeSourceHash = sourceBefore.sha256;
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const checks = [], errors = [], measurements = [], remoteImages = [];
let activePage;
function check(condition, label) {
  if (!condition) throw new Error(label);
  checks.push(label); console.log('PASS', label);
}
function observe(page, label) {
  activePage = page;
  page.on('pageerror', error => errors.push(`${label}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('ERR_CERT_AUTHORITY_INVALID')) errors.push(`${label}: ${message.text()}`); });
  page.on('request', request => {
    if (request.resourceType() === 'image' && /^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(url).origin) remoteImages.push(request.url());
  });
}
async function stableContext(options) {
  const context = await browser.newContext(options), preview = new URL(url);
  // Other chats share this dev server. Keep each QA page on the source revision
  // it loaded; source/report writes must not trigger a mid-measurement reload.
  // Only Vite's token-authenticated local HMR socket is mocked. HTTP/module loads
  // and any future application sockets remain untouched.
  await context.routeWebSocket(socketUrl => socketUrl.hostname === preview.hostname && socketUrl.port === preview.port && socketUrl.searchParams.has('token'), socket => {
    socket.send(JSON.stringify({ type: 'connected' }));
  });
  return context;
}
// Import the script URL already loaded by Vite, including its revision query.
// Importing a different entry URL would construct a second viewer.
const read = (page, fn, arg) => page.evaluate(async ({ fn, arg }) => {
  const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
  const w = viewer.avatarWorkbench;
  if (!w) throw new Error('Avatar workbench did not initialize');
  await w.ready;
  return new Function('w', 'arg', `return (${fn})(w, arg)`)(w, arg);
}, { fn: fn.toString(), arg });

async function ready(page) {
  await page.locator('#gym-overview').waitFor({ state: 'attached', timeout: 45000 });
  await page.waitForFunction(async () => {
    const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    const w = viewer.avatarWorkbench;
    return w?.getSnapshot().backend && w.gym && w.lod.stats(w.gym.root).ready;
  }, undefined, { timeout: 45000 });
  await page.waitForTimeout(350);
}

async function resume(page) {
  await read(page, w => w.setActive('gym'));
  await page.waitForTimeout(180);
}

async function capture(page, backend, view, mode, camera) {
  const result = await read(page, async (w, { view, mode, camera }) => {
    // Retain the gym scene before stopping its loop: the getter chooses the
    // studio when no workbench tab is active.
    const scene = w.scene, renderer = w.renderer;
    w.setActive(null);
    if (camera) {
      const height = camera.terrainRelative ? w.gym.terrainHeight(camera.target[0], camera.target[2]) : 0;
      w.camera.position.set(camera.position[0], camera.position[1] + height, camera.position[2]);
      w.camera.lookAt(camera.target[0], camera.target[1] + height, camera.target[2]);
      if (camera.near !== undefined) w.camera.near = camera.near;
      if (camera.far !== undefined) w.camera.far = camera.far;
      if (camera.fog && scene.fog) { scene.fog.near = camera.fog.near; scene.fog.far = camera.fog.far; }
      w.camera.updateProjectionMatrix();
      w.camera.updateMatrixWorld(true);
    }
    scene.getObjectByName('Gradient sky dome')?.position.copy(w.camera.position);
    w.gym.update(0);
    scene.updateMatrixWorld(true);
    w.lod.setMode(mode);
    w.lod.update(w.camera, renderer.domElement.clientHeight, 0, true);
    await renderer.compileAsync(scene, w.camera);
    const submittedScene = [], originals = [], worldMeshes = new Set();
    w.gym.root.traverse(object => {
      if (object.isMesh) worldMeshes.add(object);
    });
    scene.traverse(object => {
      if (!object.isMesh) return;
      const original = object.onBeforeRender;
      originals.push([object, original]);
      object.onBeforeRender = function (...args) {
        const doublePass = object.material.transparent && object.material.side === 2 && !object.material.forceSinglePass;
        submittedScene.push({ name: object.name, uuid: object.uuid, world: worldMeshes.has(object), passes: doublePass ? 2 : 1, instances: object.isInstancedMesh ? object.count : 1,
          triangles: (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1),
          spatialCell: object.userData.spatialCell ?? object.parent?.userData.spatialCell ?? null });
        original.apply(this, args);
      };
    });
    const previousAutoReset = renderer.info.autoReset;
    let render;
    try {
      renderer.info.autoReset = false; renderer.info.reset(); renderer.render(scene, w.camera);
      render = { drawCalls: renderer.info.render.drawCalls, frameCalls: renderer.info.render.frameCalls, triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
    } finally {
      for (const [object, original] of originals) object.onBeforeRender = original;
      renderer.info.autoReset = previousAutoReset;
    }
    const levels = w.lod.inspect(w.gym.root), byName = new Map(levels.map(item => [item.name, item]));
    return { view, mode, backend: w.getSnapshot().backend, camera: { position: w.camera.position.toArray(), fov: w.camera.fov, aspect: w.camera.aspect, near: w.camera.near, far: w.camera.far,
        fog: scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null },
      world: w.lod.stats(w.gym.root), render,
      submitted: submittedScene.filter(item => item.world).map(item => ({ ...item, level: byName.get(item.name)?.level, projectedPixels: byName.get(item.name)?.pixels })),
      submittedScene, accountedSceneTriangles: submittedScene.reduce((total, item) => total + item.triangles * item.passes, 0),
      avatarPosition: w.avatar.root.position.toArray(), colliders: w.gym.colliders.length, instances: submittedScene.filter(item => item.instances > 1).length };
  }, { view, mode, camera });
  result.sourceHash = activeSourceHash;
  await page.screenshot({ path: `${out}/${backend}-${view}-${mode}.png` });
  measurements.push(result);
  await resume(page);
  return result;
}

try {
  for (const backend of ['webgpu', 'webgl']) {
    const sources = await sourceSnapshot(backend + ' navigation');
    sourceSnapshots.push(sources); activeSourceHash = sources.sha256;
    const context = await stableContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); observe(page, backend);
    await page.goto(`${url}?tab=gym&quality=standard${backend === 'webgl' ? '&webgl' : ''}`, { waitUntil: 'networkidle' });
    await ready(page);
    const state = await read(page, w => w.getSnapshot());
    check(state.backend === (backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'), `${backend}: actual rendering backend`);
    check(await page.locator('#tab-gym').getAttribute('aria-selected') === 'true' && state.active === 'gym', `${backend}: Testing Gym opens directly`);
    const groundState=await read(page,w=>{const surfaces=[];w.gym.root.traverse(o=>{if(o.userData.singleGroundSurface)surfaces.push({depthWrite:o.material.depthWrite,bias:o.material.polygonOffset,unpainted:o.userData.unpaintedArea});});return surfaces;});
    check(groundState.length===1 && groundState[0].depthWrite && !groundState[0].bias && groundState[0].unpainted===0, `${backend}: terrain is one complete depth-writing surface without decal bias`);
    const playerAuto = await capture(page, backend, 'player', 'auto');
    check(playerAuto.render.drawCalls > 0 && playerAuto.render.triangles > 0, `${backend}: player scene submits real geometry`);
    check(playerAuto.render.triangles - playerAuto.accountedSceneTriangles >= 0 && playerAuto.render.triangles - playerAuto.accountedSceneTriangles <= 1, `${backend}: renderer triangles reconcile with visible meshes and output pass`);
    await menuClick(page,'.gym-performance summary');
    check(await page.locator('#gym-lod-rows tr').count() === 3, `${backend}: all world detail variants are displayed`);
    const rows = await page.locator('#gym-lod-rows tr').evaluateAll(rows => rows.map(row => [...row.cells].map(cell => cell.textContent.replaceAll(',', '').trim())));
    for (const [level, count, draws] of rows) {
      check(Number(count) === playerAuto.world[level].triangles && Number(draws) === playerAuto.world[level].draws, `${backend}: ${level} UI counters match the world buffers`);
    }
    check((await page.locator('#gym-storage').textContent()).includes('MiB'), `${backend}: geometry storage is disclosed`);
    const variants = [];
    for (const level of ['near', 'mid', 'far']) {
      await openMenu(page,false);await page.selectOption('#gym-lod', level);
      await page.waitForTimeout(180);
      variants.push(await capture(page, backend, 'player', level));
    }
    check(variants[2].world.far.triangles < variants[1].world.mid.triangles && variants[1].world.mid.triangles < variants[0].world.near.triangles, `${backend}: every world LOD reduces triangles`);
    check(variants[2].render.triangles < variants[1].render.triangles && variants[1].render.triangles < variants[0].render.triangles, `${backend}: forced LOD lowers actual submitted player-view triangles`);
    check(new Set(variants.map(item => item.render.drawCalls)).size === 1, `${backend}: forced LOD adds no rendering passes`);
    check(variants.every(item => JSON.stringify(item.avatarPosition) === JSON.stringify(playerAuto.avatarPosition) && item.colliders === playerAuto.colliders), `${backend}: inspection retains avatar placement and collision count`);
    await openMenu(page,false);await page.selectOption('#gym-lod', 'auto');
    await menuClick(page,'.gym-performance summary');
    await menuClick(page,'#gym-overview');
    check(await page.locator('#gym-overview').getAttribute('aria-pressed') === 'true', `${backend}: overview button enters the park view`);
    await page.waitForTimeout(350);
    const overviewCamera = await read(page, w => ({ position: w.camera.position.toArray(), target: [0, 0, -15], near: w.camera.near, far: w.camera.far,
      fog: w.scene.fog ? { near: w.scene.fog.near, far: w.scene.fog.far } : null }));
    check(overviewCamera.near >= 1 && overviewCamera.far > overviewCamera.near, `${backend}: overview uses a depth range suited to its distance`);
    const overview = await capture(page, backend, 'overview', 'auto', overviewCamera);
    check(overview.submitted.some(item => item.spatialCell && ['mid', 'far'].includes(item.level)), `${backend}: visible distant scenery automatically uses reduced detail`);
    const overviewNear = await capture(page, backend, 'overview', 'near', overviewCamera);
    check(overview.render.triangles < overviewNear.render.triangles && overview.render.drawCalls === overviewNear.render.drawCalls, `${backend}: overview Auto saves submitted triangles without extra draws`);
    await read(page, w => w.lod.setMode('auto'));
    await menuClick(page,'#gym-overview'); await menuClick(page,'#gym-overview');
    check(await page.locator('#gym-overview').getAttribute('aria-pressed') === 'false', `${backend}: overview returns to walking view`);
    check(await read(page, w => w.camera.near === .25 && w.camera.far === 600), `${backend}: walking restores the close camera clipping range`);
    check(JSON.stringify(await read(page, w => w.avatar.root.position.toArray())) === JSON.stringify(playerAuto.avatarPosition), `${backend}: changing the camera does not move the player`);
    // Camera-only inspection views, never a teleport or an altered gameplay route.
    await capture(page, backend, 'beach-house', 'auto', { position: [28, 15, 45], target: [-9, 3.7, 14], terrainRelative: true });
    await capture(page, backend, 'beach-house', 'near', { position: [28, 15, 45], target: [-9, 3.7, 14], terrainRelative: true });
    await capture(page, backend, 'beach-house', 'far', { position: [28, 15, 45], target: [-9, 3.7, 14], terrainRelative: true });
    await capture(page, backend, 'path-grazing', 'auto', { position: [39, 2.3, -42], target: [5, .4, -39], terrainRelative: true });
    await capture(page, backend, 'point', 'auto', { position: [168, 30, -86], target: [111, 2, -132], terrainRelative: true });
    await capture(page, backend, 'pool-court', 'auto', { position: [29, 35, 85], target: [-10, .5, 51], terrainRelative: true });
    await menuClick(page,'#gym-overview'); await page.locator('#gym-back').click();
    check(await read(page, w => w.getSnapshot().active === 'avatars' && w.camera.near === .05 && w.camera.far === 600), `${backend}: creator restores close framing after leaving overview`);
    await context.close();
  }

  const phoneSources = await sourceSnapshot('phone navigation'); sourceSnapshots.push(phoneSources); activeSourceHash = phoneSources.sha256;
  const context = await stableContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); observe(page, 'phone');
  await page.goto(`${url}?tab=gym&webgl`, { waitUntil: 'networkidle' }); await ready(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(200);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: gym has no horizontal overflow`);
    await openMenu(page, true); const button = await page.locator('#gym-overview').boundingBox();
    check(button && button.x >= 0 && button.x + button.width <= width, `${width}px: overview control fits the screen`);
    await menuClick(page,'#gym-overview',true);
    check(await page.locator('#gym-overview').getAttribute('aria-pressed') === 'true', `${width}px: overview works with touch`);
    check(await read(page, w => w.camera.near >= 1), `${width}px: distant overview preserves terrain depth precision`);
    await page.waitForTimeout(200); await page.screenshot({ path: `${out}/phone-${width}-overview.png` });
    await menuClick(page,'#gym-overview',true);
    check(await read(page, w => w.camera.near === .25), `${width}px: walking restores near visibility`);
    await menuClick(page,'.gym-performance summary',true);
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}px: expanded detail table stays within the screen`);
    await openMenu(page,false);await page.selectOption('#gym-lod', 'far');
    check(await page.locator('#gym-lod-rows tr').count() === 3, `${width}px: detail variants remain inspectable`);
    await page.screenshot({ path: `${out}/phone-${width}-details.png` });
    await openMenu(page,false);await page.selectOption('#gym-lod', 'auto'); await menuClick(page,'.gym-performance summary',true);
  }
  await context.close();
  check(errors.length === 0, 'No browser or shader errors: ' + errors.join('; '));
  check(remoteImages.length === 0, 'No remote photo textures are downloaded');
  sourceAfter = await sourceSnapshot('after'); sourceSnapshots.push(sourceAfter);
  check(sourceSnapshots.every(snapshot => snapshot.sha256 === sourceBefore.sha256), 'Gym sources stayed unchanged throughout the browser checks');
  await fs.rm(`${out}/failure.png`, { force: true });
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: `${out}/failure.png` }).catch(() => {});
  throw error;
} finally {
  if (!sourceAfter) { sourceAfter = await sourceSnapshot('after'); sourceSnapshots.push(sourceAfter); }
  const initialFiles = new Map(sourceBefore.files.map(file => [file.path, file.sha256]));
  const finalFiles = new Map(sourceAfter.files.map(file => [file.path, file.sha256]));
  const changedFiles = [...new Set([...initialFiles.keys(), ...finalFiles.keys()])].filter(path => initialFiles.get(path) !== finalFiles.get(path));
  await fs.writeFile(`${out}/browser-metrics.json`, JSON.stringify({ date: new Date().toISOString(), url, checks, errors, measurements, remoteImages,
    sources: { algorithm: 'sha256', stable: sourceSnapshots.every(snapshot => snapshot.sha256 === sourceBefore.sha256), changedFiles, snapshots: sourceSnapshots },
    note: 'Chrome on this Mac, native WebGPU and forced WebGL 2. Each page uses a development snapshot with only the local Vite HMR socket disabled; HTTP/module loads are untouched. Source hashes identify the gym, components/data, renderer styling, workbench and test runner before each navigation and after the run. A source change fails the stability check. Submitted counters include the avatar, sky and color output; world variant counts include offscreen batches. Phone viewport/touch emulation is not physical-device performance profiling.' }, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${checks.length} Testing Gym browser checks`);
