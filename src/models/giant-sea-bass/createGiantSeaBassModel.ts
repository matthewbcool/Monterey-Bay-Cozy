import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import type { FishDesign, FishOptions } from '../shared/fish/design';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import { mulberry32 } from '../shared/random';
import type { FishModel } from '../types';
import { GIANT_SEA_BASS as B } from './definition';
import { buildSeaBassFins, seaBassPaint } from './components';
import { buildSeaBassFace } from './face';

export interface GiantSeaBassOptions extends FishOptions {seed?:number}
export function createGiantSeaBassModel({lengthMeters=B.lengthMeters,seed=Math.floor(Math.random()*2**32)}:GiantSeaBassOptions={}):FishModel{
  if(!Number.isFinite(lengthMeters)||lengthMeters<=0)throw new Error('Sea bass length must be positive metres');
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Sea bass seed must be uint32');
  const random=mulberry32(seed),girth=.985+random()*.03;
  const design:FishDesign={...B,profile:B.profile.map(([x,y,h,w])=>[x,y,h,w*girth])};
  const a=createModelAssembly(B.id),material=createFishMaterial();
  material.name='giant-sea-bass-painted-toon';
  buildFishBody(a,design,material,seaBassPaint(random),lengthMeters);
  buildSeaBassFins(a,design,material,lengthMeters);
  buildSeaBassFace(a,design,material,lengthMeters);
  const sourceParts=[...a.parts.keys()],model=finishFish(a,design,lengthMeters);
  Object.assign(model.root.userData,{seed,sourceParts,inspectionSizeMeters:[lengthMeters,.44*lengthMeters,.36*lengthMeters]});
  return {...model,physics:{...model.physics,anchors:{...model.physics.anchors,mouth:[-.492*lengthMeters,-.044*lengthMeters,0]}}};
}
