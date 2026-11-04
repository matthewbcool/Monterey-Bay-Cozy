/** Historic published GPS pins, not survey coordinates. Decimal places express
 * the conversion of degrees/minutes; they do not imply positional accuracy.
 * Keep this provenance separate from geometry, terrain and player simulation. */
export const LOVERS_POINT_ARTWORKS = [
  {
    id: 'sailing-boy-statue',
    title: 'Yesterday’s Dream—Tomorrow’s Memory',
    artist: 'Dorothy Fowler',
    coordinates: [-121.91635, 36.62615] as const,
    originalCoordinates: 'N 36° 37.569 W 121° 54.981',
    coordinateSource: 'https://www.waymarking.com/waymarks/WM33F4',
    coordinateDate: '2008-02-03',
    accuracy: 'Unknown; historic visitor GPS pin, not a surveyed artwork center.',
    reference: 'https://www.pghsaa.org/newsletters/KOII-March-2014-Sm.pdf',
    // +Z is south, +X east. The boy looks across the bay; exact azimuth is inferred.
    yawRadians: Math.PI * .32,
    headingBasis: 'Artistic east/southeast-facing estimate from the reference setting; unmeasured.',
    baseRadiusMeters: .92,
  },
  {
    id: 'butterfly-statue',
    title: 'Monarch Butterfly',
    artist: 'Gordon Newell',
    coordinates: [-121.91648333333333, 36.62626666666667] as const,
    originalCoordinates: 'N 36° 37.576 W 121° 54.989',
    coordinateSource: 'https://www.waymarking.com/waymarks/WM1DP_Monarch_Butterfly_Sculpture',
    coordinateDate: '2005-09-12',
    accuracy: 'Unknown; historic visitor GPS pin, not a surveyed artwork center.',
    reference: 'https://www.93950.com/public.htm',
    yawRadians: 0,
    headingBasis: 'Artistic south-facing estimate from the supplied photograph; unmeasured.',
    baseRadiusMeters: .53,
  },
] as const;

export type LoversPointArtwork = typeof LOVERS_POINT_ARTWORKS[number];
