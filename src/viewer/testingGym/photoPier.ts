import type {GymPoint} from '../avatarController';
/** November 3 reference photos: OSM alignment, provisional metre-scale section.
 * Never mutate the cached map/DEM to turn an interpretation into survey data. */
export const PHOTO_PIER={start:[66.171,11.042] as GymPoint,end:[77.067,23.729] as GymPoint,upper:4.65,lower:2.05,halfWidth:1.6,landingWidth:2.6,stairLength:5.2} as const;
const dx=PHOTO_PIER.end[0]-PHOTO_PIER.start[0],dz=PHOTO_PIER.end[1]-PHOTO_PIER.start[1];
export const PIER_LENGTH=Math.hypot(dx,dz),PIER_DIRECTION=[dx/PIER_LENGTH,dz/PIER_LENGTH] as const;
export function pierPoint(along:number,side:number):GymPoint{return[PHOTO_PIER.start[0]+PIER_DIRECTION[0]*along-PIER_DIRECTION[1]*side,PHOTO_PIER.start[1]+PIER_DIRECTION[1]*along+PIER_DIRECTION[0]*side];}
export function pierQuad(start:number,end:number,left:number,right:number):GymPoint[]{return[pierPoint(start,left),pierPoint(end,left),pierPoint(end,right),pierPoint(start,right)];}
