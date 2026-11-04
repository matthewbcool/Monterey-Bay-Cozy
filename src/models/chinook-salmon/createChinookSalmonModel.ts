import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { CHINOOK_SALMON } from './definition';
import { buildChinookFins, buildChinookSpots, paintChinook } from './components';

export function createChinookSalmonModel({ lengthMeters = CHINOOK_SALMON.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const a = createModelAssembly(CHINOOK_SALMON.id), material = createFishMaterial();
  buildFishBody(a, CHINOOK_SALMON, material, paintChinook, lengthMeters);
  buildChinookFins(a, material, lengthMeters);
  buildChinookSpots(a, material, lengthMeters);
  buildFishFace(a, CHINOOK_SALMON, material, lengthMeters, '#d6d3bd');
  const fish = finishFish(a, CHINOOK_SALMON, lengthMeters);
  fish.root.userData.colorPhase = 'ocean (bright silver)'; fish.root.userData.localSource = CHINOOK_SALMON.localSource;
  return fish;
}
