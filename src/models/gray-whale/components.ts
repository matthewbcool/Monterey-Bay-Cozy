import { BoxGeometry, BufferGeometry, Color, Float32BufferAttribute, SphereGeometry, TubeGeometry, CatmullRomCurve3, Vector3 } from 'three';
import type { MeshToonMaterial } from 'three';
import type { ModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { flankAt, sectionAt, skinGeometry, solidColor } from '../shared/fish/geometry';
import { GRAY_WHALE as W } from './definition';

/** One flat, closed low-poly fin. Component shapes remain editable before the shared batch. */
function membrane(points: readonly (readonly [number,number,number])[], thickness: number) {
  const center = points.reduce((sum,p)=>sum.add(new Vector3(...p)),new Vector3()).multiplyScalar(1/points.length);
  const position:number[]=[],index:number[]=[];
  for (const sign of [1,-1]) {
    const offset=position.length/3;
    position.push(center.x,center.y+sign*thickness/2,center.z);
    for(const p of points)position.push(p[0],p[1]+sign*thickness/2,p[2]);
    for(let i=0;i<points.length;i++){
      const a=offset+1+i,b=offset+1+(i+1)%points.length;
      if(sign>0)index.push(offset,a,b);else index.push(offset,b,a);
    }
  }
  for(let i=0;i<points.length;i++){
    const j=(i+1)%points.length,n=points.length+1;
    index.push(1+i,1+j,n+1+j,1+i,n+1+j,n+1+i);
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(position,3));g.setIndex(index);g.computeVertexNormals();return g;
}

export function buildGrayWhale(a:ModelAssembly,material:MeshToonMaterial,length:number,seed:number){
  const add=(name:string,g:BufferGeometry,color:string,bone=0)=>{
    solidColor(g,color);skinGeometry(g,bone);g.scale(length,length,length);
    a.addMesh(a.parts.get(name)??a.addPart(name),g,material);
  };
  // Painted spots cost no overlay triangles. The gray/cream boundary follows the body section.
  const dark=new Color('#596770'),mid=new Color('#7d8988'),pale=new Color('#b6b3a5');
  buildFishBody(a,{profile:W.profile,segments:[27,14]},material,(x,h,side,out)=>{
    const t=Math.min(1,Math.max(0,(.22-h)/1.25));out.copy(dark).lerp(mid,t*.68);
    if(h<-.42)out.lerp(pale,Math.min(1,(-h-.42)*1.25));
    const mottling=Math.sin(x*34+seed*.0000017+side*5)*Math.cos(x*22-h*9+seed*.000003);
    const scarring=Math.sin(x*67+h*27+side*6)*Math.sin(x*49-h*23);
    out.multiplyScalar(1+.19*mottling+.07*scarring);
  },length);
  // Broad, pointed pectorals angle down and aft from the body; fin roots overlap it.
  for(const side of [-1,1]){
    add(`pectoral-${side}`,membrane([
      [-.253,-.034,side*.080],[-.190,-.071,side*.112],
      [-.095,-.130,side*.175],[.040,-.160,side*.225],
      [.064,-.145,side*.227],[.018,-.118,side*.192],
      [-.099,-.052,side*.106],
    ],.006),'#68777a');
  }
  // Gray whales have a hump and knuckles, not a tall dorsal fin.
  const hump=sectionAt(W.profile,.145);
  add('dorsal-hump',new SphereGeometry(1,8,4).scale(.057,.012,.027).translate(.145,hump.y+hump.depth-.008,0),'#64727a',1);
  for(let i=0;i<8;i++){
    const x=.205+i*.023,section=sectionAt(W.profile,x),y=section.y+section.depth-.004;
    add('dorsal-knuckles',new SphereGeometry(1,5,3).scale(.010-i*.0007,.010-i*.0006,.009-i*.0006).translate(x,y,0),'#66747a',i>4?2:1);
  }
  // Two horizontal flukes with a small median notch, rooted at the narrow peduncle.
  for(const side of [-1,1])add(`fluke-${side}`,membrane([
    [.370,.014,0],[.408,.014,side*.047],[.460,.014,side*.137],
    [.492,.014,side*.184],[.494,.014,side*.162],[.475,.014,side*.103],
    [.455,.014,side*.028],[.451,.014,side*.009],
  ],.005),'#55636a',2);
  // Short mouth curves and paired blowhole marks. Barnacle hints are sparse geometry.
  for(const side of [-1,1]){
    const mouth=[[-.498,-.010],[-.456,-.024],[-.407,-.023],[-.365,-.015]].map(([x,y])=>new Vector3(x,y,flankAt(W.profile,x,y,side)));
    add('mouth',new TubeGeometry(new CatmullRomCurve3(mouth),7,.0017,3,false),'#35474d');
    add('blowholes',new SphereGeometry(1,5,3).scale(.011,.002,.004).translate(-.412,.065,side*.010),'#35434a');
    const eyeX=-.377,eyeY=-.012,z=flankAt(W.profile,eyeX,eyeY,side);
    add('eyes',new SphereGeometry(1,7,4).scale(.005,.0045,.002).translate(eyeX,eyeY,z+side*.002),'#1b333b');
    for(const direction of [-1,1])add('eyes-caught',new BoxGeometry(.014,.0020,.002).rotateZ(direction*Math.PI/4).translate(eyeX,eyeY,z+side*.003),'#25383e');
  }
  for(let i=0;i<10;i++){
    const x=-.459+(i%5)*.023,y=.025+Math.floor(i/5)*.019,side=i%2?1:-1;
    const z=flankAt(W.profile,x,y,side);
    add('barnacle-hints',new SphereGeometry(1,5,3).scale(.004+(i%3)*.001,.003,.0018).translate(x,y,z),'#b6b2a0');
  }
}
