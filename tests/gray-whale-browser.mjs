import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const preview=new URL(base);
const folder='artifacts/gray-whale';await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const evidence=[],errors=[];
try{
  for(const backend of ['webgpu','webgl']){
    const page=await browser.newPage({viewport:{width:1280,height:760}});
    await page.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),socket=>socket.send(JSON.stringify({type:'connected'})));
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${base}tests/fish-review.html?species=gray-whale${backend==='webgl'?'&webgl':''}`);
    await page.evaluate(async()=>{
      const r=await window.fishBackendCheck;
      const {createGrayWhaleModel}=await import('/src/models/gray-whale/createGrayWhaleModel.ts');
      r.scene.remove(r.fish[0].root);r.fish[0].dispose();r.fish[0]=createGrayWhaleModel({seed:8021});
      r.scene.add(r.fish[0].root);
      const {applyNodeStyle}=await import('/src/viewer/nodeStyle.ts');applyNodeStyle(r.fish[0].root);
    });
    for(const [pose,angle] of [['slow','side'],['fast','oblique'],['caught','side'],['slow','underside']]){
      const result=await page.evaluate(async([state,view])=>{
        const r=await window.fishBackendCheck;await r.pose(state,view);
        return {backend:r.result.backend,draws:r.renderer.info.render.drawCalls,triangles:r.renderer.info.render.triangles};
      },[pose,angle]);
      assert.equal(result.backend,backend==='webgpu'?'WebGPUBackend':'WebGLBackend');
      assert.equal(result.draws,3); // two whale draws plus the fixture's one scene draw
      assert.equal(result.triangles,pose==='caught'?1485:1521);
      evidence.push({pose,angle,...result});
      await page.screenshot({path:`${folder}/${backend}-${pose}-${angle}.png`});
    }
    await page.close();
  }
  const tank=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  await tank.routeWebSocket(u=>u.hostname===preview.hostname&&u.port===preview.port&&u.searchParams.has('token'),socket=>socket.send(JSON.stringify({type:'connected'})));
  tank.on('pageerror',error=>errors.push(error.message));
  await tank.goto(base,{waitUntil:'networkidle'});
  assert.equal(await tank.locator('#creature-select option').count(),15);
  await tank.locator('canvas').first().focus();await tank.keyboard.press('ArrowLeft');
  assert.equal(await tank.locator('#creature-select').inputValue(),'gray-whale');
  await tank.keyboard.press('ArrowRight');assert.equal(await tank.locator('#creature-select').inputValue(),'tuna');
  await tank.selectOption('#creature-select','gray-whale');
  await tank.getByRole('button',{name:'Follow fish',exact:true}).click();
  await tank.waitForTimeout(250);
  const inspect=()=>tank.evaluate(async()=>{
    const src=document.querySelector('script[type="module"][src*="/src/main.ts"]').src;
    const {viewer:v}=await import(src);
    return {id:v.state.creatureId,meters:v.fish.root.userData.lengthMeters,lod:v.lod.stats(v.fish.root),demo:v.state.demo,population:v.demo?.count,species:v.demo?.speciesCount,hasWhale:v.demo?.members.some(m=>m.speciesId==='gray-whale')};
  });
  const whale=await inspect();assert.equal(whale.id,'gray-whale');assert.equal(whale.meters,12);
  const swimState=()=>tank.evaluate(async()=>{
    const src=document.querySelector('script[type="module"][src*="/src/main.ts"]').src;
    const {viewer:v}=await import(src);
    return {position:v.fish.root.position.toArray(),phase:v.fish.getState().phase};
  });
  await tank.getByRole('button',{name:'Play animation',exact:true}).click();
  const before=await swimState();await tank.waitForTimeout(350);const after=await swimState();
  assert.notEqual(after.phase,before.phase);assert.deepEqual(after.position,before.position);
  await tank.getByRole('button',{name:'Pause animation',exact:true}).click();
  assert.equal(whale.lod.near.triangles,1520);
  assert.ok(whale.lod.mid.triangles<whale.lod.near.triangles&&whale.lod.far.triangles<whale.lod.mid.triangles);
  assert.deepEqual([whale.lod.near.draws,whale.lod.mid.draws,whale.lod.far.draws],[2,2,2]);
  await tank.screenshot({path:`${folder}/tank-follow.png`});
  for(const level of ['near','mid','far']){
    await tank.selectOption('#lod-select',level);
    for(const state of ['alive','caught']){
      await tank.selectOption('#life-state',state);
      const actual=await tank.evaluate(async()=>{
        const src=document.querySelector('script[type="module"][src*="/src/main.ts"]').src;
        const {viewer:v}=await import(src),{modelStats}=await import('/src/viewer/modelStats.ts');
        v.lod.update(v.camera,900,0,true);
        return {stats:modelStats(v.fish.root).model,levels:v.lod.inspect(v.fish.root).map(row=>row.level)};
      });
      assert.equal(actual.stats.drawCalls,2);
      assert.ok(actual.levels.every(active=>active===level));
      const ceiling=level==='near'?1520:level==='mid'?800:350;
      assert.ok(actual.stats.triangles<=ceiling,`${level} ${state}: ${actual.stats.triangles}`);
      if(level==='far'&&state==='caught')await tank.screenshot({path:`${folder}/tank-caught-far.png`});
    }
  }
  await tank.selectOption('#life-state','alive');await tank.selectOption('#lod-select','auto');
  await tank.setViewportSize({width:320,height:740});await tank.waitForTimeout(200);
  const mobile=await tank.evaluate(async()=>{
    const src=document.querySelector('script[type="module"][src*="/src/main.ts"]').src;
    const {viewer:v}=await import(src),{Vector3}=await import('/node_modules/three/build/three.module.js');
    v.fish.root.updateMatrixWorld(true);v.camera.updateMatrixWorld(true);
    let outside=0,vertices=0;v.fish.root.traverseVisible(o=>{
      if(!o.isMesh)return;
      for(let i=0;i<o.geometry.attributes.position.count;i++){
        const point=o.getVertexPosition(i,new Vector3()).applyMatrix4(o.matrixWorld).project(v.camera);
        if(Math.abs(point.x)>1.01||Math.abs(point.y)>1.01)outside++;vertices++;
      }
    });
    return {outside,vertices,horizontalOverflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(mobile.horizontalOverflow,false);assert.equal(mobile.outside,0,JSON.stringify(mobile));
  await tank.screenshot({path:`${folder}/tank-mobile.png`});
  await tank.setViewportSize({width:1440,height:900});
  await tank.locator('#demo-mode').check();await tank.waitForTimeout(250);
  const demo=await inspect();assert.equal(demo.demo,true);assert.equal(demo.population,292);assert.equal(demo.species,15);assert.equal(demo.hasWhale,false);
  evidence.push({tank:{id:whale.id,meters:whale.meters,lod:whale.lod,mobile},demo:{population:demo.population,species:demo.species,hasWhale:demo.hasWhale}});
  assert.deepEqual(errors,[]);
  await writeFile(`${folder}/browser-metrics.json`,JSON.stringify({evidence,errors},null,2)+'\n');
  await tank.close();
  console.log('PASS: gray whale renders in WebGPU/WebGL 2, fits follow view, and stays out of Demo mode');
}finally{await browser.close();}
