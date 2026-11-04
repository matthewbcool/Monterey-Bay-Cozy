import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { GARIBALDI } from './definition';
import { paintGaribaldi, buildGaribaldiFins } from './components';

export function createGaribaldiModel({ lengthMeters = GARIBALDI.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const a = createModelAssembly(GARIBALDI.id), material = createFishMaterial();
  buildFishBody(a, GARIBALDI, material, paintGaribaldi, lengthMeters);
  buildGaribaldiFins(a, material, lengthMeters);
  buildFishFace(a, GARIBALDI, material, lengthMeters, '#d49a54');
  return finishFish(a, GARIBALDI, lengthMeters);
}
