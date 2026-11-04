import {Color} from 'three';
import {jellySurface} from './surface';
/** Radius and height in bell-radius units: a low crown and a flexible, downturned margin. */
const PROFILE=[[0,.31],[.20,.30],[.45,.26],[.70,.17],[.88,.075],[1,0]] as const;
export const BELL_SECTORS=40;
export function bellHeight(radial:number,heightScale=1){
 const t=Math.max(0,Math.min(1,radial));let i=0;while(i<PROFILE.length-2&&t>PROFILE[i+1][0])i++;
 const a=PROFILE[i],b=PROFILE[i+1];return (a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]))*heightScale;
}
export function bellRadius(angle:number,radial=1){return radial*(1-.008*(1+Math.cos(angle*8))*radial**4);}
export function buildBell(radius:number,heightScale:number){
 const s=jellySurface(),crown=new Color('#cbd6dc'),margin=new Color('#a5c3d0');
 s.vertex([0,bellHeight(0,heightScale)*radius,0],crown);
 for(let ring=1;ring<PROFILE.length;ring++)for(let i=0;i<BELL_SECTORS;i++){
  const a=i/BELL_SECTORS*Math.PI*2,t=PROFILE[ring][0],r=radius*bellRadius(a,t);
  s.vertex([Math.cos(a)*r,bellHeight(t,heightScale)*radius,Math.sin(a)*r],crown.clone().lerp(margin,t*t));
  const next=(i+1)%BELL_SECTORS,current=1+(ring-1)*BELL_SECTORS+i;
  if(ring===1)s.triangle(0,1+next,current);
  else {const previous=current-BELL_SECTORS,previousNext=1+(ring-2)*BELL_SECTORS+next,currentNext=1+(ring-1)*BELL_SECTORS+next;s.triangle(previous,previousNext,current);s.triangle(previousNext,currentNext,current);}
 }
 // Turn the lip inward very slightly so the membrane has a rounded edge from below.
 const last=1+4*BELL_SECTORS,lip=1+5*BELL_SECTORS;
 for(let i=0;i<BELL_SECTORS;i++){
  const a=i/BELL_SECTORS*Math.PI*2,r=radius*bellRadius(a)*.985,next=(i+1)%BELL_SECTORS;
  s.vertex([Math.cos(a)*r,-radius*.026,Math.sin(a)*r],margin);
  s.triangle(last+i,last+next,lip+i);s.triangle(last+next,lip+next,lip+i);
 }
 const g=s.build();g.userData.components=[{name:'scalloped-bell-and-rolled-margin',start:0,count:g.index!.count}];return g;
}
