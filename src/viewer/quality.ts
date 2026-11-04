/**
 * Quality tiers from the README's art direction. Tiers change only the extras, never the palette
 * or the toon ramp, so screenshots on every device look like one product.
 */
export type QualityTier = 'base' | 'standard';
export const QUALITY_TIERS = ['base', 'standard'] as const;

export interface TierSettings {
  label: string;
  /** Device-pixel-ratio ceiling. */
  maxPixelRatio: number;
  shadowMapSize: number;
  /** Water refraction: one viewport colour/depth copy per frame on the dockside water. */
  refraction: boolean;
  rim: boolean;

}

export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  base: { label: 'Base', maxPixelRatio: 1.5, shadowMapSize: 1024, refraction: false, rim: false },
  standard: { label: 'Standard', maxPixelRatio: 2, shadowMapSize: 2048, refraction: true, rim: true },
};

export interface DeviceHints {
  /** `?quality=` override. */
  requested?: string | null;
  /** Optional device hints retained for callers; conservative defaults use these. */
  webgpu?: boolean;
  /** `navigator.deviceMemory` in GiB, when the browser reports it. */
  deviceMemory?: number;
  /** Primary pointer is coarse: phones and most tablets. */
  coarsePointer?: boolean;
}

/** Base on constrained/touch devices; otherwise Standard. Legacy/unknown URLs use this policy. */
export function pickTier({ requested, coarsePointer, deviceMemory }: DeviceHints): { tier: QualityTier; reason: string } {
  if (requested && (QUALITY_TIERS as readonly string[]).includes(requested)) return { tier: requested as QualityTier, reason: 'requested' };
  return coarsePointer || (deviceMemory !== undefined && deviceMemory <= 4)
    ? { tier: 'base', reason: 'device default' } : { tier: 'standard', reason: 'Standard default' };
}

/** Median of a frame-interval sample in milliseconds. */
export function median(samples: readonly number[]) {
  if (!samples.length) return NaN;
  const sorted = [...samples].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
/** Step down once when the median frame misses ~45 fps; vsync-bound 16.7 ms frames never trigger it. */
export const STEP_DOWN_MS = 22;
export function shouldStepDown(tier: QualityTier, samples: readonly number[]) {
  return tier !== 'base' && samples.length >= 60 && median(samples) > STEP_DOWN_MS;
}
export const lowerTier = (_tier: QualityTier): QualityTier => 'base';
