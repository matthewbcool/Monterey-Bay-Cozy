/** Photo-guided proportions. Span, speeds and stroke timing are authored choices. */
export const OCTOPUS = {
  id:'giant-pacific-octopus', spanMeters:3,
  source:'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-pacific-octopus',
  angles:[-2.65,-1.9,-1.15,-.4,.4,1.15,1.9,2.65],
  armLength:.445, armBase:.055, headX:.035,
  bonesPerArm:9, sections:14, sides:6, suckerPairs:7,
  motion:{slow:.13,fast:.8}, speed:{slow:.045,fast:.65},
  budget:{triangles:4500,drawCalls:2},
} as const;
export const armRadius=(u:number)=>(.031*Math.pow(1-u,1.3)+.0015);
export const armBone=(arm:number,node:number)=>2+arm*OCTOPUS.bonesPerArm+node;
