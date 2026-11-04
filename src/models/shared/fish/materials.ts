import { createToonMaterial } from '../style';

/** Palette bands live in geometry; the shared toon ramp supplies the cel terminator.
 * Built-in toon skinning/morph instancing works on both render backends. */
export function createFishMaterial() {
  const material=createToonMaterial({ vertexColors: true, name: 'fish-toon' });
  material.userData.paintedFish=true;return material;
}
