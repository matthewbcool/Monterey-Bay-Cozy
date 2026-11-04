import { createModelAssembly } from '../shared/assembly';
import { buildFishBody } from '../shared/fish/body';
import { buildFishFace } from '../shared/fish/face';
import { createFishMaterial } from '../shared/fish/materials';
import { finishFish } from '../shared/fish/rig';
import type { FishOptions } from '../shared/fish/design';
import { SHEEPHEAD } from './definition';
import { buildSheepheadFins, buildSheepheadTeeth, paintSheephead } from './components';

export function createCaliforniaSheepheadModel({ lengthMeters = SHEEPHEAD.lengthMeters }: FishOptions = {}) {
  if (!Number.isFinite(lengthMeters) || lengthMeters <= 0) throw new Error('Fish length must be positive metres');
  const a = createModelAssembly(SHEEPHEAD.id), material = createFishMaterial();
  buildFishBody(a, SHEEPHEAD, material, paintSheephead, lengthMeters);
  buildSheepheadFins(a, material, lengthMeters);
  buildFishFace(a, SHEEPHEAD, material, lengthMeters, '#c47048');
  buildSheepheadTeeth(a, material, lengthMeters);
  const fish = finishFish(a, SHEEPHEAD, lengthMeters);
  fish.root.userData.colorPhase = 'adult male';
  return fish;
}
