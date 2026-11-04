/** Adult specimen and motion are authored choices; anatomy follows the cited NOAA profile. */
export const GRAY_WHALE = {
  id: 'gray-whale', lengthMeters: 12,
  source: 'https://www.fisheries.noaa.gov/species/gray-whale',
  sizeBasis: 'Selected 12 m adult; published male and female lengths span roughly 11–15 m. Model length includes the flukes.',
  // x, section centre y, vertical radius, lateral radius; head faces -X.
  profile: [
    [-.5,.005,.013,.018],[-.48,.011,.030,.040],[-.43,.012,.053,.063],
    [-.35,.005,.083,.092],[-.24,0,.106,.112],[-.12,.001,.119,.123],
    [0,.007,.121,.120],[.12,.010,.105,.104],[.22,.012,.077,.075],
    [.31,.012,.043,.044],[.38,.012,.020,.025],[.405,.012,.009,.015],
  ] as const,
  budget: { triangles: 1800, drawCalls: 2 },
  motion: { slow: .17, fast: .42 },
} as const;
