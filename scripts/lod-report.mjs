import fs from 'node:fs/promises';
const out=new URL('../artifacts/lod/',import.meta.url),data=JSON.parse(await fs.readFile(new URL('browser-metrics.json',out),'utf8'));
const assets=data.assets.filter(a=>a.backend==='webgpu');
const reportDate=new Date(data.date).toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'});
const rows=[],cards=[];
for(const a of assets){
 const label=a.id.replaceAll('-',' '),n=a.near.triangles,m=a.mid.triangles,f=a.far.triangles;
 rows.push(`| ${label} | ${n.toLocaleString('en-US')} | ${m.toLocaleString('en-US')} | ${f.toLocaleString('en-US')} | ${a.near.draws} | ${(100*(1-f/n)).toFixed(0)}% |`);
 const images=['near','mid','far'].map(l=>`<figure><a href="${a.id}-${l}.png"><img loading="lazy" src="${a.id}-${l}.png" alt="${label} at ${l} detail"></a><figcaption>${l} · ${a[l].triangles.toLocaleString('en-US')} triangles · ${a[l].draws} draws</figcaption></figure>`).join('');
 cards.push(`<section><h2>${label}</h2><div class="levels">${images}</div></section>`);
}
const index=(await fs.readFile(new URL('index.html',out),'utf8'))
 .replace(/MONTEREY BAY COZY · [^<]+/,`MONTEREY BAY COZY · ${reportDate.toUpperCase()}`)
 .replace(/\d+ creatures<\/span>/,`${assets.filter(a=>a.type==='fish').length} creatures</span>`)
 .replace(/\d+ objects<\/span>/,`${assets.filter(a=>a.type==='object').length} objects</span>`);
await fs.writeFile(new URL('index.html',out),index.slice(0,index.indexOf('<section>'))+cards.join('')+'</main></html>');
let review=await fs.readFile(new URL('REVIEW.md',out),'utf8');
review=review.replace(/^# Distance LOD review — .+/,`# Distance LOD review — ${reportDate}`)
 .replace(/(`tests\/lod-browser\.mjs`: )\d+( checks)/,`$1${data.checks.length}$2`);
const start=review.indexOf('| Asset |'),end=review.indexOf('\n## Actual rendering',start);
review=review.slice(0,start)+'| Asset | Near | Mid | Far | Draws at each level | Far reduction |\n| --- | ---: | ---: | ---: | ---: | ---: |\n'+rows.join('\n')+'\n'+review.slice(end);
for(const backend of ['WebGPU','WebGL 2']){
 const subset=data.scenes.filter(s=>s.backend===backend),[near,auto,far]=['near','auto','far'].map(l=>subset.find(s=>s.level===l));
 const cost=s=>`${s.render.triangles.toLocaleString('en-US')} triangles / ${s.render.drawCalls} draws`;
 const line=`- **${backend}, mixed tank**: Near ${cost(near)}; Auto ${cost(auto)}; forced Far ${cost(far)}. Auto reduces submitted triangles by ${(100*(1-auto.render.triangles/near.render.triangles)).toFixed(1)}% in this fixed wide view.`;
 review=review.split('\n').map(l=>l.startsWith(`- **${backend}, mixed tank**`)?line:l).join('\n');
}
await fs.writeFile(new URL('REVIEW.md',out),review);
console.log(`Updated ${assets.length} asset comparisons from ${data.checks.length} browser checks.`);
