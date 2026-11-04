import { Box3, Group, Vector3 } from 'three';
import type { FishEntry } from '../models/catalogue';
import type { FishModel, FishMotionOwner, SwimMode } from '../models/types';
import { createSchooling, type SchoolingTraits } from '../models/shared/school/schooling';
import { creatureRadius } from './demoRoute';

/** Small coordinated groups retain the existing per-fish rigs. Large sardine
 * populations use the one-draw instanced factory instead. No model is rescaled. */
export function createDemoSchool(entry:FishEntry,count:number,traits:SchoolingTraits){
  const root=new Group(),specimens:FishModel[]=[];root.name=`demo-${entry.id}-school`;
  let disposed=false,motionOwner:FishMotionOwner='external';
  try{
    for(let i=0;i<count;i++){
      const model=entry.create();specimens.push(model);root.add(model.root);
      for(let t=0;t<i*3;t++)model.update(.07);
    }
  }catch(error){specimens.forEach(model=>model.dispose());throw error;}
  const tailTempo=specimens.map((_,i)=>.92+.16*((i*7+3)%count)/Math.max(1,count-1));
  const length=specimens[0].root.userData.lengthMeters as number;
  const formation=createSchooling(count,length,{...traits,sizeSpread:0},17);
  formation.reset(count);
  // Staggered starting lanes avoid overlapping bodies before steering settles.
  const rows=Math.ceil(count/2);
  for(let i=0;i<count;i++)formation.position.set([
    (Math.floor(i/2)-(rows-1)/2)*length*1.15,
    (i%3-1)*length*.22,
    (i%2-.5)*length*1.05,
  ],i*3);
  const padding=Math.max(...specimens.map(creatureRadius));
  const bounds=formation.bounds(new Box3(),padding),scale=new Vector3();
  function pose(){
    for(let i=0;i<count;i++)formation.pose(i,false).decompose(specimens[i].root.position,specimens[i].root.quaternion,scale);
  }
  pose();root.userData={units:'metres',speciesId:entry.id,lengthMeters:length,population:count};
  return {root,count,specimens,bounds,formation,
    getState(){return {...specimens[0].getState(),motionOwner,disposed};},
    setMotionOwner(owner:FishMotionOwner){motionOwner=owner;},
    setSwimMode(mode:SwimMode,immediate=false){if(!disposed)specimens.forEach(model=>model.setSwimMode(mode,immediate));},
    update(dt:number){
      if(disposed||!Number.isFinite(dt)||dt<=0)return;
      dt=Math.min(dt,.1);specimens.forEach((model,i)=>model.update(dt*tailTempo[i]));
      formation.update(dt,specimens[0].getState().blend,0);pose();
    },
    dispose(){if(disposed)return;disposed=true;specimens.forEach(model=>model.dispose());root.removeFromParent();},
  };
}
