import { chromium } from 'playwright';
import fs from 'node:fs/promises';
// The gym keeps its tools in one menu; open it before using a menu control. Touch pages tap.
async function openMenu(page,tap=false){if(!await page.locator('#gym-menu').evaluate(e=>e.open)){const s=page.locator('#gym-menu > summary');await(tap?s.tap():s.click());}}
async function menuClick(page,selector,tap=false){await openMenu(page,tap);const l=page.locator(selector);await(tap?l.tap():l.click());}

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const output = 'artifacts/gym-boat';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true, args: ['--enable-unsafe-webgpu'] });
const checks = [], errors = [];
function check(value, label) { if (!value) throw new Error(label); checks.push(label); console.log('PASS', label); }
const read = (page, fn) => page.evaluate(async serialized => {
  const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
  const gym = viewer.avatarWorkbench; await gym.ready;
  return new Function('w', `return (${serialized})(w)`)(gym);
}, fn.toString());
async function ready(page) {
  await page.waitForFunction(async () => {
    const { viewer } = await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);
    return viewer.avatarWorkbench?.getSnapshot().backend && viewer.avatarWorkbench.gym;
  }, undefined, { timeout: 45000 });
  await page.waitForTimeout(300);
}
async function approach(page) {
  await read(page, w => {
    const item = w.gym.interactions.find(item => item.id === 'rowboat');
    w.avatar.root.position.copy(item.position); w.avatar.root.position.y += .005;
  });
  await page.waitForTimeout(150);
  check(await page.locator('#gym-interact').isEnabled(), 'Boarding marker is reachable');
}
async function hold(page, key, ms) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); }
async function touchHold(page, selector, ms) {
  const box = await page.locator(selector).boundingBox(); if (!box) throw Error('Touch button is missing');
  const session = await page.context().newCDPSession(page), touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await page.waitForTimeout(ms);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await session.detach();
}
let failure = null;
try {
  for (const backend of ['webgpu', 'webgl']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${backend}: ${error.message}`));
    await page.goto(`${url}?tab=gym&quality=standard${backend === 'webgl' ? '&webgl' : ''}`, { waitUntil: 'networkidle' });
    await ready(page);
    check((await read(page, w => w.getSnapshot())).backend === (backend === 'webgl' ? 'WebGL 2' : 'WebGPU'), `${backend} renderer active`);
    await approach(page);
    await page.screenshot({ path: `${output}/${backend}-dock.png` });
    await page.locator('#gym-viewport canvas').focus(); await page.keyboard.press('e');
    const boarded = await read(page, w => w.getSnapshot());
    check(boarded.boating && boarded.emote === 'sit' && boarded.boat.nearDock, `${backend} E boards and seats avatar`);
    check((await page.locator('#gym-run').textContent()) === 'Row faster', `${backend} controls switch to rowing`);
    const initial = boarded.boat.position;
    await hold(page, 'w', 1900);
    const rowing = await read(page, w => w.getSnapshot());
    check(rowing.boat.position[2] > initial[2] + 2, `${backend} W rows offshore`);
    await hold(page, 'd', 450); await page.keyboard.down('w'); await hold(page, 'd', 900); await page.keyboard.up('w');
    const steering = await read(page, w => w.getSnapshot());
    check(steering.boat.heading > .1 && steering.boat.position[0] > initial[0] + .15, `${backend} D steers while rowing`);
    check(steering.position[0] > initial[0] && steering.boating && !steering.boat.nearDock, `${backend} avatar follows the offshore boat`);
    await page.keyboard.press('e');
    check((await read(page, w => w.getSnapshot())).boating, `${backend} E cannot disembark at sea`);
    await page.screenshot({ path: `${output}/${backend}-rowing.png` });
    await menuClick(page,'#gym-reset');
    const reset = await read(page, w => w.getSnapshot());
    check(!reset.boating && reset.boat.nearDock && reset.emote === 'none' && reset.position[0] < 30, `${backend} reset returns avatar and boat safely`);
    await approach(page); await page.locator('#gym-interact').click();
    check((await read(page, w => w.getSnapshot())).boating, `${backend} button also boards`);
    await page.locator('#gym-interact').click();
    check(!(await read(page, w => w.getSnapshot())).boating, `${backend} button steps ashore at dock`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(`phone: ${error.message}`));
  await page.goto(`${url}?tab=gym&webgl`, { waitUntil: 'networkidle' }); await ready(page); await approach(page);
  await page.locator('#gym-interact').tap(); const start = await read(page, w => w.getSnapshot());
  await touchHold(page, '[data-move="forward"]', 1400);
  const moved = await read(page, w => w.getSnapshot());
  check(moved.boat.position[2] > start.boat.position[2] + 1, 'Touch arrow rows the boat');
  await page.locator('#gym-run').tap();
  check((await page.locator('#gym-run').getAttribute('aria-pressed')) === 'true', 'Touch speed control works while rowing');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone layout has no horizontal overflow');
  await page.screenshot({ path: `${output}/phone-rowing.png` }); await context.close();
  check(errors.length === 0, `No browser errors: ${errors.join('; ')}`);
} catch (error) { failure = error instanceof Error ? error.message : String(error); throw error; }
finally { await fs.writeFile(`${output}/browser-qa.json`, JSON.stringify({ passed: !failure, failure, date: new Date().toISOString(), checks, errors, note: 'Chrome on this Mac; 390px touch check is emulated, not a physical phone.' }, null, 2) + '\n'); await browser.close(); }
