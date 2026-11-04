import { BufferGeometry, Float32BufferAttribute, Group, type Material } from 'three';
import { mat, mesh } from '../../models/props/primitives';
import type { GymCollider, GymPoint } from '../avatarController';
import { groundHeight } from './elevation';
import { ACCESS_SURFACES } from './access';
import { mulberry32 } from '../../models/shared/random';
import { segmentCollider } from './parkFurniture';

/** Sloping masonry strip: omit buried bottoms and internal end faces. Coping and
 * wall share endpoint heights, so the skyline does not stair-step with DEM cells. */
function wallStrip(parent:Group,name:string,size:number,left:number,right:number,bottomLeft:number,bottomRight:number,width:number,ends:readonly boolean[],material:Material) {
  const x=size/2,z=width/2,positions:number[]=[],indices:number[]=[];
  const quad=(points:number[][])=>{const n=positions.length/3;positions.push(...points.flat());indices.push(n,n+1,n+2,n,n+2,n+3);};
  quad([[-x,bottomLeft,z],[x,bottomRight,z],[x,right,z],[-x,left,z]]);
  quad([[x,bottomRight,-z],[-x,bottomLeft,-z],[-x,left,-z],[x,right,-z]]);
  quad([[-x,left,z],[x,right,z],[x,right,-z],[-x,left,-z]]);
  if(ends[0])quad([[-x,bottomLeft,-z],[-x,bottomLeft,z],[-x,left,z],[-x,left,-z]]);
  if(ends[1])quad([[x,bottomRight,z],[x,bottomRight,-z],[x,right,-z],[x,right,z]]);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  const part=mesh(parent,name,geometry,material);part.userData.elevationPlaced=true;return part;
}

/** Photo-informed stone retaining faces. Plan positions and masonry dimensions
 * remain approximate; the DEM determines upper/lower levels. Preserve clear
 * openings around every mapped stair/pier approach. */
export function addShoreEdges(scenery: Group, colliders: GymCollider[]) {
  // Rubble seawall and pale cap colours from the city photos (p19, p34); estimates.
  const granite=mat('#a59e8f'), cap=mat('#cdc8ba');
  const rubble=[mat('#b0a898'),mat('#a39b8e'),mat('#978f82')],random=mulberry32(6256 ^ 0x575);
  const runs:GymPoint[][]=[[[85,-80],[75,-69],[65,-60],[59,-51],[56,-45],[55,-35],[54,-22],[53,-14]],[[2,33],[2.5,40],[4.3,48],[7.5,58],[12,66],[17,72],[22,76],[27,79]],[[10,10],[18,10.5],[26,11],[33,12.3],[40,14.1],[46,15]]];
  for(const run of runs) {
    // Measure every piece first, then smooth the coping along the run: real walls have a
    // continuous cap, not one stepped to each DEM sample. The top never drops below the
    // retained ground plus the original 0.55 m parapet allowance.
    const pieces:{x:number;z:number;dx:number;dz:number;length:number;size:number;bottom:number;floor:number}[]=[];
    for(let j=1;j<run.length;j++) {
      const a=run[j-1],b=run[j],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),count=Math.ceil(length/2.4);
      for(let i=0;i<count;i++) {
        const t=(i+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
        if(ACCESS_SURFACES.some(s=>Math.hypot(x-s.x,z-s.z)<s.width/2+1.1))continue;
        const nx=-dz/length,nz=dx/length,left=groundHeight(x+nx*3,z+nz*3),right=groundHeight(x-nx*3,z-nz*3),centre=groundHeight(x,z);
        pieces.push({x,z,dx,dz,length,size:length/count,bottom:Math.min(left,right,centre)-.15,floor:Math.max(left,right,centre)+.55});
      }
    }
    const tops=pieces.map((piece,k)=>{
      const window=pieces.slice(Math.max(0,k-2),k+3);
      return Math.max(piece.floor,window.reduce((sum,p)=>sum+p.floor,0)/window.length);
    });
    pieces.forEach((piece,k)=>{
      const {x,z,dx,dz,length,size,bottom}=piece,top=tops[k];
      const connected=(other:typeof piece|undefined)=>!!other&&Math.hypot(x-other.x,z-other.z)<(size+other.size)/2+.05;
      const before=connected(pieces[k-1]),after=connected(pieces[k+1]);
      const left=before?(top+tops[k-1])/2:top,right=after?(top+tops[k+1])/2:top;
      const angle=-Math.atan2(dz,dx),ends=[!before,!after];
      const stone=wallStrip(scenery,'Beach retaining wall · continuous photo-informed masonry',size,left,right,bottom,bottom,.48,ends,granite);
      stone.position.set(x,0,z);stone.rotation.y=angle;
      const coping=wallStrip(scenery,'Beach retaining wall · continuous pale coping',size,left+.075,right+.075,left,right,.54,ends,cap);
      coping.position.copy(stone.position);coping.rotation.copy(stone.rotation);
      // A few broad, irregular stone fields suggest the photographed rubble wall.
      // Paint only the lower-ground face. A 2 cm separation from the solid wall
      // avoids coplanar fighting; collision and the original retaining face stay put.
      const nx=-dz/length,nz=dx/length;
      const side=groundHeight(x+nx*3,z+nz*3)<groundHeight(x-nx*3,z-nz*3)?1:-1;
      if(top-bottom>1.0)for(let row=0;row<3;row++) {
        const halfWidth=(size-.14)*(.18+random()*.22),halfHeight=Math.min(.16+random()*.14,(top-bottom)*.14);
        const centreX=(random()-.5)*(size-2*halfWidth-.12);
        const centreY=(top-bottom)*((.12+row*.29)+random()*.10)-(top-bottom)/2;
        const skew=(random()-.5)*.20;
        const geometry=new BufferGeometry();
        geometry.setAttribute('position',new Float32BufferAttribute([
          centreX-halfWidth,centreY-halfHeight,.26*side, centreX+halfWidth,centreY-halfHeight+skew,.26*side,
          centreX+halfWidth-.10,centreY+halfHeight,.26*side, centreX-halfWidth+.09,centreY+halfHeight-skew,.26*side,
        ],3));
        geometry.setIndex(side>0?[0,1,2,0,2,3]:[0,2,1,0,3,2]);geometry.computeVertexNormals();
        const facing=mesh(scenery,'Beach retaining wall · photo-inspired granite field',geometry,rubble[(k+row)%rubble.length],x,(top+bottom)/2,z);
        facing.rotation.y=stone.rotation.y;facing.userData.elevationPlaced=true;
      }
      colliders.push(segmentCollider([x-dx/length*size/2,z-dz/length*size/2],[x+dx/length*size/2,z+dz/length*size/2],.54,Math.max(left,right)+.075));
    });
  }
}
