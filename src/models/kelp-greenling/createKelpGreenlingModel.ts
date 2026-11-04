import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { KELP_GREENLING } from './definition';
import { buildGreenlingFins, buildGreenlingFreckles, paintGreenling } from './components';

export function createKelpGreenlingModel({ lengthMeters = KELP_GREENLING.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const a = createModelAssembly(KELP_GREENLING.id), material = createFishMaterial();
  buildFishBody(a, KELP_GREENLING, material, paintGreenling, lengthMeters);
  buildGreenlingFins(a, material, lengthMeters);
  buildGreenlingFreckles(a, material, lengthMeters);
  buildFishFace(a, KELP_GREENLING, material, lengthMeters, '#d0b264');
  const fish = finishFish(a, KELP_GREENLING, lengthMeters);
  fish.root.userData.colorPhase = 'female'; fish.root.userData.localSource = KELP_GREENLING.localSource;
  return fish;
}
