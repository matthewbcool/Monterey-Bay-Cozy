import {createFrameMetrics,type FrameMetrics} from './frameMetrics';
interface Counters {render:{drawCalls:number;triangles:number;frameCalls:number};memory:{geometries:number;textures:number}}
export interface GymPerformanceSnapshot extends FrameMetrics {drawCalls:number;triangles:number;passes:number;geometries:number;textures:number;backend:string;width:number;height:number;pixelRatio:number;lod:string}
/** Reuses the existing frame loop; only updates DOM once per measurement window. */
export function createGymDiagnostics(host:HTMLElement){
 const panel=document.createElement('details');panel.className='gym-diagnostics';panel.open=!matchMedia('(max-width: 620px)').matches;
 panel.innerHTML='<summary><span>Performance</span><b data-perf="fps">Sampling…</b></summary><dl></dl><p class="gym-diagnostics-meta"></p><p class="gym-diagnostics-note">1-second samples · draws include shadows. CPU time is JS + submission, not GPU time.</p>';
 const rows=[['meanMs','Frame avg'],['deviationMs','Variation (σ)'],['worstMs','Worst frame'],['workMs','CPU work'],['drawCalls','Draw calls'],['triangles','Triangles'],['resources','Textures / geometry'],['passes','Render passes']] as const;
 const dl=panel.querySelector('dl')!;
 for(const [key,label]of rows){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.dataset.perf=key;dd.textContent='—';dl.append(dt,dd);}
 panel.querySelector('[data-perf=deviationMs]')!.setAttribute('title','Population standard deviation of frame intervals in milliseconds; lower means steadier pacing.');
 const values=Object.fromEntries(Array.from(panel.querySelectorAll<HTMLElement>('[data-perf]')).map(el=>[el.dataset.perf!,el]));const meta=panel.querySelector('.gym-diagnostics-meta')!;
 host.append(panel);const sampler=createFrameMetrics();let snapshot:GymPerformanceSnapshot|null=null;
 return {panel,
  reset(){sampler.reset();snapshot=null;for(const [key,value] of Object.entries(values))value.textContent=key==='fps'?'Sampling…':'—';meta.textContent='';},
  record(now:number,workMs:number,info:Counters,backend:string,canvas:HTMLCanvasElement,pixelRatio:number,lod:string){
   const sample=sampler.sample(now,workMs);if(!sample)return;
   snapshot={...sample,drawCalls:info.render.drawCalls,triangles:info.render.triangles,passes:info.render.frameCalls,geometries:info.memory.geometries,textures:info.memory.textures,backend,width:canvas.width,height:canvas.height,pixelRatio,lod};
   values.fps.textContent=sample.fps.toFixed(0)+' FPS';for(const key of ['meanMs','deviationMs','worstMs','workMs'] as const)values[key].textContent=sample[key].toFixed(1)+' ms';
   values.drawCalls.textContent=snapshot.drawCalls.toLocaleString();values.triangles.textContent=Math.round(snapshot.triangles).toLocaleString();values.resources.textContent=snapshot.textures+' / '+snapshot.geometries;values.passes.textContent=String(snapshot.passes);
   meta.textContent=`${backend} · ${canvas.width} × ${canvas.height} · DPR ${pixelRatio.toFixed(1)} · ${lod} LOD`;
  },
  getSnapshot(){return snapshot?{...snapshot}:null;},
  dispose(){panel.remove();}
 };
}
