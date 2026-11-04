import { Color, MathUtils } from 'three';
import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import type { FishDesign, FishOptions } from '../shared/fish/design';
import { bellyAt } from '../shared/fish/geometry';
import { finishFish } from '../shared/fish/rig';
import { mulberry32 } from '../shared/random';
import { createToonMaterial } from '../shared/style';
import type { FishModel, Point3 } from '../types';
import { GREAT_WHITE } from './definition';
import { buildSharkFace } from './face';
import { buildSharkFins } from './fins';

export interface GreatWhiteSharkOptions extends FishOptions { seed?:number }
export function createGreatWhiteSharkModel({lengthMeters=GREAT_WHITE.lengthMeters,seed=Math.floor(Math.random()*2**32)}:GreatWhiteSharkOptions={}):FishModel {
  if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw new Error('Shark length must be positive metres');
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Shark seed must be uint32');
  const random=mulberry32(seed),girth=.98+random()*.04;
  const design:FishDesign={...GREAT_WHITE,profile:GREAT_WHITE.profile.map(([x,y,d,w])=>[x,y,d*girth,w*girth])};
  const back=new Color('#787879').lerp(new Color('#626d73'),random()*.22),belly=new Color('#cdd1c8');
  const a=createModelAssembly(GREAT_WHITE.id),material=createToonMaterial({vertexColors:true,rim:false,name:'great-white-matte-toon'});
  buildFishBody(a,design,material,(_x,h,_side,out)=>{
    // Smooth vertex weights avoid stair steps where a hard threshold crosses a coarse body ring.
    out.copy(back).lerp(belly,MathUtils.smoothstep(-h,.20,.60));
    out.multiplyScalar(1-Math.max(0,h)*.12);
  },lengthMeters);
  buildSharkFins(a,design,material,lengthMeters);buildSharkFace(a,design,material,lengthMeters);
  const sourceParts=[...a.parts.keys()],model=finishFish(a,design,lengthMeters);
  const mouth:Point3=[-.442*lengthMeters,(bellyAt(design.profile,-.442)-.002)*lengthMeters,0];
  Object.assign(model.root.userData,{seed,sourceParts,inspectionSizeMeters:[lengthMeters,lengthMeters*.39,lengthMeters*.59],
    animation:'six-bone rear-body and tail swimming; fixed dorsal and pectoral fins'});
  return {...model,physics:{...model.physics,anchors:{...model.physics.anchors,mouth}}};
}
