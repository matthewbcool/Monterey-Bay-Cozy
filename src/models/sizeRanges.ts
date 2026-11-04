/** Biological reference ranges are display metadata, never an implicit mesh/physics scale. */
export interface SpeciesSizeRange {
 readonly meters:readonly [number,number];
 readonly measurement:'Length'|'Bell diameter'|'Shell length'|'Arm span';
 readonly basis:'published range'|'reference span'|'selected range';
 readonly note:string;
 readonly sources:readonly {readonly title:string;readonly url:string}[];
}
const source=(title:string,url:string)=>({title,url});
export const speciesSizeRanges={
 'southern-sea-otter':{meters:[1,1.5],measurement:'Length',basis:'reference span',
  note:'Combined published female (1.00–1.40 m) and male (1.20–1.50 m) adult lengths. The source does not specify endpoints. This model uses an authored 1.20 m nose-to-tail specimen; proportions and behavior timing are stylized.',
  sources:[source('Shedd Aquarium · Southern sea otter','https://www.sheddaquarium.org/animals/southern-sea-otter')]},
 'gray-whale':{meters:[11.1,15.2],measurement:'Length',basis:'reference span',
  note:'Reference span from reported male and female adult lengths. It is not a typical Monterey Bay interval or a minimum for all life stages; the model is an authored 12 m adult.',
  sources:[source('Canada COSEWIC · Grey whale size','https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/grey-whale/chapter-5.html')]},
 'giant-pacific-octopus':{meters:[2,4],measurement:'Arm span',basis:'reference span',
  note:'Monterey Bay Aquarium describes a 2–4 m or greater arm span. Four metres is not a maximum, and juveniles are smaller. The model represents a chosen 3 m fully extended span; a curled pose occupies less space.',
  sources:[source('Monterey Bay Aquarium · Giant Pacific octopus','https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-pacific-octopus')]},
 'giant-sea-bass':{meters:[1,2.3],measurement:'Length',basis:'selected range',
  note:'Selected 1–2.3 m guide for the grey adult model. Monterey Bay Aquarium reports a 2.3 m maximum; the 1 m lower endpoint is an authoring choice, not a biological minimum or a measured typical-adult interval. Juveniles are much smaller.',
  sources:[source('Monterey Bay Aquarium · Giant sea bass','https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/giant-sea-bass')]},
 'great-white-shark':{meters:[3.5,6],measurement:'Length',basis:'reference span',
  note:'Total-length reference span from male maturity near 3.5 m to an estimated 6 m maximum. Females mature around 4.5–5 m; juveniles are smaller. This is not a typical adult interval or a Monterey population measurement.',
  sources:[source('Florida Museum · White shark','https://www.floridamuseum.ufl.edu/discover-fish/species-profiles/white-shark/')]},
 tuna:{meters:[1.5,3],measurement:'Length',basis:'reference span',
  note:'Pacific bluefin reference: approximately 1.5 m for adults, up to 3 m. The supplied tuna photo has not been identified to species; this is a provisional average-to-maximum span, not a full size distribution.',
  sources:[source('NOAA · Pacific bluefin tuna','https://www.fisheries.noaa.gov/species/pacific-bluefin-tuna')]},
 'pacific-sardine':{meters:[.25,.41],measurement:'Length',basis:'reference span',
  note:'Combines a 25 cm average total length reported in British Columbia with a 41 cm species maximum. Most sardines are under 30 cm, and southern fish can be smaller; this is not a typical Monterey range.',
  sources:[source('Environment Canada · Pacific sardine description','https://www.canada.ca/en/environment-climate-change/services/species-risk-public-registry/cosewic-assessments-status-reports/pacific-sardine/chapter-3.html'),source('California Sea Grant · Pacific sardine','https://caseagrant.ucsd.edu/seafood-profiles/pacific-sardine')]},
 'blue-rockfish':{meters:[.32,.53],measurement:'Length',basis:'published range',
  note:'Stanford SeaNet field-guide range for blue rockfish. It does not cover every life stage.',
  sources:[source('Stanford SeaNet · Rockfishes and other kelp-forest fish','https://seanet.stanford.edu/Rockfishes')]},
 'ocean-sunfish':{meters:[1.8,3],measurement:'Length',basis:'reference span',
  note:'Approximately 1.8 m average adult length to a 3 m upper size in the cited accounts. Measured from snout to clavus, not from dorsal to anal fin; larger records exist.',
  sources:[source('University of Washington · Mola mola','https://interactiveoceans.washington.edu/05/2023/mola-mola/'),source('Smithsonian Ocean · Ocean sunfish','https://ocean.si.edu/ocean-life/fish/mola-mola-oceans-gentle-giant')]},
 'california-sheephead':{meters:[.40,.91],measurement:'Length',basis:'selected range',
  note:'A selected 40–91 cm guide for this adult male model. The Aquarium documents the 91 cm maximum; 40 cm is an authoring choice, not a measured biological minimum or a universal sex-change threshold.',
  sources:[source('Monterey Bay Aquarium · California sheephead','https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/california-sheephead')]},
 'kelp-greenling':{meters:[.25,.45],measurement:'Length',basis:'published range',
  note:'Stanford SeaNet field-guide range. Applies to the species, not specifically to the female coloration modeled here; larger specimens exist.',
  sources:[source('Stanford SeaNet · Rockfishes and other kelp-forest fish','https://seanet.stanford.edu/Rockfishes')]},
 'chinook-salmon':{meters:[.762,1.016],measurement:'Length',basis:'published range',
  note:'National Park Service usual adult average: 30–40 inches, converted to metres. This Alaska reference is a species guide, not a Monterey population measurement or maximum.',
  sources:[source('National Park Service · Chinook salmon','https://www.nps.gov/glba/learn/nature/chinook-salmon.htm')]},
 garibaldi:{meters:[.15,.366],measurement:'Length',basis:'reference span',
  note:'Adult-color transition near 15 cm to the documented 36.6 cm maximum. Most full-grown fish are below 30.5 cm; this span is not a typical-adult distribution.',
  sources:[source('Aquarium of the Pacific · Garibaldi','https://www.aquariumofpacific.org/onlinelearningcenter/species/garabaldi/')]},
 lingcod:{meters:[.508,1.524],measurement:'Length',basis:'reference span',
  note:'Approximate male maturity near 20 inches to the 5-foot species maximum. Females mature larger, around 30 inches. This is a maturity-to-maximum span, not a typical adult interval.',
  sources:[source('NOAA · Lingcod','https://www.fisheries.noaa.gov/species/lingcod')]},
 'moon-jelly':{meters:[.05,.40],measurement:'Bell diameter',basis:'published range',
  note:'Aquarium of the Pacific size range for moon jellies. Bell diameter excludes the hanging oral arms. This Aurelia genus model is not a confirmed local species identification.',
  sources:[source('Aquarium of the Pacific · Moon jelly','https://www.aquariumofpacific.org/onlinelearningcenter/species/moon_jelly')]},
 'green-sea-turtle':{meters:[.9144,1.0922],measurement:'Shell length',basis:'published range',
  note:'NOAA adult shell length: 36–43 inches. Excludes the head, neck and tail; do not compare this directly with full-body model length.',
  sources:[source('NOAA · Sea turtle size facts','https://www.fisheries.noaa.gov/national/outreach-and-education/fun-facts-about-terrific-sea-turtles')]},
} as const satisfies Record<string,SpeciesSizeRange>;

/** One unit per interval; avoid false precision in the compact viewer labels. */
export function formatSizeRange(size:SpeciesSizeRange){
 const [min,max]=size.meters;
 const value=min>=1?`${Number(min.toFixed(2))}–${Number(max.toFixed(2))} m`:`${Math.round(min*100)}–${Math.round(max*100)} cm`;
 return `${size.measurement} range · ${value}`;
}
