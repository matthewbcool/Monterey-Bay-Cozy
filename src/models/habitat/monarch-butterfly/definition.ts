/** Living Danaus plexippus; distinct from the Lovers Point stone sculpture. */
export const MONARCH = {
  id: 'monarch-butterfly', species: 'Danaus plexippus', wingspanMeters: .10,
  wingspanRangeMeters: [.085, .12] as const,
  source: 'https://www.floridamuseum.ufl.edu/wildflowers/butterfly/monarch/',
  sizeBasis: '10 cm representative open wingspan within the published 85–120 mm adult range. Body proportions are photo estimates.',
  budget: { triangles: 1000, drawCalls: 1 },
  // Timing is an artistic flight cycle, not a biological measurement or travel speed.
  wingbeatHz: 4.2, glideCycleSeconds: 5.6,
} as const;
export type MonarchPose = 'flight' | 'perched' | 'basking';
