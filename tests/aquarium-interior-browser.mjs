import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const url=process.env.PREVIEW_URL??'http://127.0.0.1:5191/';
const out='artifacts/aquarium-interior/';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],checks=[],metrics=[];
function check(ok,message){if(!ok)throw Error(message);checks.push(message);console.log('PASS',message);}
try {
  for(const backend of ['webgpu','webgl2']){
    const p=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    p.on('pageerror',e=>errors.push(backend+': '+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(backend+': '+m.text());});
    await p.goto(url+'?tab=map&interior'+(backend==='webgl2'?'&webgl':''),{waitUntil:'networkidle'});
    await p.locator('.aquarium-open').waitFor({timeout:45000});await p.waitForTimeout(500);
    check(await p.locator('.aquarium-tools').isVisible(),backend+' interior deep link');
    check(await p.locator('#panel-map').getAttribute('data-map-backend')===backend,backend+' backend confirmed');
    metrics.push({backend,floor1:await p.locator('.aq-stats').textContent()});
    await p.screenshot({path:out+backend+'-first-floor.png'});
    await p.getByRole('button',{name:'Floor plan',exact:true}).click();await p.screenshot({path:out+backend+'-plan.png'});
    await p.getByRole('button',{name:'2 · Upper floor',exact:true}).click();
    check(await p.locator('#panel-map').getAttribute('data-aquarium-floor')==='1',backend+' second-floor geometry');
    metrics.at(-1).floor2=await p.locator('.aq-stats').textContent();await p.screenshot({path:out+backend+'-upper-floor.png'});
    await p.selectOption('#aq-destination','open-sea');
    check((await p.locator('.aq-dimension').textContent()).includes('10.67'),backend+' published Open Sea height');
    await p.getByRole('button',{name:'Route from entrance',exact:true}).click();
    check((await p.locator('.aq-route-status').textContent()).includes('floor change'),backend+' route includes vertical connection');
    await p.screenshot({path:out+backend+'-route.png'});
    for(let i=0;i<25&&await p.locator('#aq-next').isEnabled();i++)await p.locator('#aq-next').click();
    check(await p.locator('#aq-next').isDisabled(),backend+' route reaches destination');
    check(await p.locator('#panel-map').getAttribute('data-aquarium-floor')==='1',backend+' route switches floor');
    check(await p.locator('#panel-map').getAttribute('data-aquarium-camera')==='eye',backend+' visitor eye-height mode');
    await p.screenshot({path:out+backend+'-visitor.png'});
    await p.locator('#aq-prev').click();check(await p.locator('#aq-next').isEnabled(),backend+' route can step backward');
    await p.getByRole('button',{name:'Route from entrance',exact:true}).click();
    await p.selectOption('#aq-destination','kelp');
    check((await p.locator('.aq-evidence').textContent()).includes('footprint')&&(await p.locator('.aq-evidence').textContent()).includes('estimated'),backend+' dimension uncertainty visible');
    await p.getByRole('button',{name:'Focus exhibit',exact:true}).click();await p.screenshot({path:out+backend+'-kelp.png'});
    await p.locator('#panel-map canvas').focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('+');await p.keyboard.press('Home');
    check(await p.locator('.aquarium-open').isVisible(),backend+' keyboard stays in interior');
    await p.getByRole('tab',{name:'Tank',exact:true}).click();await p.getByRole('tab',{name:'Map study',exact:true}).click();
    check(await p.locator('.aquarium-tools').isVisible(),backend+' interior survives tab switch');
    await p.getByRole('button',{name:'← Area map',exact:true}).click();
    check(await p.locator('.map-tools').isVisible(),backend+' return to area map');
    check((await p.locator('.map-status').textContent()).includes('1,272'),backend+' regional map retained');
    await p.getByRole('button',{name:'Inside aquarium →',exact:true}).click();check(await p.locator('.aquarium-open').isVisible(),backend+' reopen interior');
    await p.close();
  }
  const p=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  p.on('pageerror',e=>errors.push('mobile: '+e.message));
  await p.goto(url+'?tab=map&interior&webgl',{waitUntil:'networkidle'});await p.locator('.aquarium-open').waitFor({timeout:45000});
  check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'390px no horizontal overflow');
  const canvas=await p.locator('#panel-map canvas').boundingBox(),panel=await p.locator('.aquarium-tools').boundingBox();
  check(canvas.height>350&&canvas.y+canvas.height<=panel.y+2,'Phone controls leave the model viewport clear');
  await p.getByRole('button',{name:'Floor plan',exact:true}).tap();await p.screenshot({path:out+'mobile-plan.png'});
  await p.selectOption('#aq-destination','kelp');await p.getByRole('button',{name:'Focus exhibit',exact:true}).tap();await p.screenshot({path:out+'mobile-kelp.png'});
  await p.getByRole('button',{name:'Route from entrance',exact:true}).tap();await p.locator('#aq-next').tap();
  check(await p.locator('#panel-map').getAttribute('data-aquarium-camera')==='eye','Phone route control');await p.close();
  check(errors.length===0,'No browser errors: '+errors.join('; '));
  await fs.writeFile(out+'browser-qa.json',JSON.stringify({date:new Date().toISOString(),url,checks,metrics,errors},null,2)+'\n');
}finally{await browser.close();}
