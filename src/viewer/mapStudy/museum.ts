/** One placement adapter for the Gym and Map Study. Factories do not own view controls. */
import { Box3, BufferAttribute, Matrix4, Mesh, Vector3 } from 'three';
import { createPacificGroveMuseum } from '../../models/locations/pacificGroveMuseum';
import { MUSEUM_SITE, MUSEUM_WALLS, MUSEUM_UPPER, MUSEUM_ROOMS, museumToWorld, museumToLocal, museumSurface, inMuseumRect } from '../../data/pacificGroveMuseum';
import type { GymCollider, GymPoint } from '../avatarController';
const defaultOrigin:readonly[number,number]=[-121.91685,36.6256];
export function createMuseumArea(origin:readonly[number,number]=defaultOrigin){
  const model=createPacificGroveMuseum(),scale=Math.cos(origin[1]*Math.PI/180)/Math.cos(defaultOrigin[1]*Math.PI/180),r=Math.PI/180*6371008.8;
  const offsetX=(defaultOrigin[0]-origin[0])*r*Math.cos(origin[1]*Math.PI/180),offsetZ=-(defaultOrigin[1]-origin[1])*r;
  const transform=new Matrix4().set(MUSEUM_SITE.right[0]*scale,0,MUSEUM_SITE.back[0]*scale,0,0,1,0,0,MUSEUM_SITE.right[1],0,MUSEUM_SITE.back[1],0,0,0,0,1);
  model.root.traverse(o=>{if(!(o instanceof Mesh))return;o.geometry.applyMatrix4(transform);
    // The published drawing's right/inland axes form a reflected X/Z basis. Restore
    // winding once after baking, including all vertex attributes; roots stay unit scale.
    if(o.geometry.index){const a=o.geometry.index;for(let i=0;i<a.count;i+=3){const v=a.getX(i+1);a.setX(i+1,a.getX(i+2));a.setX(i+2,v);}}
    else for(const attr of Object.values(o.geometry.attributes) as BufferAttribute[]){const array=attr.array,n=attr.itemSize;for(let i=0;i<attr.count;i+=3)for(let k=0;k<n;k++){const a=(i+1)*n+k,b=(i+2)*n+k,v=array[a];array[a]=array[b];array[b]=v;}}
    o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  });
  model.root.position.set(MUSEUM_SITE.anchor[0]*scale+offsetX,MUSEUM_SITE.floor,MUSEUM_SITE.anchor[1]+offsetZ);model.root.updateMatrixWorld(true);
  const point=(x:number,z:number,y=0)=>{const w=museumToWorld(x,z);return new Vector3(w[0]*scale+offsetX,MUSEUM_SITE.floor+y,w[1]+offsetZ);};
  // Short conservative boxes approximate the rotated wall segments. All door gaps
  // come from the same plan as the visible walls, rather than one building-sized box.
  const colliders:GymCollider[]=[];
  for(const [x0,z0,x1,z1]of MUSEUM_WALLS){const n=Math.ceil(Math.hypot(x1-x0,z1-z0)/.3);for(let i=0;i<n;i++){const a=museumToWorld(x0+(x1-x0)*i/n,z0+(z1-z0)*i/n),b=museumToWorld(x0+(x1-x0)*(i+1)/n,z0+(z1-z0)*(i+1)/n);colliders.push({kind:'box',minX:Math.min(a[0],b[0])-.12,maxX:Math.max(a[0],b[0])+.12,minZ:Math.min(a[1],b[1])-.12,maxZ:Math.max(a[1],b[1])+.12});}}
  for(const [u,v,radius]of [[18,35,1.4]]){const [x,z]=museumToWorld(u,v);colliders.push({kind:'circle',x,z,radius});}
  const upperOutline:GymPoint[]=[[19,5.7],[30.8,5.7],[30.8,20.82],[8,20.82],[8,18.1],[13,18.1],[13,15],[16,15],[16,18.1],[19,18.1]].map(p=>museumToWorld(p[0],p[1]));
  // Upper walk loop is an explicit study floor; no automatic 2D floor snapping across the void.
  const upperColliders:GymCollider[]=[];
  const hole=[museumToWorld(21.7,9),museumToWorld(28.1,9),museumToWorld(28.1,17.8),museumToWorld(21.7,17.8)];
  for(let i=0;i<4;i++){const a=hole[i],b=hole[(i+1)%4],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])/.5);for(let k=0;k<=n;k++)upperColliders.push({kind:'circle',x:a[0]+(b[0]-a[0])*k/n,z:a[1]+(b[1]-a[1])*k/n,radius:.13});}
  const xs=upperOutline.map(p=>p[0]),zs=upperOutline.map(p=>p[1]),upperBounds={minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),walkable:upperOutline};
  const bounds=new Box3().setFromObject(model.root),center=bounds.getCenter(new Vector3());
  function roomAt(x:number,z:number){const [u,v]=museumToLocal(x,z);return MUSEUM_ROOMS.find(r=>inMuseumRect(u,v,r.rect))?.name??(inMuseumRect(u,v,[-.3,24.27,25.6,40])?'Native Plant Garden':undefined);}
  return {...model,bounds,center,point,colliders,upperColliders,upperBounds,upperPlan:MUSEUM_UPPER,roomAt,
    entrance:point(16.5,3,.045),upstairs:point(24.9,7.4,MUSEUM_SITE.upper+.045),floorAt:museumSurface,
    flightObstacle:{minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,top:MUSEUM_SITE.floor+9.3},
    // Getter must remain live after spreading the factory result.
    get view(){return model.view;},
  };
}
