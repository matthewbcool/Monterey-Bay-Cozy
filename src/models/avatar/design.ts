/** A tiny, renderer-independent avatar recipe. All dimensions are artistic and in metres. */
export interface AvatarDesign {
  name: string;
  /** Nominal artistic height; hairstyles may extend above this reference. */
  heightMeters: number;
  /** Body width/depth multiplier; head and hair retain their proportions. */
  bodyBuild: number;
  skinTone: string;
  hairColor: string;
  eyeColor: string;
  hairStyle: 'crop' | 'bob' | 'sweep' | 'curls' | 'bun';
  eyeStyle: 'round' | 'almond' | 'sleepy';
  mouthStyle: 'smile' | 'grin';
  faceLines: 'none' | 'soft' | 'defined';
  topStyle: 'tee' | 'hoodie' | 'vest';
  topColor: string;
  bottomStyle: 'shorts' | 'trousers' | 'skirt';
  bottomColor: string;
  shoeColor: string;
}

export const AVATAR_SIZE_LIMITS = {
  heightMeters: { min: 1.20, max: 1.80, step: .01, default: 1.45 },
  bodyBuild: { min: .80, max: 1.25, step: .01, default: 1 },
} as const;

export const AVATAR_OPTIONS = {
  hairStyle: ['crop', 'bob', 'sweep', 'curls', 'bun'],
  eyeStyle: ['round', 'almond', 'sleepy'],
  mouthStyle: ['smile', 'grin'],
  faceLines: ['none', 'soft', 'defined'],
  topStyle: ['tee', 'hoodie', 'vest'],
  bottomStyle: ['shorts', 'trousers', 'skirt'],
  skinTone: ['#f5d8b8', '#e8b58a', '#ce936a', '#ad7151', '#875039', '#603c30', '#432d27', '#f3c9bb'],
  hairColor: ['#302720', '#53392c', '#895637', '#b97741', '#d9b976', '#eee1c6', '#687e8b', '#9a5167'],
  eyeColor: ['#584331', '#337b82', '#50744d', '#6889ac', '#7a5887', '#242b31'],
  topColor: ['#2c8d91', '#e9ac50', '#d56d61', '#5b7596', '#73895c', '#e7d3af', '#8d668b', '#374c58'],
  bottomColor: ['#3d596c', '#a7784f', '#e0cba3', '#647556', '#745c72', '#333b47'],
  shoeColor: ['#f3dfb9', '#734d3a', '#314c59', '#bb654f', '#6d8b75'],
} as const;

export const DEFAULT_AVATAR_DESIGN: Readonly<AvatarDesign> = Object.freeze({
  name: 'Bay explorer', heightMeters: AVATAR_SIZE_LIMITS.heightMeters.default, bodyBuild: AVATAR_SIZE_LIMITS.bodyBuild.default, skinTone: '#e8b58a', hairColor: '#53392c', eyeColor: '#337b82',
  hairStyle: 'sweep', eyeStyle: 'round', mouthStyle: 'smile', faceLines: 'none', topStyle: 'tee', topColor: '#2c8d91',
  bottomStyle: 'shorts', bottomColor: '#3d596c', shoeColor: '#f3dfb9',
});

/** Accept only the documented enums and opaque six-digit colors; never keep arbitrary stored keys. */
export function normalizeAvatarDesign(input: unknown): AvatarDesign {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const result: AvatarDesign = { ...DEFAULT_AVATAR_DESIGN };
  if (typeof value.name === 'string') result.name = value.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32) || DEFAULT_AVATAR_DESIGN.name;
  for (const key of ['skinTone', 'hairColor', 'eyeColor', 'topColor', 'bottomColor', 'shoeColor'] as const) {
    const color = value[key];
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) result[key] = color.toLowerCase();
  }
  for (const key of ['hairStyle', 'eyeStyle', 'mouthStyle', 'faceLines', 'topStyle', 'bottomStyle'] as const) {
    if ((AVATAR_OPTIONS[key] as readonly unknown[]).includes(value[key])) Object.assign(result, { [key]: value[key] });
  }
  for (const key of ['heightMeters', 'bodyBuild'] as const) {
    const number = value[key], limits = AVATAR_SIZE_LIMITS[key];
    if (typeof number === 'number' && Number.isFinite(number)) result[key] = Math.round(Math.max(limits.min, Math.min(limits.max, number)) * 100) / 100;
  }
  return result;
}
