import {clamp,float,sin} from 'three/tsl';
/** Metre-scale artistic harbor profile, not surveyed Monterey Bay bathymetry. */
export const HARBOR_SIZE={width:32,depth:24};
export function seabedDepth(x:number,z:number){
  const u=Math.max(0,Math.min(1,(x+8)/22)),s=u*u*(3-2*u);
  return 1.25+6.25*s+.18*Math.sin(z*.55)*Math.sin(x*.38);
}
/** TSL twin of seabedDepth() for water and caustic shading. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seabedDepthNode(p:any){
  const u=clamp(p.x.add(8).div(22),0,1);
  return float(1.25).add(u.mul(u).mul(float(3).sub(u.mul(2))).mul(6.25)).add(sin(p.y.mul(.55)).mul(sin(p.x.mul(.38))).mul(.18));
}
