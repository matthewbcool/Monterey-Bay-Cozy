import {Color} from 'three';
import {mulberry32} from '../../shared/random';
import {bellHeight,bellRadius,BELL_SECTORS} from './bell';
import {jellySurface,type JellyPoint} from './surface';

/** Low-contrast canals, broad horseshoes and folded oral tissue share one translucent toon batch. */
export function buildAnatomy(radius:number,heightScale:number,seed:number){
 const s=jellySurface(),random=mulberry32(seed),rim=new Color('#c8d7de'),canal=new Color('#93b3c4'),organEdge=new Color('#a296b2'),organCore=new Color('#d7b9ce'),armEdge=new Color('#bfced8'),armFold=new Color('#8fa6bd');
 const polar=(t:number,a:number,y:number):JellyPoint=>[radius*bellRadius(a,t)*Math.cos(a),y*radius,radius*bellRadius(a,t)*Math.sin(a)];
 const ring:JellyPoint[][]=[];
 for(let i=0;i<=BELL_SECTORS;i++){const a=i/BELL_SECTORS*Math.PI*2;ring.push([polar(.979,a,bellHeight(.979,heightScale)-.012),polar(1,a,-.012)]);}
 s.strip('soft-margin',ring,[rim]);
 for(let i=0;i<4;i++){
  const a=i*Math.PI/2,rows:JellyPoint[][]=[],cx=Math.cos(a)*.32,cz=Math.sin(a)*.32;
  for(let j=0;j<=16;j++){
   const angle=a+Math.PI+.48+j/16*(Math.PI*2-.96);
   rows.push([-.055,0,.055].map(w=>{
    const distance=.19+w,x=cx+Math.cos(angle)*distance,z=cz+Math.sin(angle)*distance;
    return [x*radius,(.18+(w===0?.018:0))*radius,z*radius] as JellyPoint;
   }));
  }
  s.strip(`horseshoe-${i+1}`,rows,[organEdge,organCore,organEdge]);
  const foldPhase=random()*Math.PI*2,armLength=.54+random()*.07,armRows:JellyPoint[][]=[];
  for(let j=0;j<=12;j++){
   const t=j/12,angle=a+.22*Math.sin(t*Math.PI+foldPhase),distance=.035+.22*Math.sin(t*Math.PI*.7),y=.105-t*armLength;
   const width=(.025+.11*Math.sin(t*Math.PI)**.7)*(1+.28*Math.sin(t*10*Math.PI+foldPhase));
   armRows.push([-1,0,1].map(side=>{
    const w=width*side,pleat=side===0?-.012*Math.sin(t*Math.PI):.024*Math.sin(t*8*Math.PI+foldPhase+side*.7)*t;
    return [(Math.cos(angle)*distance-Math.sin(angle)*w)*radius,(y+pleat)*radius,(Math.sin(angle)*distance+Math.cos(angle)*w)*radius] as JellyPoint;
   }));
  }
  s.strip(`ruffled-oral-arm-${i+1}`,armRows,[armEdge,armFold,armEdge]);
 }
 // Small central mouth joins all four oral-arm roots. No eye anatomy is invented.
 s.strip('central-mouth',[[[-.045*radius,.10*radius,-.045*radius],[-.045*radius,.10*radius,.045*radius]],[[.045*radius,.10*radius,-.045*radius],[.045*radius,.10*radius,.045*radius]]],[armFold]);
 function canalStrip(name:string,points:readonly [number,number][]){
  s.strip(name,points.map(([t,a])=>[-1,1].map(side=>polar(t,a+side*.0028/Math.max(t,.1),bellHeight(t,heightScale)-.025))),[canal]);
 }
 for(let i=0;i<16;i++){
  const a=i*Math.PI/8;
  canalStrip(`radial-canal-${i+1}`,[[.20,a],[.38,a+.015],[.58,a],[.78,a-.012],[.975,a]]);
  if(i%2===0)for(const side of [-1,1])canalStrip(`canal-branch-${i}-${side}`,[[.58,a],[.72,a+side*.065],[.85,a+side*.105],[.975,a+side*.13]]);
 }
 for(let i=0;i<48;i++){
  const a=i*Math.PI/24,length=.075+random()*.085,rows:JellyPoint[][]=[];
  for(let j=0;j<=3;j++){
   const t=j/3,angle=a+.025*Math.sin(t*Math.PI*.8+i),width=.0028*(1-.75*t),distance=bellRadius(a)*(.995-.02*t*t);
   rows.push([-1,1].map(side=>[(Math.cos(angle)*distance-Math.sin(angle)*width*side)*radius,(-.012-t*length)*radius,(Math.sin(angle)*distance+Math.cos(angle)*width*side)*radius] as JellyPoint));
  }
  s.strip(`short-fringe-${i+1}`,rows,[rim]);
 }
 return s.build();
}
