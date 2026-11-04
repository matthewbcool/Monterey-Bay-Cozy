/** Actual keyboard approach plus held behavior/camera fixtures. Live traversal uses
 * the avatar controller; direct actor probes are explicitly recorded separately. */
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = process.env.ARTIFACT_DIR ?? 'artifacts/gym-gulls-behavior';
const address = new URL(url);
await fs.mkdir(out, { recursive: true });
const paths = ['src/viewer/testingGym/gulls.ts', 'src/viewer/testingGym/gullFlight.ts', 'src/viewer/testingGym/gullEscape.ts', 'src/viewer/testingGym.ts', 'src/viewer/avatarWorkbench.ts', 'src/models/habitat/western-gull/createWesternGull.ts', 'src/models/habitat/western-gull/motion.ts', 'tests/gym-gulls-browser.mjs'];
const hashes = async () => Object.fromEntries(await Promise.all(paths.map(async path => [path, createHash('sha256').update(await fs.readFile(path)).digest('hex')])));
const before = await hashes(), checks = [], errors = [], records = [];
const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); console.log('PASS', label); };
const read = (page, fn, arg) => page.evaluate(({ fn, arg }) => new Function('w', 'arg', `return (${fn})(w,arg)`)(window.gullGym.workbench, arg), { fn: fn.toString(), arg });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });

async function open(backend, phone = false) {
  const context = await browser.newContext({ viewport: phone ? { width: 320, height: 844 } : { width: 1440, height: 1000 }, hasTouch: phone, isMobile: phone, reducedMotion: 'no-preference' });
  await context.routeWebSocket(u => u.hostname === address.hostname && u.port === address.port, socket => socket.send(JSON.stringify({ type: 'connected' })));
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(`${backend}: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error' && /shader|pipeline|wgsl|glsl|validation/i.test(message.text())) errors.push(`${backend}: ${message.text()}`); });
  // Only the visual weather fixture is offline. This run makes no live-data claim.
  await page.route('https://api.weather.gov/**', route => route.abort());
  await page.clock.setFixedTime(new Date('2026-10-26T20:00:00Z'));
  await page.goto(`${url}?tab=gym&whales=hide${backend === 'webgl' ? '&webgl' : ''}`);
  let ready = false;
  for (const deadline = Date.now() + 120000; Date.now() < deadline && !ready;) {
    ready = await page.evaluate(async () => {
      const script = document.querySelector('script[type="module"][src*="/src/main.ts"]');
      if (!script) return false;
      const { viewer } = await import(script.src), w = viewer.avatarWorkbench;
      if (!w?.getSnapshot().gymReady || !w.gym?.gulls) return false;
      window.gullGym = { workbench: w, viewer, scene: w.scene };
      return w.lod.stats(w.gym.gulls.root).ready;
    });
    if (!ready) await page.waitForTimeout(120);
  }
  check(ready, `${backend}${phone ? ' phone' : ''}: Gym and gull detail levels initialized`);
  check(await read(page, w => w.getSnapshot().backend) === (backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'), `${backend}${phone ? ' phone' : ''}: actual renderer confirmed`);
  // Set through the actual menu controls before holding cameras.
  await page.locator('#gym-menu > summary').click();
  await page.locator('.gym-weather > summary').click();
  await page.selectOption('#gym-weather-clock', 'preview');
  await page.locator('#gym-weather-date').fill('2026-10-26T13:00');
  await page.locator('#gym-weather-date').dispatchEvent('change');
  await page.selectOption('#gym-weather-mode', 'clear');
  await page.locator('#gym-menu > summary').click();
  await page.waitForTimeout(250);
  return { context, page };
}

const sample = w => {
  const g = w.gym.gulls;
  g.root.updateWorldMatrix(true, true);
  return {
    ground: g.grounded.map(bird => ({ id: bird.id, sex: bird.sex, walking: bird.walking, phase: bird.escape.phase, visible: bird.root.visible, position: bird.root.position.toArray(), heading: bird.root.rotation.y,
      bones: bird.root.children.find(child => child.isSkinnedMesh)?.skeleton.bones.map(bone => [...bone.position.toArray(), ...bone.quaternion.toArray(), ...bone.scale.toArray()]) })),
    flights: g.flights.map(flight => ({ id: flight.id, visible: flight.flock.root.visible, time: flight.flock.timeSeconds,
      birds: Array.from({ length: flight.flock.count }, (_, index) => {
        const matrix = flight.flock.getTransformAt(index).premultiply(flight.flock.mesh.matrixWorld), e = matrix.elements;
        return { position: [e[12], e[13], e[14]], forward: [-e[8], -e[9], -e[10]] };
      }) })),
  };
};

async function hold(page) {
  await read(page, w => {
    w.setActive(null);
    const g = w.gym.gulls;
    g.setViewer(0, 0, true);
    g.setPlayer(0, 0, 0, false);
    w.camera.near = .05; w.camera.far = 3500; w.camera.fov = 49;
    w.camera.updateProjectionMatrix();
  });
}

/** Walk using the same camera-relative keys as a player, observing only exported
 * state. Explicit waypoints keep this traversal on the clear arrival lawn. */
async function walkTo(page, target, distance = .75, stopOnLift = false) {
  let down = [], reached = false;
  const samples = [], deadline = Date.now() + 20000;
  await page.locator('#gym-viewport canvas').focus();
  try {
    while (Date.now() < deadline) {
      const state = await read(page, w => {
        const bird = w.gym.gulls.grounded[1], e = w.camera.matrixWorld.elements;
        return { avatar: w.avatar.root.position.toArray(), bird: bird.root.position.toArray(), floor: w.gym.groundHeight(bird.root.position.x, bird.root.position.z), forward: [-e[8], -e[10]], stats: w.gym.gulls.stats() };
      });
      samples.push(state);
      const dx = target[0] - state.avatar[0], dz = target[1] - state.avatar[2];
      if ((stopOnLift && state.bird[1] > state.floor + .07) || (!stopOnLift && Math.hypot(dx, dz) <= distance)) { reached = true; break; }
      const [fx, fz] = state.forward, norm = Math.hypot(fx, fz), horizontal = (-fz * dx + fx * dz) / norm, vertical = (fx * dx + fz * dz) / norm;
      const maximum = Math.max(Math.abs(horizontal), Math.abs(vertical)), wanted = [];
      if (Math.abs(horizontal) > maximum * .35) wanted.push(horizontal > 0 ? 'd' : 'a');
      if (Math.abs(vertical) > maximum * .35) wanted.push(vertical > 0 ? 'w' : 's');
      for (const key of down) if (!wanted.includes(key)) await page.keyboard.up(key);
      for (const key of wanted) if (!down.includes(key)) await page.keyboard.down(key);
      down = wanted;
      await page.waitForTimeout(Math.hypot(dx, dz) < 1.4 ? 35 : 90);
    }
  } finally { for (const key of down) await page.keyboard.up(key); }
  if (!reached) records.push({ kind: 'keyboard-navigation-failure', target, samples });
  check(reached, `Keyboard traversal reaches ${stopOnLift ? 'gull takeoff trigger' : target.join(', ')}`);
  return samples;
}

async function takeoffShot(page, backend) {
  await read(page, w => {
    const bird = w.gym.gulls.grounded[1], p = bird.root.position;
    w.camera.position.set(p.x + 2.8, p.y + 1.15, p.z + 2.8);
    w.camera.lookAt(p.x, p.y + .2, p.z); w.lod.setMode('near');
  });
  await render(page);
  await page.locator('#gym-viewport canvas').screenshot({ path: `${out}/${backend}-takeoff.png` });
}

async function approachBird(page, backend) {
  await walkTo(page, [31, -33], .65);
  await walkTo(page, [39, -35], .65);
  const approach = await walkTo(page, [41, -40], 3.5);
  const before = await read(page, w => {
    const b = w.gym.gulls.grounded[1];
    return { avatar: w.avatar.root.position.toArray(), bird: b.root.position.toArray(), phase: b.escape.phase };
  });
  check(before.phase === 'grounded', `${backend}: gull stays grounded while player remains outside its startle distance`);
  const trigger = await walkTo(page, [41, -40], 0, true);
  const retreat = [];
  for (let i = 0; i < 5; i++) {
    retreat.push(await read(page, w => { const b = w.gym.gulls.grounded[1]; return { avatar: w.avatar.root.position.toArray(), bird: b.root.position.toArray(), phase: b.escape.phase }; }));
    if (i < 4) await page.waitForTimeout(90);
  }
  records.push({ backend, kind: 'actual-keyboard-approach', approach, before, trigger, retreat });
  const last = retreat.at(-1), distance = frame => Math.hypot(frame.bird[0] - frame.avatar[0], frame.bird[2] - frame.avatar[2]);
  check(trigger.at(-1).stats.fleeing > 0 || last.phase !== 'grounded', `${backend}: actual nearby avatar triggers gull escape`);
  check(last.bird[1] > before.bird[1] + .12 && distance(last) > distance(retreat[0]) + .15, `${backend}: gull rises and retreats from the actual player`);
  check(retreat.slice(1).every((frame, i) => Math.hypot(...frame.bird.map((v, axis) => v - retreat[i].bird[axis])) < 1.1), `${backend}: takeoff travels continuously without a teleport`);
  await hold(page); await takeoffShot(page, backend);
}

async function actorFixtures(page, backend) {
  const results = await read(page, w => {
    const g = w.gym.gulls, b = g.grounded[2], start = b.root.position.clone(), h = start.y;
    g.setViewer(start.x, start.z, true);
    g.setPlayer(start.x + .3, h + 8, start.z);
    for (let i = 0; i < 10; i++) g.update(.1, true);
    const overhead = b.escape.phase;
    g.setPlayer(start.x + .3, h, start.z, false);
    for (let i = 0; i < 10; i++) g.update(.1, true);
    const disabled = b.escape.phase;
    g.setPlayer(start.x + .3, h, start.z, true);
    for (let i = 0; i < 10; i++) g.update(.1, false);
    const reduced = { phase: b.escape.phase, position: b.root.position.toArray() };
    const frames = [];
    for (let i = 0; i < 12; i++) { g.update(.05, true); frames.push({ phase: b.escape.phase, position: b.root.position.toArray() }); }
    // Occupy the selected destination before descent; the host must keep the gull
    // airborne or choose another safe patch instead of landing through the actor.
    const target = b.escape.target.clone(); g.setPlayer(target.x, target.y, target.z, true);
    let unsafeLanding = false, maxHeight = 0;
    for (let i = 0; i < 160; i++) {
      g.update(.1, true);
      const p = b.root.position, distance = Math.hypot(p.x - target.x, p.z - target.z);
      maxHeight = Math.max(maxHeight, p.y - w.gym.groundHeight(p.x, p.z));
      if (b.escape.phase === 'grounded' && distance < 2.2) unsafeLanding = true;
    }
    const occupied = { phase: b.escape.phase, target: target.toArray(), position: b.root.position.toArray(), unsafeLanding, maxHeight };
    g.setPlayer(0, 0, 0, false);
    return { overhead, disabled, reduced, start: start.toArray(), frames, occupied };
  });
  records.push({ backend, kind: 'held-actor-fixtures', ...results });
  check(results.overhead === 'grounded', `${backend}: a high actor does not frighten a ground gull`);
  check(results.disabled === 'grounded', `${backend}: overview or disabled actor does not frighten a gull`);
  check(results.reduced.phase === 'grounded' && JSON.stringify(results.reduced.position) === JSON.stringify(results.start), `${backend}: reduced motion defers a nearby-player takeoff`);
  check(results.frames.at(-1).phase !== 'grounded' && results.frames.at(-1).position[1] > results.start[1] + .1, `${backend}: enabling motion starts a continuous takeoff`);
  check(!results.occupied.unsafeLanding && results.occupied.maxHeight > .5, `${backend}: occupied destination never receives a landing gull`);
}
async function render(page) {
  return read(page, async w => {
    const scene = window.gullGym.scene;
    w.camera.updateMatrixWorld(true);
    w.weather.update({ time: 12, dt: 60, underwater: false, overview: true, reducedMotion: true, water: w.gym.water });
    w.lod.update(w.camera, w.renderer.domElement.clientHeight, 0, true);
    await w.renderer.compileAsync(scene, w.camera);
    w.renderer.info.autoReset = false; w.renderer.info.reset();
    w.renderer.render(scene, w.camera); w.renderer.render(scene, w.camera);
    return { render: { ...w.renderer.info.render }, stats: w.gym.gulls.stats(), lod: w.lod.stats(w.gym.gulls.root), active: w.lod.inspect(w.gym.gulls.root) };
  });
}
async function groundShot(page, backend, angle = 'coast') {
  await read(page, (w, angle) => {
    const g = w.gym.gulls, bird = g.grounded[0], p = bird.root.position;
    g.setViewer(p.x, p.z, true);
    const offset = { coast: [2.0, .85, 2.6], front: [0, .65, -2.1], side: [-2.2, .65, .2] }[angle];
    w.camera.position.copy(p).add(p.clone().set(...offset));
    w.camera.lookAt(p.x, p.y + .25, p.z); w.lod.setMode('near');
  }, angle);
  await render(page);
  await page.locator('#gym-viewport canvas').screenshot({ path: `${out}/${backend}-ground-${angle}.png` });
}
async function flightShot(page, backend, angle = 'coast') {
  await read(page, (w, angle) => {
    const g = w.gym.gulls, flock = g.flights[0].flock;
    g.setViewer(0, 0, true); g.root.updateWorldMatrix(true, true);
    const matrix = flock.getTransformAt(0).premultiply(flock.mesh.matrixWorld), p = flock.root.position.clone().setFromMatrixPosition(matrix);
    const offset = { coast: [18, 9, 24], side: [2.7, .7, 1.6], underside: [0, -2.7, -1.7] }[angle];
    w.camera.position.copy(p).add(p.clone().set(...offset)); w.camera.lookAt(p.x, p.y + .25, p.z); w.lod.setMode('near');
  }, angle);
  await render(page);
  await page.locator('#gym-viewport canvas').screenshot({ path: `${out}/${backend}-flight-${angle}.png` });
}

try {
  for (const backend of ['webgpu', 'webgl']) {
    const { context, page } = await open(backend);
    const integration = await read(page, w => {
      const g = w.gym.gulls;
      return { stats: g.stats(), ground: g.grounded.length, flight: g.flights.reduce((n, f) => n + f.flock.count, 0), sexes: [...new Set(g.grounded.map(b => b.sex))],
        attached: g.root.parent !== null && g.root.parent === w.gym.root.parent,
        lod: w.lod.stats(g.root) };
    });
    records.push({ backend, kind: 'integration', ...integration });
    check(integration.ground === 6 && integration.flight === 18, `${backend}: six park gulls and eighteen coastal flyers`);
    check(integration.sexes.includes('male') && integration.sexes.includes('female'), `${backend}: both sexes present`);
    check(integration.attached && integration.lod.ready, `${backend}: gull root joins local scene and shared LOD lifecycle`);

    const live = await read(page, sample); await page.waitForTimeout(350);
    const liveMoved = await read(page, sample);
    check(liveMoved.flights.some((f, i) => f.time > live.flights[i].time && JSON.stringify(f.birds) !== JSON.stringify(live.flights[i].birds)), `${backend}: actual Gym frame loop animates the coastal gulls`);
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(120);
    const reduced = await read(page, sample); await page.waitForTimeout(350);
    check(JSON.stringify(reduced) === JSON.stringify(await read(page, sample)), `${backend}: reduced motion freezes travel and poses`);
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(250);
    await page.locator('#tab-objects').click();
    const absent = await read(page, sample); await page.waitForTimeout(300);
    check(JSON.stringify(absent) === JSON.stringify(await read(page, sample)), `${backend}: leaving Gym stops ambient animation`);
    await page.locator('#tab-gym').click(); await page.waitForTimeout(200);
    await page.locator('#gym-menu > summary').click(); await page.locator('#gym-bay-overview').click(); await page.waitForTimeout(120);
    const bay = await read(page, sample); await page.waitForTimeout(250);
    check(JSON.stringify(bay) === JSON.stringify(await read(page, sample)), `${backend}: regional bay overview sleeps local gulls`);
    check(await read(page, w => !w.gym.gulls.root.parent.visible), `${backend}: regional bay overview hides local gull scene`);
    await page.locator('#gym-menu > summary').click(); await page.locator('#gym-bay-overview').click(); await page.waitForTimeout(120);
    await approachBird(page, backend);
    await actorFixtures(page, backend);

    const start = await read(page, sample);
    await read(page, w => { w.gym.gulls.update(.05, true); });
    const moved = await read(page, sample);
    const travel = moved.flights.flatMap((flight, f) => flight.birds.map((bird, b) => {
      const initial = start.flights[f].birds[b], delta = bird.position.map((v, i) => v - initial.position[i]);
      const distance = Math.hypot(...delta), heading = delta.reduce((s, v, i) => s + v * bird.forward[i], 0) / Math.max(1e-9, distance * Math.hypot(...bird.forward));
      return { id: flight.id, bird: b, distance, heading };
    }));
    records.push({ backend, kind: 'travel', birds: travel });
    check(travel.every(b => b.distance > .04 && b.distance < .3 && b.heading > .98), `${backend}: all flyers move forward at a slower coastal pace`);
    check(new Set(travel.map(b => b.distance.toFixed(4))).size >= 9, `${backend}: coastal birds have independent travel speeds`);
    const variedRoutes = await read(page, w => {
      const g = w.gym.gulls, first = g.root.position.clone(), next = first.clone(), direction = first.clone(), time = g.stats().elapsed;
      return g.flights.map(cell => ({ id: cell.id, directions: [...new Set(cell.routes.members.map(m => m.direction))], drift: cell.routes.members.map((m, slot) => {
        cell.routes.sample(slot, time, first, direction); cell.routes.sample(slot, time + m.circuitSeconds, next, direction);
        return first.distanceTo(next);
      }) }));
    });
    records.push({ backend, kind: 'independent-route-variation', cells: variedRoutes });
    check(variedRoutes.every(cell => cell.directions.length === 2 && cell.drift.every(distance => distance > .1)), `${backend}: independent coastal paths drift between circuits and travel in both directions`);
    // The arrival bird starts a short stroll; retain both travel and gait evidence.
    let walking = moved.ground.some((bird, i) => bird.walking && bird.phase === 'grounded' && Math.hypot(...bird.position.map((v, j) => v - start.ground[i].position[j])) > .01 && JSON.stringify(bird.bones) !== JSON.stringify(start.ground[i].bones));
    for (let i = 0; i < 300 && !walking; i++) {
      const a = await read(page, sample); await read(page, w => w.gym.gulls.update(.1, true)); const b = await read(page, sample);
      walking = b.ground.some((bird, k) => bird.walking && bird.phase === 'grounded' && Math.hypot(...bird.position.map((v, j) => v - a.ground[k].position[j])) > .01 && JSON.stringify(bird.bones) !== JSON.stringify(a.ground[k].bones));
    }
    check(walking, `${backend}: park gull stroll changes both position and leg pose`);
    const paused = await read(page, sample);
    await read(page, w => { for (let i = 0; i < 10; i++) w.gym.gulls.update(.1, false); });
    check(JSON.stringify(paused) === JSON.stringify(await read(page, sample)), `${backend}: animation-off update holds exact poses and paths`);
    await read(page, w => w.gym.gulls.setViewer(100000, 100000));
    const sleeping = await read(page, sample);
    check(sleeping.ground.every(b => !b.visible) && sleeping.flights.every(f => !f.visible), `${backend}: distant gulls leave rendering interest`);
    await read(page, w => { for (let i = 0; i < 10; i++) w.gym.gulls.update(.1, true); });
    check(JSON.stringify(sleeping) === JSON.stringify(await read(page, sample)), `${backend}: distant gulls sleep without background animation`);
    await read(page, w => w.gym.gulls.setViewer(0, 0, true));
    const resumed = await read(page, sample);
    check(resumed.ground.every(b => b.visible) && resumed.flights.every(f => f.visible), `${backend}: returning restores existing gull instances`);
    await read(page, w => w.gym.gulls.update(.1, true));
    check(JSON.stringify(resumed) !== JSON.stringify(await read(page, sample)), `${backend}: returning resumes movement`);

    for (const angle of ['coast', 'front', 'side']) await groundShot(page, backend, angle);
    for (const angle of ['coast', 'side', 'underside']) await flightShot(page, backend, angle);

    // Frame the existing population as one whole, then count only its contribution.
    await read(page, w => {
      const g = w.gym.gulls, box = g.flights[0].flock.bounds.clone().setFromObject(g.root), center = box.getCenter(g.root.position.clone()), size = box.getSize(center.clone());
      const radius = Math.max(size.x, size.y, size.z) * 1.1;
      w.camera.position.copy(center).add(center.clone().set(.2, 1.3, 1).normalize().multiplyScalar(radius));
      w.camera.lookAt(center); w.renderer.shadowMap.enabled = false;
    });
    for (const level of ['near', 'mid', 'far']) {
      await read(page, (w, level) => w.lod.setMode(level), level); await render(page);
      const row = await read(page, w => {
        const scene = window.gullGym.scene, g = w.gym.gulls;
        w.renderer.info.reset(); w.renderer.render(scene, w.camera); const full = { ...w.renderer.info.render };
        g.root.visible = false; w.renderer.info.reset(); w.renderer.render(scene, w.camera); const hidden = { ...w.renderer.info.render }; g.root.visible = true;
        return { level: w.lod.mode, lod: w.lod.stats(g.root), draws: full.drawCalls - hidden.drawCalls, triangles: full.triangles - hidden.triangles };
      });
      records.push({ backend, kind: 'measured-population', ...row });
      check(row.draws === 9 && row.triangles === row.lod[level].triangles, `${backend}: ${level} population submits nine draws and exact reported triangles`);
    }
    for (const [distance, expected] of [[2, 'near'], [35, 'mid'], [300, 'far'], [2, 'near']]) {
      const state = await read(page, (w, distance) => {
        const g = w.gym.gulls, b = g.grounded[0], p = b.root.position;
        w.camera.position.set(p.x, p.y + .34, p.z + distance); w.camera.lookAt(p.x, p.y + .34, p.z); w.camera.updateMatrixWorld(true);
        w.lod.setMode('auto'); w.lod.update(w.camera, 1000, 0, true); return w.lod.inspect(b.root)[0];
      }, distance);
      records.push({ backend, kind: 'automatic-ground-lod', distance, ...state });
      check(state.level === expected, `${backend}: automatic ${distance} m ground LOD is ${expected}`);
    }
    for (const [distance, expected] of [[2, 'near'], [45, 'mid'], [1000, 'far'], [2, 'near']]) {
      const state = await read(page, (w, distance) => {
        const cell = w.gym.gulls.flights[0], flock = cell.flock; flock.root.updateWorldMatrix(true, true);
        const matrix = flock.getTransformAt(0).premultiply(flock.mesh.matrixWorld), p = cell.center.clone().setFromMatrixPosition(matrix);
        const normal = cell.normal.clone();
        if (p.clone().sub(cell.center).dot(normal) < 0) normal.negate();
        w.camera.position.copy(p).add(normal.multiplyScalar(distance)); w.camera.lookAt(p); w.camera.updateMatrixWorld(true);
        w.lod.setMode('auto'); w.lod.update(w.camera, 1000, 0, true); return w.lod.inspect(flock.root)[0];
      }, distance);
      records.push({ backend, kind: 'automatic-flight-lod', distance, ...state });
      check(state.level === expected, `${backend}: automatic ${distance} m sky LOD is ${expected}`);
    }
    await context.close();
  }
  const { context, page } = await open('webgl', true);
  await approachBird(page, 'phone-320'); await groundShot(page, 'phone-320', 'coast');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '320px touch Gym has no horizontal overflow');
  await flightShot(page, 'phone-320', 'coast');
  await context.close();
  check(errors.length === 0, `No browser/shader errors: ${errors.slice(0, 4).join(' | ')}`);
  const after = await hashes();
  check(JSON.stringify(before) === JSON.stringify(after), 'Integration source stayed stable during final capture');
  await fs.writeFile(`${out}/browser-metrics.json`, JSON.stringify({ date: new Date().toISOString(), checks, errors, records, sourceHashes: { before, after } }, null, 2) + '\n');
} finally {
  await fs.writeFile(`${out}/browser-progress.json`, JSON.stringify({ checks, errors, records }, null, 2) + '\n');
  await browser.close();
}
console.log(`PASS ${checks.length} Gym gull browser checks`);
