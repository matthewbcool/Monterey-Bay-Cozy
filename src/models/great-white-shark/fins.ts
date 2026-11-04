import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import type { FishDesign } from '../shared/fish/design';
import { addFishFin } from '../shared/fish/fins';
import { bellyAt, flankAt } from '../shared/fish/geometry';
import { createSharkFoil, type FinPoint, type FinSection } from './foil';

export function buildSharkFins(a:ModelAssembly,d:FishDesign,material:MeshToonMaterial,length:number) {
  const upper=(x:number)=>bellyAt(d.profile,x,0,1)-.012;
  const lower=(x:number,z=0)=>bellyAt(d.profile,x,z)+.010;
  function foil(name:string,sections:FinSection[],tip:FinPoint,axis:'y'|'z',bone?:number) {
    const g=createSharkFoil(sections,tip,axis,axis==='y'?['#727775','#c6cbc2']:['#69716f','#69716f'],bone);
    g.scale(length,length,length);a.addMesh(a.addPart(name),g,material);
  }
  const dorsal:FinSection[]=[
    {leading:[-.184,upper(-.184),0],trailing:[.012,upper(.012),0],thickness:.011},
    {leading:[-.165,.116,0],trailing:[-.022,.111,0],thickness:.009},
    {leading:[-.142,.155,0],trailing:[-.060,.148,0],thickness:.006},
    {leading:[-.111,.190,0],trailing:[-.073,.182,0],thickness:.004},
    {leading:[-.082,.210,0],trailing:[-.069,.201,0],thickness:.002},
  ];
  foil('first-dorsal',dorsal,[-.066,.214,0],'z',0);
  addFishFin(a,'second-dorsal',[[.232,upper(.232)],[.254,.054],[.270,.066],[.276,.064],[.278,.045],[.301,.030],[.280,upper(.280)]],material,'#69716f',length,{depth:.003});
  // Two curved, tapered lobes meet around the peduncle; no constant-thickness tail plate.
  for(const side of [-1,1]) {
    const height=side===1?.171:.139;
    foil(`caudal-${side}`,[
      {leading:[.362,.008,0],trailing:[.414,.008,0],thickness:.011},
      {leading:[.378,side*height*.27,0],trailing:[.437,side*height*.22,0],thickness:.008},
      {leading:[.398,side*height*.60,0],trailing:[.460,side*height*.52,0],thickness:.005},
      {leading:[.438,side*height*.88,0],trailing:[.487,side*height*.82,0],thickness:.003},
      {leading:[.481,side*height,0],trailing:[.499,side*height*.97,0],thickness:.001},
    ],[.5,side*height*.985,0],'z');
    const rootZ=(x:number,y:number)=>side*(Math.abs(flankAt(d.profile,x,y,1))-.012);
    foil(`pectoral-${side}`,[
      {leading:[-.256,-.027,rootZ(-.256,-.027)],trailing:[-.128,-.035,rootZ(-.128,-.035)],thickness:.008},
      {leading:[-.241,-.032,side*.125],trailing:[-.080,-.041,side*.125],thickness:.009},
      {leading:[-.196,-.041,side*.184],trailing:[-.030,-.053,side*.184],thickness:.007},
      {leading:[-.130,-.055,side*.235],trailing:[.007,-.065,side*.235],thickness:.005},
      {leading:[-.058,-.071,side*.274],trailing:[.026,-.079,side*.274],thickness:.0025},
    ],[.041,-.086,side*.290],'y',0);
    const z=side*.024;
    foil(`pelvic-${side}`,[
      {leading:[.095,lower(.095,z),z],trailing:[.177,lower(.177,z),z],thickness:.003},
      {leading:[.135,-.061,side*.058],trailing:[.196,-.064,side*.058],thickness:.002},
    ],[.212,-.069,side*.085],'y');
    foil(`caudal-keel-${side}`,[
      {leading:[.300,.007,side*.012],trailing:[.392,.008,side*.009],thickness:.002},
    ],[.354,.008,side*.032],'y');
  }
  addFishFin(a,'anal',[[.267,lower(.267)],[.291,-.051],[.303,-.055],[.301,-.035],[.319,lower(.319)]],material,'#c6cbc2',length,{depth:.003});
}
