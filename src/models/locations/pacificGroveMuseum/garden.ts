import { Group, BufferGeometry, Float32BufferAttribute } from 'three';
import { box, mat, mesh, blob, disc, beam, polygon } from './helpers';
/** Photo-informed garden arrangement. The published plan verifies loops/features,
 * not individual planting coordinates or the cultural installation's construction. */
export function addMuseumGarden(g:Group){
  const earth=mat('#9d986f'),path=mat('#dac7a0'),stone=mat('#b4afa0'),leaf=mat('#829b6b'),flower=mat('#d9ad69'),wood=mat('#97764e'),bark=mat('#7b644a');
  box(g,'Native garden soil',[25.9,1.6,15.9],earth,[12.65,-.82,32.15]);
  box(g,'Garden lobby patio',[10.26,1.6,3.45],path,[20.47,-.82,22.545]);
  const route=[[16.5,20.8],[16.5,27],[21,30],[21,36],[16,38],[5,38],[2,34],[3,29],[9,27],[16.5,27]];
  for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i],dx=b[0]-a[0],dz=b[1]-a[1],o=box(g,'Garden loop path',[2,.07,Math.hypot(dx,dz)+.3],path,[(a[0]+b[0])/2,.015,(a[1]+b[1])/2]);o.rotation.y=Math.atan2(dx,dz);}
  const branches=[[[16.5,27],[25.6,29]],[[9,27],[9,33]],[[2,34],[-.3,34]]];
  for(const [a,b]of branches){const dx=b[0]-a[0],dz=b[1]-a[1],o=box(g,'Garden connecting path',[1.6,.075,Math.hypot(dx,dz)],path,[(a[0]+b[0])/2,.017,(a[1]+b[1])/2]);o.rotation.y=Math.atan2(dx,dz);}
  let seed=241024;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const [x,z,rx,rz]of [[6,32,2.2,2.4],[13,34,2.2,2.3],[20,33,1.1,1.7],[3,25.5,1.5,.65],[18,39,3,.5],[23.8,35,1,3]]){
    disc(g,'Native planting bed',x,-.015,z,rx,earth,.12).scale.z=rz/rx;
    for(let i=0;i<8;i++){const t=rand()*Math.PI*2,r=Math.sqrt(rand()),xx=x+Math.cos(t)*rx*r,zz=z+Math.sin(t)*rz*r;blob(g,'Native shrub study',[xx,.3+rand()*.2,zz],[.35+rand()*.3,.3+rand()*.3,.4],leaf);if(i%3===0)blob(g,'Golden pollinator flowers',[xx,.78,zz],[.14,.09,.14],flower);}
  }
  for(const [x,z]of [[3.6,37],[23.2,31],[1.3,27]]){beam(g,'Garden tree',[x,0,z],[x+.2,3.6,z],.19,bark);for(let i=0;i<3;i++)blob(g,'Garden tree crown',[x+(i-1)*.65,3.4+i*.2,z],[1.3,.65,1],leaf);}
  // Sourced fossil pit; individual buried forms are original decorative stand-ins.
  box(g,'Fossil digging pit frame',[3.4,.22,2.1],wood,[10.5,.11,37.2]);box(g,'Fossil pit sand',[3.16,.12,1.86],path,[10.5,.19,37.2]);
  for(let i=0;i<5;i++){const x=9.5+i*.5;beam(g,'Fossil rib',[x,.27,36.8],[x+.16,.3,37.5],.09,stone);}beam(g,'Fossil spine',[9.4,.3,37.15],[11.8,.3,37.15],.14,stone);
  // Interpretive Seasonal Wheel: simplified stone ring, without invented symbolic artwork.
  disc(g,'Ohlone Seasonal Wheel study',5.7,.04,35.5,1.15,path,.09);for(let i=0;i<8;i++){const t=i*Math.PI/4;blob(g,'Seasonal Wheel stone',[5.7+Math.cos(t),.12,35.5+Math.sin(t)],[.22,.12,.18],stone);}
  // Ruk location/presence is sourced; this open shelter is explicitly a schematic study.
  const shelter=new Group();shelter.name='Traditional Ruk · schematic presence only';g.add(shelter);
  for(let i=1;i<12;i++){const a=i/12*Math.PI*2,b=(i+1)/12*Math.PI*2;polygon(shelter,'Schematic shelter covering',[[18+Math.sin(a)*1.4,0,35+Math.cos(a)*1.4],[18+Math.sin(b)*1.4,0,35+Math.cos(b)*1.4],[18+Math.sin(b)*.45,2,35+Math.cos(b)*.45],[18+Math.sin(a)*.45,2,35+Math.cos(a)*.45]],wood);beam(shelter,'Schematic shelter rib',[18+Math.sin(a)*1.45,0,35+Math.cos(a)*1.45],[18,2.6,35],.07,bark);}
  for(const [x,z]of [[3,30],[22.5,37]]){box(g,'Garden bench seat',[2,.12,.5],wood,[x,.48,z]);for(const dx of [-.75,.75])box(g,'Bench support',[.15,.44,.35],stone,[x+dx,.22,z]);}
  box(g,'Garden drinking fountain',[.45,.85,.4],stone,[24.8,.425,24]);disc(g,'Fountain basin',24.8,.89,24,.3,stone,.12);
  for(const [x,z]of [[6,28.5],[12.8,35.2],[19.5,30.5]]){beam(g,'Plant interpretation post',[x,0,z],[x,.8,z],.08,wood);box(g,'Plant interpretation panel',[.7,.05,.35],leaf,[x,.85,z]).rotation.x=.25;}
  // Sandy: original grey-whale study. About 12.2 m long, provisional size from the
  // museum's quoted 40 ft sculpture description; not a scan or copied mesh.
  const gray=mat('#92999a'),light=mat('#bdc2b9'),dark=mat('#4c5c63'),whale=new Group();whale.position.set(29.5,-.75,-1.65);g.add(whale);
  const stations=[[-6.1,.05,.03],[-5.6,.5,.55],[-4.6,.95,.98],[-2.8,1.22,1.28],[-.6,1.06,1.05],[1.6,.67,.63],[3.8,.3,.3],[5.1,.17,.22]];
  const verts:number[]=[],indices:number[]=[];
  for(const [x,ry,rz]of stations)for(let j=0;j<12;j++){const t=j/12*Math.PI*2;verts.push(x,.42+Math.sin(t)*ry,Math.cos(t)*rz);}
  for(let i=0;i<stations.length-1;i++)for(let j=0;j<12;j++){const a=i*12+j,b=i*12+(j+1)%12;indices.push(a,b,a+12,b,b+12,a+12);}
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();mesh(whale,'Sandy grey whale body',geo,gray);
  for(const d of [-1,1]){blob(whale,'Whale fluke',[5.1,.35,d*.95],[.92,.12,1.3],gray).rotation.y=-d*.35;blob(whale,'Whale pectoral flipper',[-2.5,-.1,d*1.3],[1.1,.12,.48],gray).rotation.y=d*.45;blob(whale,'Sandy eye',[-5.1,.6,d*.7],[.07,.07,.025],dark);}
  for(let i=0;i<16;i++){const x=-4.9+rand()*7.2,z=(rand()-.5)*1.25;blob(whale,'Whale mottling',[x,1.34-Math.abs(x+1.8)*.065,z],[.12+rand()*.14,.018,.15],light);}
}
