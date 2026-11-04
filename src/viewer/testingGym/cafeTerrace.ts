import { Group, Mesh } from 'three';
import {createFurnitureSource} from '../../models/props/furniture';
import type { GymCollider, GymPoint } from '../avatarController';
import { groundHeight } from './elevation';
import { segmentCollider } from './parkFurniture';

/** October 26 user photo: parasols clustered between the court and mapped Grill.
 * Authored metre positions/dimensions, not surveyed furniture or operating status. */
export const CAFE_TABLES:readonly GymPoint[]=[[0,76],[-3.5,79],[3,72.8],[12,74]];
export function addCafeTerrace(scenery:Group,colliders:GymCollider[]) {
  CAFE_TABLES.forEach(([x,z],index)=>{
    const group=new Group();group.position.set(x,groundHeight(x,z)+.025,z);group.rotation.y=-.315;
    group.add(createFurnitureSource('cafe-parasol',index===1),createFurnitureSource('cafe-table'));
    for(const side of [-1,1]){const chair=createFurnitureSource('cafe-chair');chair.position.z=side*.88;if(side<0)chair.rotation.y=Math.PI;group.add(chair);}
    group.updateMatrixWorld(true);
    const parts:Mesh[]=[];group.traverse(child=>{if(child instanceof Mesh)parts.push(child);});
    for(const child of parts){
      if(!(child instanceof Mesh))continue;
      child.matrixWorld.decompose(child.position,child.quaternion,child.scale);child.userData.elevationPlaced=true;scenery.add(child);
    }
    // Low furniture only; the canopy is well above walking height.
    colliders.push(segmentCollider([x-.53,z],[x+.53,z],1.06,group.position.y+.80));
    for(const side of [-1,1]){
      const cx=x+Math.sin(-.315)*side*.88,cz=z+Math.cos(-.315)*side*.88;
      colliders.push(segmentCollider([cx-Math.cos(-.315)*.23,cz-Math.sin(.315)*.23],[cx+Math.cos(-.315)*.23,cz+Math.sin(.315)*.23],.46,group.position.y+.9));
    }
  });
}
