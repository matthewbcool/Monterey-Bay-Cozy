import { Group, InstancedMesh, Mesh, Object3D } from 'three';
import { createPurpleUrchin } from './createPurpleUrchin';
import { PURPLE_URCHIN } from './definition';
import { attachToSurface, type SurfaceAnchor } from '../../shared/surfaceAttachment';
import { disposeObject } from '../../props/primitives';

export function createUrchinColony(anchors: readonly SurfaceAnchor[], seed = 83) {
  if (!anchors.length) throw new Error('Urchin colony needs a surface');
  const source = createPurpleUrchin({ seed }), mesh = source.children[0] as Mesh;
  const root = new Group(); root.name = 'Attached purple urchins';
  const batch = new InstancedMesh(mesh.geometry, mesh.material, anchors.length); batch.name = 'purple-urchin-colony';batch.frustumCulled=false;source.clear();root.add(batch);
  const nodes = anchors.map(()=>{const n=new Object3D();root.add(n);return n;});
  const attachments: ReturnType<typeof attachToSurface>[] = [];
  try { anchors.forEach((anchor,i)=>attachments.push(attachToSurface(nodes[i],anchor,{speedMetersPerSecond:PURPLE_URCHIN.crawlSpeedMetersPerSecond,maxTravelMeters:1,offsetMeters:.0001,probeMeters:.01}))); }
  catch(error){attachments.forEach(a=>a.detach());batch.dispose();disposeObject(root);throw error;}
  nodes.forEach((n,i)=>batch.setMatrixAt(i,n.matrix));batch.instanceMatrix.needsUpdate=true;
  let disposed=false;
  return {root,batch,attachments,nodes,update(dt:number){if(disposed)return;let changed=false;attachments.forEach((a,i)=>{if(a.update(dt)){batch.setMatrixAt(i,nodes[i].matrix);changed=true;}});if(changed)batch.instanceMatrix.needsUpdate=true;},dispose(){if(disposed)return;disposed=true;attachments.forEach(a=>a.detach());batch.dispose();disposeObject(root);}};
}
