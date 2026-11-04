"""Rebuild Caledonia's local cache from retained OSM XML and USGS raster (no network)."""
import json, math, xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
evidence=ROOT/'artifacts/caledonia-park'
origin=[-121.91685,36.6256]; factor=6371008.8*math.pi/180; cosine=math.cos(math.radians(origin[1]))
crop=[-430,90,-145,450]
def local(lon,lat): return [round((lon-origin[0])*factor*cosine,4),round((origin[1]-lat)*factor,4)]
def clip(poly):
 for axis,edge,sign in [(0,crop[0],1),(0,crop[2],-1),(1,crop[1],1),(1,crop[3],-1)]:
  out=[]
  for i,b in enumerate(poly):
   a=poly[i-1];da=(a[axis]-edge)*sign;db=(b[axis]-edge)*sign
   if da*db<0:
    t=da/(da-db);out.append([round(a[k]+t*(b[k]-a[k]),4) for k in [0,1]])
   if db>=0:out.append(b)
  poly=out
  if not poly:break
 return poly
root=ET.parse(evidence/'caledonia.osm').getroot()
nodes={n.attrib['id']:local(float(n.attrib['lon']),float(n.attrib['lat'])) for n in root.findall('node')}
ways=[]
for w in root.findall('way'):
 ids=[n.attrib['ref'] for n in w.findall('nd')]
 if all(i in nodes for i in ids):ways.append(dict(id='way/'+w.attrib['id'],points=[nodes[i] for i in ids],tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}))
features=[];roads=[];buildings=[]
for w in ways:
 t=w['tags'];pts=w['points']
 if pts[0]==pts[-1] and t.get('leisure') in ['park','playground','pitch']:
  ring=clip(pts[:-1])
  if len(ring)>2:features.append(dict(id=w['id'],kind=t['leisure'],name=t.get('name',''),sport=t.get('sport',''),points=ring))
 if 'highway' in t:
  for a,b in zip(pts,pts[1:]):
   lo=0.;hi=1.
   for axis,edge,sign in [(0,crop[0],1),(0,crop[2],-1),(1,crop[1],1),(1,crop[3],-1)]:
    d=(a[axis]-edge)*sign;v=(b[axis]-a[axis])*sign
    if abs(v)<1e-12:
     if d<0:hi=-1
    elif v>0:lo=max(lo,-d/v)
    else:hi=min(hi,-d/v)
   if lo<hi:roads.append(dict(id=w['id'],kind=t['highway'],name=t.get('name',''),width=t.get('width',''),points=[[round(a[k]+v*(b[k]-a[k]),4) for k in [0,1]] for v in [lo,hi]]))
# Fresh OSM buildings include the district outside the original regional map crop.
waterfront=json.loads((ROOT/'src/data/pacific-grove-waterfront.json').read_text());owned={b['id'] for b in waterfront['buildings']}
for w in ways:
 if 'building' not in w['tags'] or w['id'] in owned or w['points'][0]!=w['points'][-1]:continue
 ring=clip(w['points'][:-1])
 if len(ring)>2:buildings.append(dict(id=w['id'],rings=[ring],tags=w['tags']))
meta=json.loads((evidence/'usgs-export.json').read_text());image=Image.open(evidence/'usgs-dem.tif');ex=meta['extent'];dx=(ex['xmax']-ex['xmin'])/image.width;dy=(ex['ymax']-ex['ymin'])/image.height
values=[round(float(v),3) for v in image.getdata()];assert all(math.isfinite(v) and -20<v<150 for v in values)
terrain=dict(grid=dict(minX=(ex['xmin']+dx/2-origin[0])*factor*cosine,minZ=(origin[1]-ex['ymax']+dy/2)*factor,stepX=dx*factor*cosine,stepZ=dy*factor,columns=image.width,rows=image.height),values=values)
out=dict(name='Caledonia Park and surrounding streets',origin=origin,crop=crop,downloaded='2026-10-25',osmUrl='https://api.openstreetmap.org/api/0.6/map?bbox=-121.9223,36.6202,-121.9182,36.6246',terrainUrl='https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',buildingSnapshot='2026-10-25',license='ODbL 1.0',features=features,paths=roads,buildings=buildings,terrain=terrain)
(ROOT/'src/data/caledonia-park.json').write_text(json.dumps(out,separators=(',',':'))+'\n')
print(len(features),'features;',len(roads),'route segments;',len(buildings),'building parts;',len(values),'DEM samples')
