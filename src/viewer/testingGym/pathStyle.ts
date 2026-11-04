/** OSM describes surface and occasionally width; untagged widths remain explicit art choices. */
export const GROUND_KIND = { plain:0, grass:1, sand:2, concrete:3, asphalt:4, gravel:5, stone:6 } as const;
export function pathStyle(route:{id:string;highway:string;tags:Record<string,string|undefined>}) {
  const pedestrian=['footway','path','pedestrian','steps','cycleway'].includes(route.highway);
  const tagged=Number(route.tags.width),hasWidth=Number.isFinite(tagged)&&tagged>=.5&&tagged<=12;
  // The court-side beach flight is broad in the October 26 photos. Its 4 m
  // estimate is shared by paving, physical treads, landing edges and handrails.
  const recreationWidth=route.id==='way/633871934'?4:route.id==='way/10466950'||route.id==='way/871783415'?3.2:route.id==='way/970525344'?1.5:undefined;
  const width=recreationWidth??(hasWidth?tagged:route.id==='way/633871951'?3.2:route.id==='way/633871947'?2.1:route.highway==='steps'?1.5:pedestrian?1.85:route.highway==='secondary'?6.4:4.5);
  const raw=route.tags.surface;
  const kind=raw==='asphalt'||!pedestrian?GROUND_KIND.asphalt:raw==='sett'?GROUND_KIND.stone:['unpaved','fine_gravel','compacted'].includes(raw??'')?GROUND_KIND.gravel:GROUND_KIND.concrete;
  const color=kind===GROUND_KIND.asphalt?'#7f8780':kind===GROUND_KIND.gravel?'#bcae90':kind===GROUND_KIND.stone?'#b6b5a4':'#cecbb9';
  return {pedestrian,width,widthBasis:recreationWidth?'photo-estimated recreation width':hasWidth?'OSM width':'authored width',kind,color,surfaceBasis:raw??'inferred paving'};
}
