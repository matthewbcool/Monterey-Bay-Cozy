import type { SpeciesId, Habitat } from './types';
/** Associations are sourced; every numeric score, depth band and count below is provisional game tuning. */
export const ECOLOGY_SPECIES: Record<SpeciesId, {
  name: string; scientificName: string; habitat: string; references: string[];
  preferred: Habitat[]; maxSwimDepthMeters: number; maxBottomDepthMeters: number | null;
  groupSize: [number, number]; swimBand: [number, number];
}> = {
  'blue-rockfish': {
    name: 'Blue rockfish', scientificName: 'Sebastes mystinus', habitat: 'Kelp forests and rocky reefs; adult nearshore abundance is not measured by this extract.',
    references: ['https://oceanservice.noaa.gov/facts/kelplives.html', 'https://myodfw.com/fishing/species/blue-rockfish'],
    preferred: ['kelp-reef', 'rocky-reef'], maxSwimDepthMeters: 60, maxBottomDepthMeters: 120,
    groupSize: [2, 6], swimBand: [.25, .7],
  },
  lingcod: {
    name: 'Lingcod', scientificName: 'Ophiodon elongatus', habitat: 'Older fish associate with rocky bottoms; young fish use different habitats. A survey code is older-than-YOY, not adult maturity.',
    references: ['https://www.fisheries.noaa.gov/species/lingcod', 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/lingcod'],
    preferred: ['rocky-reef', 'kelp-reef'], maxSwimDepthMeters: 120, maxBottomDepthMeters: 150,
    groupSize: [1, 2], swimBand: [.78, .92],
  },
  'pacific-sardine': {
    name: 'Pacific sardine', scientificName: 'Sardinops sagax', habitat: 'Schooling fish in the water column, nearshore and offshore. Surface-school habitat does not require shallow seafloor.',
    references: ['https://www.fisheries.noaa.gov/species/pacific-sardine'],
    preferred: [], maxSwimDepthMeters: 35, maxBottomDepthMeters: null,
    groupSize: [12, 48], swimBand: [.08, .3],
  },
};
export const ECOLOGY_SPECIES_IDS = Object.keys(ECOLOGY_SPECIES) as SpeciesId[];
export const LIFE_STAGE_LABELS = { Y: 'Young-of-year / pelagic', A: 'Older / post-settlement', U: 'Unknown stage', all: 'All recorded stages' } as const;
/** Current authored Gym reef, converted from gym metres. This is not a mapped kelp survey. */
export const ECOLOGY_REEF = {
  longitude: -121.91685 + 92.71 / (6371008.8 * Math.PI / 180 * Math.cos(36.6256 * Math.PI / 180)),
  latitude: 36.6256 - 41.95 / (6371008.8 * Math.PI / 180),
  radiusMeters: 18, basis: 'Authored Testing Gym rocky/kelp reef footprint; not a surveyed habitat polygon',
};
