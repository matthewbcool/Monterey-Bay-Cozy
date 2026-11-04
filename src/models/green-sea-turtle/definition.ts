export const GREEN_TURTLE={
 id:'green-sea-turtle',species:'Chelonia mydas',lengthMeters:1.15,
 source:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/green-turtle',
 sizeBasis:'Artistic 1.15 m nose-to-tail specimen with 0.9085 m shell. NOAA adult range refers to shell length; see sizeRanges.ts. Proportions and motion are stylized.',
 budget:{triangles:1800,drawCalls:2},motion:{slow:.28,fast:.72},
 // Full-model fractions: head -X, dorsal +Y. Flipper bases stay buried under the shell.
 pivots:[[-.245,-.018,.18],[-.245,-.018,-.18],[.28,-.027,.15],[.28,-.027,-.15]],
} as const;
