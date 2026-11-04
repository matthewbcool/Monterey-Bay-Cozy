/** Two common Monterey Bay intertidal/shallow-reef anemones. Sizes and colors are authored representative
 * choices. Giant-green anatomy follows the supplied October 25 references; see its review. */
export const ANEMONES = {
  'giant-green': {
    id: 'giant-green-anemone', species: 'Anthopleura xanthogrammica',
    discDiameterMeters: .14, columnHeightMeters: .055,
    colors: { column: '#5d7746', disc: '#7fa365', tentacle: '#83b99a', tip: '#c7ddd3' },
    source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-green-anemone',
    sizeBasis: 'Authored 14 cm oral disc and 5.5 cm column, approximately 18 cm crown; not measured from the photos. Aquarium crown reference: up to 17.8 cm (checked 2026-10-25). Colors and tentacle count are stylized.',
  },
  aggregating: {
    id: 'aggregating-anemone', species: 'Anthopleura elegantissima',
    discDiameterMeters: .05, columnHeightMeters: .04,
    colors: { column: '#8a875f', disc: '#a3ad86', tentacle: '#93ae86', tip: '#e2a1b6' },
    source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/aggregating-anemone',
    sizeBasis: 'Representative 5 cm disc (provisional), forming clonal carpets. Pink tentacle tips are stylized.',
  },
} as const;
export type AnemoneSpecies = keyof typeof ANEMONES;
export const ANEMONE_BUDGET = { triangles: 2000, drawCalls: 1 } as const;

/** Bed Near uses the inspection Mid silhouette; aggregating stays below its original 300. */
export const ANEMONE_BED_BUDGET = { triangles: 400, drawCalls: 1 } as const;
