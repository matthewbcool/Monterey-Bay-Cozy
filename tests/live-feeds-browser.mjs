import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const url = process.env.PREVIEW_URL ?? 'http://127.0.0.1:5191/';
const out = 'artifacts/live-feeds/';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });
const checks = [], errors = [], externalRequests = [];
function check(ok, label) { if (!ok) throw Error(label); checks.push(label); console.log('PASS', label); }
try {
  for (const backend of ['webgpu', 'webgl2']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (!request.url().startsWith(url) && /^https?:/.test(request.url())) externalRequests.push(request.url()); });
    await page.goto(url + '?tab=map&feeds' + (backend === 'webgl2' ? '&webgl' : ''), { waitUntil: 'networkidle' });
    await page.locator('#map-feed-select').waitFor({ timeout: 45000 });
    await page.locator('[data-map-backend]').waitFor();
    check(await page.locator('#panel-map').getAttribute('data-map-backend') === backend, 'Map renders on ' + backend);
    check(await page.locator('#map-feed-select option').count() === 9, 'Inventory lists nine candidates on ' + backend);
    check(await page.locator('.feed-map-pin').count() === 4, 'Shared venue feeds create four geographic pins on ' + backend);
    check(await page.locator('.feed-map-pin:visible').count() >= 3, 'All-feed framing shows geographic sites on ' + backend);
    check(await page.locator('#panel-map iframe, #panel-map video').count() === 0, 'Map does not load video players on ' + backend);
    await page.screenshot({ path: out + 'all-locations-' + backend + '.png' });
    await page.selectOption('#map-feed-select', 'surfline-monterey-bay');
    check((await page.locator('.feed-badge').textContent()).includes('agreement'), 'Surfline permission requirement is visible on ' + backend);
    check((await page.locator('.feed-coverage').textContent()).includes('Outside'), 'Surfline remains outside street snapshot on ' + backend);
    check((await page.locator('.feed-source-link').getAttribute('href')).includes('584204214e65fad6a7709d05'), 'User-provided Surfline URL is preserved on ' + backend);
    await page.getByRole('button', { name: 'Focus location', exact: true }).click();
    check(await page.locator('[data-feed-location="surfline-monterey-bay"]').isVisible(), 'Focus reveals the recorded Surfline position on ' + backend);
    await page.screenshot({ path: out + 'surfline-' + backend + '.png' });
    await page.locator('#map-feeds-visible').uncheck();
    check(await page.locator('.feed-map-pin:visible').count() === 0, 'Feed pins can be hidden on ' + backend);
    await page.locator('#map-feeds-visible').check();
    await page.getByRole('button', { name: 'All feed locations', exact: true }).click();
    await page.locator('[data-feed-location="aquarium"]').click();
    check((await page.locator('#map-feed-select').inputValue()).startsWith('aquarium-'), 'Clicking venue pin selects its candidate on ' + backend);
    await page.selectOption('#map-feed-select', 'aquarium-kelp');
    check((await page.locator('.feed-subject').textContent()).includes('exhibit'), 'Exhibit feed is distinguished from wild habitat on ' + backend);
    await page.getByRole('button', { name: 'Inside aquarium →', exact: true }).click();
    check(await page.locator('.feed-map-pin:visible').count() === 0, 'Outdoor feed pins hide in interior mode on ' + backend);
    await page.getByRole('button', { name: '← Area map', exact: true }).click();
    await page.getByRole('button', { name: 'Overview', exact: true }).click();
    await page.getByRole('tab', { name: 'Tank', exact: true }).click();
    await page.getByRole('tab', { name: 'Map study', exact: true }).click();
    check(await page.locator('#map-feed-select').inputValue() === 'aquarium-kelp', 'Map tab return preserves candidate selection on ' + backend);
    await page.close();
  }
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  phone.on('pageerror', error => errors.push(error.message));
  phone.on('request', request => { if (!request.url().startsWith(url) && /^https?:/.test(request.url())) externalRequests.push(request.url()); });
  await phone.goto(url + '?tab=map&feeds&webgl', { waitUntil: 'networkidle' });
  await phone.locator('#map-feed-select').waitFor({ timeout: 45000 });
  check(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone has no horizontal overflow');
  await phone.selectOption('#map-feed-select', 'portola-rooftop');
  await phone.getByRole('button', { name: 'Focus location', exact: true }).tap();
  check(await phone.locator('[data-feed-location="portola-hotel"]').isVisible(), 'Phone focus locates out-of-coverage hotel');
  await phone.screenshot({ path: out + 'phone.png' });
  await phone.locator('#map-feed-select').focus();
  await phone.keyboard.press('Home');
  await phone.keyboard.press('ArrowDown');
  check(await phone.locator('#map-feed-select').inputValue() !== 'portola-rooftop', 'Native candidate selector supports keyboard navigation');
  await phone.close();
  const existingFontRequests = externalRequests.filter(url => ['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(url).hostname));
  check(externalRequests.length === existingFontRequests.length, 'No feed-provider or media requests; existing app font requests recorded separately');
  check(errors.length === 0, 'No browser errors: ' + errors.join('; '));
} finally {
  await fs.writeFile(out + 'browser-qa.json', JSON.stringify({ date: new Date().toISOString(), url, checks, errors, externalRequests, deviceNote: 'Local Chrome desktop plus mobile viewport emulation; not a physical-phone test.' }, null, 2) + '\n');
  await browser.close();
}
