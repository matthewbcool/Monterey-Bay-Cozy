import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
try {
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5191/?tab=gym&whales=hide${backend==='webgl'?'&webgl':''}`);
  await page.waitForFunction(()=>document.querySelector('#panel-gym')?.dataset.gymLoad==='ready',null,{timeout:120000});
  await page.evaluate(async()=>{window.breathWorkbench=(await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src)).viewer.avatarWorkbench;});
  // Move the boat offshore for a deep-water ladder fixture.
  await page.evaluate(()=>window.breathWorkbench.gym.diveBoat.root.position.set(180,1,40));
  // Position at the real stern ladder; normal animation-loop updates drive the HUD.
  const place=async depth=>page.evaluate(depth=>{const w=window.breathWorkbench,c=w.controller,p=w.gym.diveBoat.ladderPoint(w.avatar.root.position.clone());c.restoreState({...c.getState(),position:p.toArray(),velocity:[0,0],diveDepth:depth,breath:8,exhausted:false});},depth);
  await place(1);await page.waitForTimeout(200);
  assert(await page.locator('#gym-breath').isVisible(),`${backend} submerged ring visible`);
  assert(Number(await page.locator('#gym-breath-time').textContent())<20);
  await place(0);await page.waitForTimeout(200);
  assert(!await page.locator('#gym-breath').isVisible());
  assert.equal(await page.locator('#gym-breath-time').textContent(),'20');
  await place(1);await page.waitForTimeout(200);
  await page.locator('#gym-interact').click();await page.waitForTimeout(200);
  const boarded=await page.evaluate(()=>window.breathWorkbench.getSnapshot());
  assert(boarded.aboard,`${backend} boarded dive boat`);
  assert.equal(boarded.controller.breath,20);
  assert.equal(boarded.controller.diveDepth,0);
  assert(!await page.locator('#gym-breath').isVisible());
  assert.equal(await page.locator('#gym-breath-time').textContent(),'20');
  console.log(`PASS ${backend}: underwater ring, immediate surface refill, actual dive-boat boarding refill and hidden HUD`);
  await page.close();
 }
}finally{await browser.close();}
