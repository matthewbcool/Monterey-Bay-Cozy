/** The detailed ripple water is cut at the mapped local coast. The regional map owns
 * water beyond this bounded Gym patch, so this surface cannot flood distant land. */
import { Shape, ShapeGeometry, Vector2 } from 'three';
import park from '../../data/lovers-point-gym.json';
import waterfront from '../../data/pacific-grove-waterfront.json';
export function createGymOceanGeometry(offsetX=260,offsetZ=-180){
 const coast=[...park.coast].reverse().concat(waterfront.coast);
 const first=coast[0],last=coast[coast.length-1];
 const ring=[[first[0],-1200],[1800,-1200],[1800,1100],[last[0],1100],...coast.slice().reverse()];
 const shape=new Shape(ring.map(([x,z])=>new Vector2(x-offsetX,-(z-offsetZ))));
 const geometry=new ShapeGeometry(shape);geometry.rotateX(-Math.PI/2);geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData={coastClipped:true,lodMaxErrorMetres:.001};return geometry;
}
