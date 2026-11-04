import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { LINGCOD } from './definition';
import { paintLingcod, buildLingcodFins, buildLingcodTeeth } from './components';

export function createLingcodModel({ lengthMeters = LINGCOD.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const a = createModelAssembly(LINGCOD.id), material = createFishMaterial();
  buildFishBody(a, LINGCOD, material, paintLingcod, lengthMeters);
  buildLingcodFins(a, material, lengthMeters);
  buildFishFace(a, LINGCOD, material, lengthMeters, '#b6ab72');
  buildLingcodTeeth(a, material, lengthMeters);
  return finishFish(a, LINGCOD, lengthMeters);
}
