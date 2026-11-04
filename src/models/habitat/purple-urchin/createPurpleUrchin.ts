import { Group, Mesh } from 'three';
import { createToonMaterial } from '../../shared/style';
import { buildUrchinGeometry } from './geometry';
import { PURPLE_URCHIN as U } from './definition';

export interface PurpleUrchinOptions { testDiameterMeters?: number; seed?: number }
export function createPurpleUrchin({ testDiameterMeters = U.testDiameterMeters, seed = Math.floor(Math.random() * 2 ** 32) }: PurpleUrchinOptions = {}) {
  if (!Number.isFinite(testDiameterMeters) || testDiameterMeters <= 0) throw new Error('Urchin test diameter must be positive metres');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Urchin seed must be uint32');
  const radius = testDiameterMeters / 2, root = new Group(); root.name = 'Purple sea urchin';
  const geometry = buildUrchinGeometry(testDiameterMeters, seed);
  const mesh = new Mesh(geometry, createToonMaterial({ vertexColors: true, rim: false, name: 'purple-urchin-toon' }));
  mesh.name = 'purple-urchin-test-spines-and-feet'; root.add(mesh);
  root.userData = { assetId: U.id, species: U.species, units: 'metres', seed, testDiameterMeters,
    sourceParts: ['test', 'blunt-spines', 'tube-feet', 'oral-mouth'], source: U.source, sizeBasis: U.sizeBasis, budget: U.budget, contactNormal: [0, 1, 0], contactAnchor: [0, 0, 0],
    crawlSpeedMetersPerSecond: U.crawlSpeedMetersPerSecond,
    physics: { colliders: [{ shape: 'sphere', radius, center: [0, radius * .67, 0] }], grip: [0, radius, 0] } };
  return root;
}
