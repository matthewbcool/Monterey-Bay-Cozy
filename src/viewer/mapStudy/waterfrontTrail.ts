/** Map-backed facilities plus explicitly authored gaps along the coastal cycleway. */
import { BufferGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, Vector3 } from 'three';
import polygonClipping from 'polygon-clipping';
import amenities from '../../data/waterfront-amenities.json';
import data from '../../data/pacific-grove-waterfront.json';
import { box, cylinder, mat, mesh } from '../../models/props/primitives';
import { insidePolygon, type GymCollider, type GymPoint } from '../avatarController';
const routes=data.paths.filter(p=>p.name==='Monterey Bay Coastal Trail');
const land=data.land.map(p=>[p[0],p[1]] as GymPoint);
export const TRAIL_SOURCE=amenities;
export function nearestCoastalTrail(x:number,z:number){
 let best={distance:Infinity,x:0,z:0,dx:1,dz:0};
 for(const r of routes){const[a,b]=r.points,dx=b[0]-a[0],dz=b[1]-a[1],n=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/n)),xx=a[0]+t*dx,zz=a[1]+t*dz,d=Math.hypot(xx-x,zz-z);
 if(d<best.distance)best={distance:d,x:xx,z:zz,dx:dx/Math.sqrt(n),dz:dz/Math.sqrt(n)};}return best;
}
/** Split a path ribbon at the exact DEM triangle boundaries so paving cannot cut into hills. */
export function drapedTrailGeometry(ring:number[][],height:(x:number,z:number)=>number){
 const grid=data.terrain.grid,positions:number[]=[];
 const loX=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[0]))-grid.minX)/grid.stepX)),hiX=Math.min(grid.columns-2,Math.floor((Math.max(...ring.map(p=>p[0]))-grid.minX)/grid.stepX));
 const loZ=Math.max(0,Math.floor((Math.min(...ring.map(p=>p[1]))-grid.minZ)/grid.stepZ)),hiZ=Math.min(grid.rows-2,Math.floor((Math.max(...ring.map(p=>p[1]))-grid.minZ)/grid.stepZ));
 for(let j=loZ;j<=hiZ;j++)for(let i=loX;i<=hiX;i++){
  const x=grid.minX+i*grid.stepX,z=grid.minZ+j*grid.stepZ,xx=x+grid.stepX,zz=z+grid.stepZ;
  for(const tri of [[[x,z],[xx,z],[xx,zz]],[[x,z],[xx,zz],[x,zz]]])for(const p of polygonClipping.intersection([ring] as polygonClipping.Polygon,[tri] as polygonClipping.Polygon)){
   const points=p[0].slice(0,-1);for(let n=1;n<points.length-1;n++){const t=[points[0],points[n],points[n+1]];
    if((t[1][1]-t[0][1])*(t[2][0]-t[0][0])-(t[1][0]-t[0][0])*(t[2][1]-t[0][1])<0)t.reverse();
    for(const v of t)positions.push(v[0],height(v[0],v[1])+.09,v[1]);}
  }
 }
 const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
export function addWaterfrontTrail(source:Group,height:(x:number,z:number)=>number,colliders:GymCollider[]){
 const wood=mat('#927350'),support=mat('#677779'),stone=mat('#c6c0aa'),green=mat('#719570'),flower=mat('#c5ac94');
 const records:{id:string;kind:string;x:number;z:number;basis:string}[]=[],seats:{id:string;x:number;z:number;y:number;yaw:number}[]=[];
 function clear(x:number,z:number,r=.8){return insidePolygon(x,z,land)&&!colliders.some(b=>b.kind==='box'&&x>b.minX-r&&x<b.maxX+r&&z>b.minZ-r&&z<b.maxZ+r);}
 function add(kind:string,x:number,z:number,id:string,basis:string,back=true){
  if(!clear(x,z))return;const shore=data.coast.reduce((a,b)=>Math.hypot(a[0]-x,a[1]-z)<Math.hypot(b[0]-x,b[1]-z)?a:b),part=new Group(),y=height(x,z);part.position.set(x,y,z);part.rotation.y=Math.atan2(shore[0]-x,shore[1]-z);source.add(part);
  if(kind==='bench'){
   box(part,'Trail bench seat',[1.8,.10,.47],wood,[0,.48,0]);if(back)box(part,'Trail bench back',[1.8,.34,.08],wood,[0,.84,-.21]);
   for(const side of [-1,1]){box(part,'Bench legs',[.10,.48,.40],support,[side*.66,.24,0]);if(back)box(part,'Bench back post',[.08,.65,.08],support,[side*.66,.65,-.20]);}
   seats.push({id,x,z,y:y+.53,yaw:part.rotation.y});
  }else if(kind==='waste_basket'){
   cylinder(part,'Concrete litter bin',.29,.82,stone,[0,.41,0]);cylinder(part,'Recessed bin opening',.22,.04,support,[0,.84,0]);
  }else if(kind==='bicycle_parking'){
   for(let n=-1;n<=1;n++){for(const z of [-.32,.32])cylinder(part,'Bicycle stand leg',.035,.70,support,[n*.65,.35,z]);box(part,'Bicycle stand bar',[.07,.07,.70],support,[n*.65,.70,0]);}
  }else{
   for(const side of [-1,1])box(part,'Interpretation board post',[.08,1.05,.08],support,[side*.4,.525,0]);box(part,'Interpretation board',[1.0,.44,.08],wood,[0,1.06,0]);box(part,'Illustrative panel',[.87,.32,.012],stone,[0,1.06,.047]);
  }
  records.push({id,kind,x,z,basis});colliders.push({kind:'circle',x,z,radius:kind==='bench'?.94:kind==='bicycle_parking'?.9:.42});
 }
 for(const p of amenities.items){const[x,z]=p.position;if(nearestCoastalTrail(x,z).distance<=45)add(p.kind,x,z,p.id,'OSM position; inferred orientation and dimensions',p.tags.backrest!=='no');}
 // Fill widely separated gaps with clearly authored rest areas; retain exact mapped nodes above.
 const samples:{x:number;z:number;dx:number;dz:number}[]=[];
 for(const r of routes){const[a,b]=r.points,length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<length;d+=12){const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;if(samples.some(p=>Math.hypot(p.x-x,p.z-z)<11))continue;samples.push({x,z,dx:(b[0]-a[0])/length,dz:(b[1]-a[1])/length});}}
 let rest=0,plantCount=0,fenceCount=0;
 for(const p of samples.sort((a,b)=>a.x-b.x)){
  // Pick the landward normal; never place vegetation or seating in the 2.2 m travel corridor.
  let nx=-p.dz,nz=p.dx;if(!clear(p.x+nx*4,p.z+nz*4)){nx=-nx;nz=-nz;}
  const x=p.x+nx*3.8,z=p.z+nz*3.8;
  if(clear(x,z)&&nearestCoastalTrail(x,z).distance>2.4){
   const cluster=new Group();source.add(cluster);
   for(let n=0;n<3;n++){const xx=x+p.dx*(n-1)*.65,zz=z+p.dz*(n-1)*.65;if(!clear(xx,zz,.5)||nearestCoastalTrail(xx,zz).distance<2.3)continue;const g=new IcosahedronGeometry(1,0);g.scale(.52,.32,.48);mesh(cluster,'Authored trail-side coastal planting',g,n===1?flower:green,xx,height(xx,zz)+.23,zz);plantCount++;}
   if(rest<9&&records.every(q=>Math.hypot(q.x-x,q.z-z)>115)){add('bench',x+nx,z+nz,'authored-rest-'+rest,'Authored rest stop; city inventory supports facility type');
    if(rest%3===1)add('information',x+nx*2+p.dx*2,z+nz*2+p.dz*2,'authored-board-'+rest,'Authored interpretation panel; no invented sign text');
    if(rest%3===2)add('waste_basket',x+nx*2+p.dx*2,z+nz*2+p.dz*2,'authored-bin-'+rest,'Authored infill; city inventory supports facility type');
    if(rest===0||rest===7)add('bicycle_parking',x+nx*2-p.dx*3,z+nz*2-p.dz*3,'authored-rack-'+rest,'Authored bicycle rest-stop equipment');rest++;}
  }
  // Berwick's sectional trail fence is documented; span, height and gaps are approximations.
  if(p.x>350&&p.x<565&&clear(x,z)&&nearestCoastalTrail(x,z).distance>2.4){
   const a=new Vector3(x-p.dx*2.4,height(x-p.dx*2.4,z-p.dz*2.4)+.65,z-p.dz*2.4),b=new Vector3(x+p.dx*2.4,height(x+p.dx*2.4,z+p.dz*2.4)+.65,z+p.dz*2.4);
   for(const v of [a,b])box(source,'Berwick sectional fence post',[.12,1,.12],wood,[v.x,v.y-.15,v.z]);
   for(const dy of [-.25,.13]){const beam=box(source,'Berwick fence rail',[.08,.09,a.distanceTo(b)],wood,[(a.x+b.x)/2,(a.y+b.y)/2+dy,(a.z+b.z)/2]);beam.quaternion.setFromUnitVectors(new Vector3(0,0,1),b.clone().sub(a).normalize());}fenceCount++;
  }
 }
 return {records,seats,plantCount,fenceCount,routeSegments:routes.length};
}
