import { BufferGeometry, Color, Float32BufferAttribute } from 'three';
import { createCelMaterial, createSwimUniforms } from './toon';

export const PALETTE = {
  back: new Color('#214859'), shoulder: new Color('#3a7d91'),
  flank: new Color('#7cb9c2'), belly: new Color('#dae4d2'),
  fin: new Color('#416d7d'), gold: new Color('#d8be67'), ink: new Color('#153947'),
};

export interface TunaOptions { clay?: boolean; lengthMeters?: number }

/** One material set per fish; components share it without leaking animation state. */
export function createTunaMaterials({ clay = false }: TunaOptions = {}) {
  const swim = createSwimUniforms();
  return {
    skin: createCelMaterial(clay ? '#a9b8b7' : '#ffffff', !clay, false, swim),
    fin: createCelMaterial(clay ? '#a9b8b7' : '#ffffff', !clay, true, swim),
    gold: createCelMaterial(clay ? '#a9b8b7' : PALETTE.gold, false, true, swim),
    dark: createCelMaterial(PALETTE.ink, false, false, swim),
    eyeRim: createCelMaterial('#b9cec5', false, false, swim),
  };
}
export type TunaMaterials = ReturnType<typeof createTunaMaterials>;

export function paintFin(geometry: BufferGeometry) {
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  const edgeColor = new Color('#85b1b2');
  for (let i = 0; i < positions.count; i++) {
    const edge = Math.min(1, Math.abs(positions.getY(i)) * 1.1);
    const color = PALETTE.fin.clone().lerp(edgeColor, edge * .65);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
