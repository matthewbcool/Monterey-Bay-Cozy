export type SquirrelPose='alert'|'forage'|'scurry';
export const SQUIRREL={
  species:'Otospermophilus beecheyi',commonName:'California ground squirrel',
  source:'https://ipm.ucanr.edu/home-and-landscape/ground-squirrel/',
  lengthMeters:.43,heightMeters:.345,
  sizeBasis:'Authored 43 cm nose-to-tail specimen; UC IPM gives 14–20 inches (35.6–50.8 cm) including the tail. Upright height, pose and timing are artistic estimates.',
  budget:{near:850,mid:500,far:180,drawCalls:1},
  requestedBy:'Ramero1993',
} as const;
export const SQUIRREL_POSES:readonly SquirrelPose[]=['alert','forage','scurry'];
export const SQUIRREL_MORPHS=['forage-a','forage-b','scurry-a','scurry-b'] as const;
