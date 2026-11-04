import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import {Group,Mesh} from 'three';
import features from '../src/data/lovers-point-features.json';
import {disposeObject} from '../src/models/props/primitives';
import {canStandAt,type GymCollider} from '../src/viewer/avatarController';
import {addCafeTerrace} from '../src/viewer/testingGym/cafeTerrace';
import {ACCESS_SURFACES,addBeachAccess} from '../src/viewer/testingGym/access';
import {addShoreEdges} from '../src/viewer/testingGym/shore';
const bounds={minX:-145,maxX:150,minZ:-160,maxZ:130};

test('cafe furniture preserves mapped pedestrian corridors and has valid two-sided canopy normals',()=>{
 const root=new Group(),colliders:GymCollider[]=[];addCafeTerrace(root,colliders);
 try{
  let checked=0;
  for(const route of features.paths.filter(p=>p.highway==='footway'))for(let i=1;i<route.points.length;i++){
   const a=route.points[i-1],b=route.points[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.25);
   for(let j=0;j<=n;j++){
    const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;
    if(x< -15||x>20||z<69||z>90)continue;
    assert(canStandAt(x,z,bounds,colliders,.4),`${route.id}: furniture blocks path at ${x},${z}`);checked++;
   }
  }
  assert(checked>50);
  root.traverse(o=>{if(!(o instanceof Mesh))return;const normal=o.geometry.getAttribute('normal');for(let i=0;i<normal.count;i++)assert(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))>.99,'Missing face normal');});
 }finally{disposeObject(root);}
});

test('refined walls and pier rails leave all mapped stair/pier centerlines traversable',()=>{
 const root=new Group(),colliders:GymCollider[]=[];addShoreEdges(root,colliders);addBeachAccess(root,colliders);
 try{for(const s of ACCESS_SURFACES)assert(canStandAt(s.x,s.z,bounds,colliders,.4),`${s.sourceId}: wall blocks access at ${s.x},${s.z}`);}
 finally{disposeObject(root);}
});
