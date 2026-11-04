export type SpeciesId = 'blue-rockfish' | 'lingcod' | 'pacific-sardine';
/** NOAA life-history codes. A does not mean reproductively mature. */
export type LifeStage = 'Y' | 'A' | 'U';
export type Habitat = 'kelp-reef' | 'rocky-reef' | 'sand' | 'unknown';
export interface Haul { id: string; time: string; longitude: number; latitude: number }
export interface Observation { haul: number; speciesId: SpeciesId; lifeStage: LifeStage; count: number }
export interface EcologyDataset {
  schemaVersion: 1; bounds: number[]; cellSizeMeters: number;
  window: { start: string; end: string };
  source: { id: string; title: string; institution: string; metadataUrl: string; timeCoverageEnd: string; license: string; files: Record<string, { url: string; retrievedAt: string; sha256: string; bytes: number }>; method: string; limitations: string[] };
  hauls: Haul[]; observations: Observation[];
}
export interface EcologyFilter { speciesId: SpeciesId; lifeStage?: LifeStage | 'all'; year?: number; month?: number }
export interface EcologyCell { id: string; column: number; row: number; bounds: [number, number, number, number]; longitude: number; latitude: number }
export type SurveyStatus = 'outside-coverage' | 'no-survey' | 'not-recorded' | 'not-detected' | 'detected';
export interface Evidence {
  status: SurveyStatus; cell: EcologyCell | null; representedHauls: number; speciesHauls: number;
  detectedHauls: number; explicitZeroRows: number; catchCount: number; years: number[];
  stages: LifeStage[]; lastSample: string | null; detectionFraction: number | null;
  /** Reserved until effort and catchability have been accounted for. */
  relativeAbundance: null; populationEstimate: null;
}
export interface HabitatContext { isWater: boolean; bottomDepthMeters: number | null; habitat: Habitat; basis: string }
