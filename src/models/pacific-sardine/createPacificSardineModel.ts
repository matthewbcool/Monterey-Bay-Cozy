import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { SARDINE } from './definition';
import { buildSardineFins, buildSardineSpots, paintSardine } from './components';

export function createPacificSardineModel({ lengthMeters = SARDINE.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const assembly = createModelAssembly(SARDINE.id), material = createFishMaterial();
  buildFishBody(assembly, SARDINE, material, paintSardine, lengthMeters);
  buildSardineFins(assembly, material, lengthMeters);
  buildSardineSpots(assembly, material, lengthMeters);
  buildFishFace(assembly, SARDINE, material, lengthMeters, '#d5d4a6');
  return finishFish(assembly, SARDINE, lengthMeters);
}
