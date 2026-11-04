import { DEFAULT_SCHOOLING, type SchoolingTraits } from '../models/shared/school/schooling';
import type { DemoHabitat } from './demoRoute';

/** Exhibition composition, not wild abundance or a husbandry plan. */
export const DEMO_POPULATION: Readonly<Record<string,number>> = {
  'tuna':6,'pacific-sardine':256,'blue-rockfish':4,'ocean-sunfish':1,
  'california-sheephead':3,'kelp-greenling':3,'chinook-salmon':3,'garibaldi':4,
  'lingcod':2,'moon-jelly':4,'green-sea-turtle':2,'great-white-shark':1,'giant-sea-bass':1,'giant-pacific-octopus':1,
  'southern-sea-otter':1,
};
export const DEMO_BUDGET={drawCalls:72,triangles:450_000} as const;

/** Artistic spacing/steering for the small schools; facts and sources in docs/tank-demo.md. */
export const DEMO_SCHOOLS:Readonly<Record<string,SchoolingTraits>>={
  tuna:{...DEFAULT_SCHOOLING,spacing:1,shape:[1.6,.5,1],neighbours:5,sizeSpread:0,cruise:{slow:.525,fast:1.6},flex:{bend:.1,breathe:.06}},
  'blue-rockfish':{...DEFAULT_SCHOOLING,spacing:1.1,shape:[1.4,.75,1],neighbours:3,sizeSpread:0,cruise:{slow:.14,fast:.6},flex:{bend:.12,breathe:.08}},
};

/** Qualitative habitat preferences become gentle height/depth biases. Distances,
 * lanes and speeds are staging choices, not claims about measured preferred depths. */
export function demoHabitat(id:string,index:number):DemoHabitat{
  switch(id){
    case 'giant-pacific-octopus':return {level:-3.5,wave:0,width:.50,depth:.45,centerZ:.25};
    case 'tuna':return {level:0,wave:0,width:.96,depth:.9};
    case 'pacific-sardine':return {level:1.2,wave:.7,width:.96,depth:.9};
    case 'blue-rockfish':return {level:-.6,wave:.5,width:.76,depth:.62,centerZ:-.25};
    case 'lingcod':return {level:-3.05+index*.18,wave:.28,width:.85,depth:.65};
    case 'giant-sea-bass':return {level:-1.65,wave:.45,width:.82,depth:.7};
    case 'kelp-greenling':return {level:-3.05+index*.16,wave:.35,width:.8,depth:.6,centerZ:.18};
    case 'california-sheephead':return {level:-2.0+index*.25,wave:.5,width:.8,depth:.7};
    case 'garibaldi':return {level:-1.8+(index%2)*.6,wave:.4,width:.42,depth:.42,centerX:index%2?.5:-.5,centerZ:.3};
    case 'green-sea-turtle':return {level:2.1+index*.45,wave:.55,width:.94,depth:.9};
    case 'moon-jelly':return {level:1.0+index*.42,wave:.4,width:.28,depth:.3,centerX:index%2?.48:-.48,centerZ:-.25};
    case 'chinook-salmon':return {level:.2+index*.55,wave:.7,width:.96,depth:.92};
    case 'ocean-sunfish':return {level:-.2,wave:.65,width:.92,depth:.85};
    default:return {level:.15,wave:.65,width:.96,depth:.9};
  }
}
