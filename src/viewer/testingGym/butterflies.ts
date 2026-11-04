import { Object3D } from 'three';
import { createMonarchBatch } from '../../models/habitat/monarch-butterfly/createMonarchBatch';

/** Small authored routes around the butterfly sculpture, in local metre offsets.
 * These are ambient game placements, not evidence of a resident wild colony. */
export const GYM_BUTTERFLY_OFFSETS = [[-1.5,-.65],[-.7,-1.55],[1.4,-.9],[1.7,.6],[.35,1.65],[-1.4,1.1]] as const;

export function createGymButterflies(groundHeight:(x:number,z:number)=>number, statue:Readonly<{x:number;z:number}>) {
  const batch=createMonarchBatch({count:GYM_BUTTERFLY_OFFSETS.length,capacity:GYM_BUTTERFLY_OFFSETS.length,seed:6256});
  batch.root.name='Gym · six ambient monarchs';
  batch.root.position.set(statue.x,0,statue.z);
  const transform=new Object3D(),sizes=GYM_BUTTERFLY_OFFSETS.map((_,i)=>batch.getInstanceState(i).wingspanMeters/.1);
  let previous=0,disposed=false;
  function place(time:number){
    GYM_BUTTERFLY_OFFSETS.forEach(([x,z],i)=>{
      const phase=time*(.32+i*.025)+i*2.399;
      const localX=x+Math.cos(phase)*.65,localZ=z+Math.sin(phase)*.4;
      const worldX=batch.root.position.x+localX,worldZ=batch.root.position.z+localZ;
      transform.position.set(localX,groundHeight(worldX,worldZ)+1.25+i*.11+Math.sin(phase*1.7)*.12,localZ);
      // Head is -Z: follow the ellipse tangent, with a small bank.
      transform.rotation.set(0,Math.atan2(.65*Math.sin(phase),-.4*Math.cos(phase)),Math.sin(phase)*.12);
      transform.scale.setScalar(sizes[i]);transform.updateMatrix();batch.setTransformAt(i,transform.matrix);
    });
  }
  place(0);
  return {root:batch.root,batch,
    update(time:number){if(disposed||!Number.isFinite(time)||time<0||time===previous)return;batch.update(Math.max(0,time-previous));place(time);previous=time;},
    dispose(){if(disposed)return;disposed=true;batch.dispose();},
  };
}
