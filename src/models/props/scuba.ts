import { Group } from 'three';
import { finishStaticAsset } from '../shared/staticAsset';
import { PROP_SCALE } from './dimensions';
import { box, cylinder, mat, palette as p, sphere } from './primitives';

/** Dive locker for a boat deck: a folded wetsuit, upright tank, mask and fins on a small crate.
 * Authored in metres; one matte batch. Original design; sizes are representative, not a product. */
export function createScubaRack() {
  const root = new Group(); root.name = 'Scuba gear rack';
  const crate = mat(p.cream), suit = mat('#26353c'), tank = mat('#e9b54c'), steel = mat('#9aa9a8'), fin = mat('#2f8fa0'), lens = mat('#8fd0d6');
  box(root, 'Gear crate', [.62, .34, .42], crate, [0, .17, 0], .04);
  box(root, 'Folded wetsuit', [.40, .07, .30], suit, [-.08, .375, 0], .03);
  box(root, 'Wetsuit hood fold', [.18, .05, .14], suit, [-.12, .43, .02], .02);
  cylinder(root, 'Scuba tank', .085, .58, tank, [.22, .63, -.08]);
  sphere(root, 'Tank shoulder', .085, tank, [.22, .92, -.08]);
  cylinder(root, 'Tank valve', .03, .08, steel, [.22, 1.02, -.08]);
  box(root, 'Tank strap', [.2, .05, .2], suit, [.22, .7, -.08]);
  box(root, 'Mask frame', [.18, .07, .06], suit, [.02, .445, .13], .02);
  box(root, 'Mask lens', [.15, .05, .02], lens, [.02, .445, .165]);
  for (const side of [-1, 1]) {
    const blade = box(root, 'Fin blade', [.19, .02, .46], fin, [side * .11 - .05, .52, -.24]);
    blade.rotation.x = -1.05; blade.rotation.z = side * .06;
  }
  return finishStaticAsset(root, 'scuba-rack', PROP_SCALE['scuba-rack']);
}
