import { Group, Mesh } from 'three';
import { buildAvatarGeometry } from '../avatar/geometry';
import { DEFAULT_AVATAR_DESIGN } from '../avatar/design';
import { createToonMaterial } from '../shared/style';
/** Original otter-inspired powered suit, authored at the default avatar's metre scale. */
export function createOtterManSuit(){
  const root=new Group(),geometry=buildAvatarGeometry({...DEFAULT_AVATAR_DESIGN},'otter-man');
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  const material=createToonMaterial({vertexColors:true,rim:false});material.userData.otterArmor=true;
  root.add(new Mesh(geometry,material));
  root.name='Otter Man exploration suit';root.userData={assetId:'otter-man-suit',units:'metres',sourceParts:geometry.userData.sourceParts,sizeBasis:'Original fictional equipment; fits the 1.20–1.80 m avatar range.',budget:{triangles:5000,drawCalls:1}};
  return root;
}
