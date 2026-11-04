export const PURPLE_URCHIN = {
  id: 'purple-sea-urchin', species: 'Strongylocentrotus purpuratus',
  testDiameterMeters: .05, spineLengthMeters: .012,
  // A conservative grazing choice, not the escape speeds measured under illumination/predation.
  crawlSpeedMetersPerSecond: .01 / 60,
  source: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/purple-sea-urchin',
  movementSource: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9943640/',
  sizeBasis: 'Representative 5 cm test with 1.2 cm spines; MBA reports up to 7 cm across. Total spiny envelope is recorded separately.',
  budget: { triangles: 2000, drawCalls: 1 },
} as const;
