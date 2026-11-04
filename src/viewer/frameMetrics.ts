/** Unclamped rendered-frame intervals; independent of simulation dt and DOM. */
export interface FrameMetrics { fps:number; meanMs:number; deviationMs:number; worstMs:number; workMs:number; slowFrames:number; frames:number; elapsedMs:number }
export function createFrameMetrics(windowMs=1000){
 let previous:number|undefined,count=0,elapsed=0,mean=0,m2=0,worst=0,work=0,slow=0;
 function clear(){count=elapsed=mean=m2=worst=work=slow=0;}
 return {
  reset(){previous=undefined;clear();},
  sample(now:number,workMs:number):FrameMetrics|null{
   if(!Number.isFinite(now)||!Number.isFinite(workMs))return null;
   const delta=previous===undefined?0:now-previous;previous=now;if(delta<=0)return null;
   count++;elapsed+=delta;const change=delta-mean;mean+=change/count;m2+=change*(delta-mean);worst=Math.max(worst,delta);work+=Math.max(0,workMs);if(delta>1000/30)slow++;
   if(elapsed<windowMs)return null;
   const result={fps:count*1000/elapsed,meanMs:mean,deviationMs:Math.sqrt(Math.max(0,m2/count)),worstMs:worst,workMs:work/count,slowFrames:slow,frames:count,elapsedMs:elapsed};clear();return result;
  }
 };
}
