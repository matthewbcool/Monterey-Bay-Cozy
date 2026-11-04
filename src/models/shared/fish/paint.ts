import { Color, MathUtils } from 'three';
/** Continuous pigment transitions, independent of scene lighting or species shape. */
export function countershade(out:Color,height:number,back:Color,shoulder:Color,flank:Color,belly:Color){
  const h=MathUtils.clamp(height,-1,1);
  if(h>.55)out.copy(shoulder).lerp(back,(h-.55)/.45);
  else if(h>.03)out.copy(flank).lerp(shoulder,(h-.03)/.52);
  else out.copy(flank).lerp(belly,Math.min(1,(.03-h)/.75));
}
