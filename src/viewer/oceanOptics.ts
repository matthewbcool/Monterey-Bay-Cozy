/** Original lightweight ocean normals inspired by Minamo's separation of wave scales.
 * Optical detail only: shared waveNode/sampleWater retain the displacement/buoyancy contract.
 * No FFT, render targets, extra geometry or per-frame CPU sampling.
 */
import {cos,dot,float,floor,fract,fwidth,mix,sin,smoothstep,vec2} from 'three/tsl';
type N=any;
const hash=(p:N)=>fract(sin(dot(p,vec2(127.1,311.7))).mul(43758.5453));
export function waterNoise(p:N):N{
 const i=floor(p),f0=fract(p),f=f0.mul(f0).mul(vec2(3).sub(f0.mul(2)));
 return mix(mix(hash(i),hash(i.add(vec2(1,0))),f.x),mix(hash(i.add(vec2(0,1))),hash(i.add(vec2(1,1))),f.x),f.y);
}
export function oceanSurface(p:N,t:N,chop:N){
 // Two slowly advected, independent warps remove the parallel-ridge appearance.
 const warp=waterNoise(p.mul(.19).add(vec2(t.mul(-.035),t.mul(.018)))).mul(5.2);
 const cross=waterNoise(p.mul(.48).add(vec2(t.mul(.025),t.mul(-.041)))).mul(3.1);
 let slope:N=vec2(0),swell:N=float(0);
 // Wavelengths ~24, 11, 5, 2.3, 1.1, .5 m. Derivative filtering fades unresolved
 // detail continuously in screen space (also works when flying or changing FOV).
 for(const [x,z,k,speed,amplitude,warpMix] of [
  [.86,.51,.26,.37,.11,.6], [.48,.88,.57,.66,.095,1],
  [-.67,.74,1.24,.94,.075,.85], [.96,-.28,2.73,1.35,.055,1.2],
  [.33,.94,5.71,1.88,.032,1.6], [-.82,.57,12.3,2.65,.026,1.1],
 ]){
  const phase=dot(p,vec2(x,z)).mul(k).sub(t.mul(speed)).add(warp.mul(warpMix)).add(cross.mul(k>.6?1:.25));
  const resolved=float(1).sub(smoothstep(.35,1.8,fwidth(phase)));
  slope=slope.add(vec2(x,z).mul(cos(phase).mul(amplitude)).mul(resolved));
  if(k<1.3)swell=swell.add(sin(phase).mul(amplitude*3).mul(resolved));
 }
 const lace=waterNoise(p.mul(1.65).add(vec2(t.mul(-.19),t.mul(.11))));
 const crest=smoothstep(.57,.82,swell).mul(smoothstep(.55,.8,lace)).mul(.12).mul(chop);
 return {slope:slope.mul(chop),swell,crest,lace};
}
