import { Group, Material, MathUtils, Mesh } from 'three';
import { TunaCelMaterial, type TunaSwimUniforms } from './toon';
import { disposeModelResources } from '../shared/assembly';
import type { TunaBatch } from './batching';
import { TUNA_DEFORMING_PARTS } from './definition';
import type { FishModel, FishLifeState, FishMotionOwner, FishPhysicsDescriptor, SwimMode } from '../types';

export const SWIM = {
  slow: { frequency:.72, amplitude:.24, dorsalExtension:1, pectoralAngle:.62 },
  fast: { frequency:2.65, amplitude:.43, dorsalExtension:.62, pectoralAngle:.045 },
} as const;
/** CPU equivalent of the vertex shader, used only at the independent fin hinges. */
export function swimWave(x:number,phase:number,blend:number){
  const u=MathUtils.clamp((x+3.15)/6,0,1);
  return (.007*(1-.6*blend)+MathUtils.lerp(.24,.43,blend)*u**3.5)*Math.sin(phase-u*3.4);
}
function swimSlope(x:number,phase:number,blend:number){
  if(x<=-3.15||x>=2.85)return 0;
  const u=(x+3.15)/6,a=MathUtils.lerp(.24,.43,blend),e=.007*(1-.6*blend)+a*u**3.5,t=phase-u*3.4;
  return (a*3.5*u**2.5*Math.sin(t)-e*3.4*Math.cos(t))/6;
}
export function attachTunaMotion(root:Group,visual:Group,parts:Map<string,Group>,physics:FishPhysicsDescriptor,batch?:TunaBatch):FishModel{
  let mode:SwimMode='slow',lifeState:FishLifeState='alive',motionOwner:FishMotionOwner='external';
  let blend=0,phase=0,disposed=false,activity=1;
  const deformIds=new Set<string>(TUNA_DEFORMING_PARTS);
  // Every tuna material shares one per-fish set of swim uniforms (createTunaMaterials).
  let uniforms:TunaSwimUniforms|undefined=batch?.material.uniforms;
  const bentMaterials=new Map<TunaCelMaterial,TunaCelMaterial>();
  if(!batch)for(const [id,group] of parts)group.traverse(o=>{
    if(!(o instanceof Mesh)||!(o.material instanceof TunaCelMaterial))return;
    uniforms??=o.material.uniforms;
    if(deformIds.has(id)){
      const original=o.material;
      // A fin material can be used by both a hinged fin and a bending batch.
      if(!bentMaterials.has(original))bentMaterials.set(original,original.bent());
      o.material=bentMaterials.get(original)!;
      o.geometry.computeBoundingSphere();o.geometry.boundingSphere!.radius+=.5;
      o.geometry.computeBoundingBox();o.geometry.boundingBox!.min.z-=.5;o.geometry.boundingBox!.max.z+=.5;
    }
  });
  if(!uniforms)throw new Error('Tuna parts must use TunaCelMaterial');
  const swim=uniforms;
  // Dispose superseded source materials only when no live mesh still uses them.
  const usedMaterials=new Set<Material>();visual.traverse(o=>{if(o instanceof Mesh)usedMaterials.add(o.material as Material);});
  for(const original of bentMaterials.keys())if(!usedMaterials.has(original))original.dispose();
  const hinges=[...parts].filter(([id])=>!deformIds.has(id)).map(([id,group])=>({id,group,position:group.position.clone(),rotation:group.rotation.clone(),scale:group.scale.clone()}));
  function pose(){
    swim.swimPhase.value=phase;swim.swimBlend.value=blend;swim.swimActive.value=activity;
    for(const {id,group:p,position,rotation,scale} of hinges){
      p.position.copy(position);p.rotation.copy(rotation);p.scale.copy(scale);
      const slope=swimSlope(position.x,phase,blend)*activity;
      p.position.z+=swimWave(position.x,phase,blend)*activity;p.rotation.y-=Math.atan(slope);
      if(id==='tail')p.rotation.y+=Math.sin(phase-3.8)*MathUtils.lerp(.12,.25,blend)*activity;
      if(id==='dorsal-primary'){p.scale.y=lifeState==='caught'?.8:MathUtils.lerp(1,.62,blend);p.rotation.z=-.025*blend*activity;}
      if(id.startsWith('pectoral')){
        const side=id==='pectoral-near'?1:-1;
        p.rotation.y=-side*(lifeState==='caught'?.22:MathUtils.lerp(.62,.045,blend))-Math.atan(slope);
        p.rotation.x=side*Math.sin(phase*.5)*.035*(1-blend)*activity;
      }
    }
    batch?.sync();
  }
  function setSwimMode(next:SwimMode,immediate=false){
    if(disposed)return;
    if(next!=='slow'&&next!=='fast')throw new Error(`Unknown swim mode: ${next}`);
    mode=next;if(immediate)blend=next==='fast'?1:0;pose();
  }
  function setLifeState(next:FishLifeState){
    if(disposed)return;
    if(next!=='alive'&&next!=='caught')throw new Error(`Unknown fish state: ${next}`);
    if(next===lifeState)return;
    lifeState=next;activity=0;
    parts.get('head-details')!.visible=next==='alive';parts.get('caught-details')!.visible=next==='caught';pose();
  }
  function setMotionOwner(next:FishMotionOwner){
    if(disposed)return;
    if(!['external','path','physics'].includes(next))throw new Error(`Unknown motion owner: ${next}`);
    motionOwner=next;
  }
  function update(dt:number){
    if(disposed||lifeState==='caught'||!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(dt,.1);
    const target=mode==='fast'?1:0,decay=Math.exp(-4*dt);
    const integratedBlend=target*dt+(blend-target)*(1-decay)/4;
    phase+=(.72*dt+(2.65-.72)*integratedBlend)*Math.PI*2;
    phase%=Math.PI*2;blend=target+(blend-target)*decay;
    activity=1-(1-activity)*Math.exp(-6*dt);pose();
  }
  function dispose(){
    if(disposed)return;disposed=true;
    disposeModelResources(root);
    parts.clear();
  }
  parts.get('caught-details')!.visible=false;pose();
  return {root,visual,parts,physics,update,setSwimMode,setLifeState,setMotionOwner,
    getState:()=>({mode,lifeState,motionOwner,disposed,blend,phase,frequency:lifeState==='caught'?0:MathUtils.lerp(.72,2.65,blend),finExtension:lifeState==='caught'?.8:MathUtils.lerp(1,.62,blend)}),dispose};
}
