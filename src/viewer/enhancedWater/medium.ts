/** RGB Beer-Lambert extinction and closed-form single scattering in metre-space.
 * Original TSL implementation; optical structure follows Minamo's public rendering notes.
 * Coefficients are an artistic clear coastal-water preset, not Monterey measurements.
 */
import {Vector3} from 'three';
import {abs,clamp,dot,exp,float,max,mix,normalize,pow,refract,select,uniform,vec3} from 'three/tsl';
import {waveNode} from '../water';
type N=any;
export const WATER_MEDIUM={absorption:[.42,.065,.025],scattering:[.020,.030,.045],ior:1.333,maxPath:80} as const;
export function createWaterMedium(water:any){
 const absorption=uniform(new Vector3(...WATER_MEDIUM.absorption)),scattering=uniform(new Vector3(...WATER_MEDIUM.scattering));
 const origin=uniform(water.root.position.clone());
 const sigma=absorption.add(scattering),kd=absorption.add(scattering.mul(.25));
 const height=(xz:N):N=>waveNode(xz.sub(origin.xz),water.uniforms.time,water.uniforms.chop).x.add(origin.y);
 const depth=(p:N):N=>max(0,height(p.xz).sub(p.y));
 const down=refract(water.uniforms.sun.negate(),vec3(0,1,0),1/WATER_MEDIUM.ior);
 const lightCos=max(.2,down.y.negate()),kdSun=kd.div(lightCos);
 function integral(k:N,d:N):N{
  const safe=select(abs(k).lessThan(.0001),vec3(.0001),k);
  return select(abs(k).lessThan(.0001),vec3(d),float(1).sub(exp(clamp(k.mul(d).negate(),-60,30))).div(safe));
 }
 function phase(c:N,g:number):N{return float(1-g*g).div(pow(max(.001,float(1+g*g).sub(c.mul(2*g))),1.5).mul(4*Math.PI));}
 function integrate(color:N,start:N,direction:N,length:N,shafts:N=vec3(1)):N{
  const d=clamp(length,0,WATER_MEDIUM.maxPath),depth0=depth(start);
  const trans=exp(sigma.mul(d).negate());
  const mu=dot(normalize(direction),down.negate());
  const hg=phase(mu,.9).mul(.85).add(phase(mu,.2).mul(.15));
  const direct=scattering.mul(hg).mul(water.uniforms.sunColor).mul(water.uniforms.sunStrength).mul(8)
   .mul(exp(kdSun.mul(depth0).negate())).mul(integral(sigma.sub(kdSun.mul(direction.y)),d)).mul(shafts);
  const ambient=scattering.mul(mix(water.uniforms.skyZenith,water.uniforms.skyHorizon,.5)).mul(2.2)
   .mul(exp(kd.mul(depth0).negate())).mul(integral(sigma.sub(kd.mul(direction.y)),d));
  return clamp(color.mul(trans).add(direct).add(ambient),0,16);
 }
 return {absorption,scattering,origin,height,depth,down,kd,kdSun,integrate};
}
