import { MathUtils } from 'three';
import type { FishLifeState, FishModel, FishMotionOwner, SwimMode } from '../types';
import { disposeModelResources } from './assembly';

/** Shared lifecycle for independently rigged creatures; pose must never place the rigid root. */
export function createCreatureMotion(model: Pick<FishModel, 'root'|'visual'|'parts'|'physics'>, rates: {slow:number;fast:number}, pose:(phase:number,blend:number,caught:boolean)=>void, release=()=>{}): FishModel {
  let mode:SwimMode='slow',lifeState:FishLifeState='alive',motionOwner:FishMotionOwner='external',disposed=false,phase=0,blend=0;
  const apply=()=>pose(phase,blend,lifeState==='caught');apply();
  return {...model,
    update(dt){if(disposed||lifeState==='caught'||!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);
      const target=mode==='fast'?1:0,decay=Math.exp(-4*dt),integral=target*dt+(blend-target)*(1-decay)/4;
      phase=(phase+2*Math.PI*(rates.slow*dt+(rates.fast-rates.slow)*integral))%(2*Math.PI);blend=target+(blend-target)*decay;apply();},
    setSwimMode(next,immediate=false){if(disposed)return;if(next!=='slow'&&next!=='fast')throw new Error('Unknown swim mode');mode=next;if(immediate)blend=next==='fast'?1:0;apply();},
    setLifeState(next){if(disposed)return;if(next!=='alive'&&next!=='caught')throw new Error('Unknown life state');lifeState=next;apply();},
    setMotionOwner(next){if(disposed)return;if(!['external','path','physics'].includes(next))throw new Error('Unknown motion owner');motionOwner=next;},
    getState:()=>({mode,lifeState,motionOwner,disposed,phase,blend,frequency:lifeState==='caught'?0:MathUtils.lerp(rates.slow,rates.fast,blend),finExtension:1}),
    dispose(){if(disposed)return;disposed=true;release();disposeModelResources(model.root);model.parts.clear();},
  };
}
