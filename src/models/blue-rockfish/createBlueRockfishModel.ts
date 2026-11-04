import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { BLUE_ROCKFISH } from './definition';
import { buildRockfishFins, paintRockfish } from './components';

export function createBlueRockfishModel({ lengthMeters = BLUE_ROCKFISH.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const assembly = createModelAssembly(BLUE_ROCKFISH.id), material = createFishMaterial();
  buildFishBody(assembly, BLUE_ROCKFISH, material, paintRockfish, lengthMeters);
  buildRockfishFins(assembly, material, lengthMeters);
  buildFishFace(assembly, BLUE_ROCKFISH, material, lengthMeters, '#b5aa7c');
  return finishFish(assembly, BLUE_ROCKFISH, lengthMeters);
}
