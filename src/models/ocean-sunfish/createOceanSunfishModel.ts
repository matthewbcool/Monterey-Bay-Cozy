import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { createFishMaterial } from '../shared/fish/materials';
import type { FishOptions } from '../shared/fish/design';
import { SUNFISH } from './definition';
import { buildSunfishFace, buildSunfishFins, paintSunfish } from './components';
import { finishSunfish } from './motion';

export function createOceanSunfishModel({ lengthMeters = SUNFISH.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const assembly = createModelAssembly(SUNFISH.id), material = createFishMaterial();
  buildFishBody(assembly, SUNFISH, material, paintSunfish, lengthMeters, 0);
  buildSunfishFins(assembly, material, lengthMeters);
  buildSunfishFace(assembly, material, lengthMeters);
  return finishSunfish(assembly, lengthMeters);
}
