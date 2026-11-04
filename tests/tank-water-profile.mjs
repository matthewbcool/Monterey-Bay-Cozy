import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true}),results=[];
try {
 for(const backend of ['webgpu','webgl2']){
  const p=await b.newPage({viewport:{width:1280,height:820},reducedMotion:'reduce'});
  await p.goto('http://127.0.0.1:5191/?quality=standard'+(backend==='webgl2'?'&webgl':''),{waitUntil:'networkidle'});
  const result=await p.evaluate(async()=>{
    const {viewer:v}=await import(document.querySelector('script[type="module"][src*="/src/main.ts"]').src);await v.started;
    const {Mesh,PlaneGeometry}=await import('/node_modules/.vite/deps/three.js'),{MeshBasicNodeMaterial}=await import('/node_modules/.vite/deps/three_webgpu.js');
    const {max,mix,pow,sin,uv,vec3}=await import('/node_modules/.vite/deps/three_tsl.js');const {TANK_SIZE:s}=await import('/src/viewer/swimPath.ts');
    const frame=()=>new Promise(r=>requestAnimationFrame(r));for(let i=0;i<8;i++)await frame();v.state.running=false;await frame();
    // Reconstruct the immediately preceding backdrop locally for an A/B cost comparison.
    // No source mutation, and the same fish, camera, lights, tier and resolution in each pair.
    const m=new MeshBasicNodeMaterial({fog:false}),q=uv();
    const beam=pow(max(0,sin(q.x.mul(36).add(q.y.mul(2.2)))),18).mul(pow(q.y,1.3)).mul(.15);
    m.colorNode=mix(vec3(.003,.009,.04),vec3(.008,.055,.19),q.y.sub(.25).mul(2).clamp(0,1)).add(vec3(.10,.22,.32).mul(beam));
    const old=new Mesh(new PlaneGeometry(s.width*2,s.height*2),m);old.position.z=-s.depth/2;v.tank.root.add(old);
    const materials=new Map();v.fish.root.traverse(o=>{if(o.isMesh)materials.set(o.material,o.material.outputNode);});
    const r=v.renderer,gpu=r.backend,px=new Uint8Array(4),data=[];
    const finish=async()=>{if(gpu.device)await gpu.device.queue.onSubmittedWorkDone();else gpu.gl.readPixels(0,0,1,1,gpu.gl.RGBA,gpu.gl.UNSIGNED_BYTE,px);};
    for(const view of ['tank','follow'])for(const version of ['previous-backdrop','water-volume']){
      v.setView(view);old.visible=version==='previous-backdrop';v.tank.water.root.visible=!old.visible;
      for(const [material,node] of materials){material.outputNode=old.visible?null:node;material.needsUpdate=true;}
      const samples=[];
      for(let i=0;i<65;i++){await frame();const t=performance.now();r.render(v.scene,v.camera);await finish();if(i>=20)samples.push(performance.now()-t);}
      samples.sort((a,b)=>a-b);data.push({view,version,samples:samples.length,medianMs:+samples[22].toFixed(2),p95Ms:+samples[42].toFixed(2),drawCalls:r.info.render.drawCalls,triangles:r.info.render.triangles});
    }
    old.geometry.dispose();m.dispose();return {backend:v.state.backend,results:data};
  });
  results.push(result);console.log(JSON.stringify(result));await p.close();
 }
 await writeFile('artifacts/tank-water/performance.json',JSON.stringify({date:new Date().toISOString(),viewport:'1280 × 820, DPR 1',method:'Standard tier; CPU submission plus GPU completion, 20 warm-up / 45 measured frames; previous backdrop reconstructed in the same page; physical-phone performance not measured',results},null,2)+'\n');
}finally{await b.close();}
