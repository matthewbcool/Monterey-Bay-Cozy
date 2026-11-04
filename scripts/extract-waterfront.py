"""Offline waterfront extraction from retained OSM XML, USGS raster, and regional building rings."""
import json,math,xml.etree.ElementTree as ET,argparse
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--evidence',type=Path,required=True);p.add_argument('--map',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
origin=[-121.91685,36.6256]; f=6371008.8*math.pi/180;c=math.cos(origin[1]*math.pi/180);crop=[-145,130,1500,900]
def local(lon,lat):return [round((lon-origin[0])*f*c,3),round(-(lat-origin[1])*f,3)]
def clip(poly):
 for axis,edge,sign in [(0,crop[0],1),(0,crop[2],-1),(1,crop[1],1),(1,crop[3],-1)]:
  out=[]
  for i,b in enumerate(poly):
   aa=poly[i-1];da=(aa[axis]-edge)*sign;db=(b[axis]-edge)*sign
   if da*db<0:
    t=da/(da-db);out.append([aa[k]+t*(b[k]-aa[k]) for k in [0,1]])
   if db>=0:out.append(b)
  poly=out
 return poly
r=ET.parse(a.evidence/'waterfront.osm').getroot();nodes={n.attrib['id']:local(float(n.attrib['lon']),float(n.attrib['lat'])) for n in r.findall('node')};ways=[]
for w in r.findall('way'):
 ids=[n.attrib['ref'] for n in w.findall('nd')]
 if not all(n in nodes for n in ids):continue
 ways.append(dict(id='way/'+w.attrib['id'],points=[nodes[n] for n in ids],tags={t.attrib['k']:t.attrib['v'] for t in w.findall('tag')}))
coasts=[w['points'] for w in ways if w['tags'].get('natural')=='coastline'];chain=coasts.pop(0)
while coasts:
 for i,line in enumerate(coasts):
  if chain[-1]==line[0]:chain+=line[1:];break
  if line[-1]==chain[0]:chain=line[:-1]+chain;break
 else:raise ValueError('Disconnected coast')
 coasts.pop(i)
chain.reverse() # north to south
# Clip coastline segments to north/south crop; keep real corners, including Hopkins coves.
coast=[]
for aa,b in zip(chain,chain[1:]):
 ts=[0.,1.]
 for z in [crop[1],crop[3]]:
  if aa[1]!=b[1]:
   t=(z-aa[1])/(b[1]-aa[1])
   if 0<t<1:ts.append(t)
 ts.sort()
 for lo,hi in zip(ts,ts[1:]):
  mid=(lo+hi)/2
  if crop[1]<=aa[1]+mid*(b[1]-aa[1])<=crop[3]:
   for t in [lo,hi]:
    point=[round(aa[k]+t*(b[k]-aa[k]),3) for k in [0,1]]
    if not coast or point!=coast[-1]:coast.append(point)
# Match the existing authored southern park seam; true mapped point is retained in metadata.
seam=coast[0][:];coast[0]=[72,130]
land=clip(coast+[[crop[0],crop[3]],[crop[0],crop[1]]])
def inside(p):return crop[0]<=p[0]<=crop[2] and crop[1]<=p[1]<=crop[3]
roads=[]
for w in ways:
 if 'highway' not in w['tags']:continue
 for aa,b in zip(w['points'],w['points'][1:]):
  lo,hi=0.,1.
  for axis,mn,mx in [(0,crop[0],crop[2]),(1,crop[1],crop[3])]:
   d=b[axis]-aa[axis]
   if d==0:
    if not mn<=aa[axis]<=mx:hi=-1
   else:
    t0,t1=sorted(((mn-aa[axis])/d,(mx-aa[axis])/d));lo=max(lo,t0);hi=min(hi,t1)
  if lo<hi:roads.append(dict(id=w['id'],kind=w['tags']['highway'],name=w['tags'].get('name',''),points=[[round(aa[k]+t*(b[k]-aa[k]),3) for k in [0,1]] for t in [lo,hi]],surface=w['tags'].get('surface',''),width=w['tags'].get('width','')))
regional=json.loads(a.map.read_text());buildings=[]
for b in regional['buildings']:
 rings=[[local(*p) for p in ring] for ring in b['rings']];pts=rings[0];center=[sum(p[k] for p in pts)/len(pts) for k in [0,1]]
 if inside(center):buildings.append(dict(id=b['id'],rings=rings,tags=b['tags']))
polygons=[]
for w in ways:
 kind='beach' if w['tags'].get('natural')=='beach' else 'park' if w['tags'].get('leisure')=='park' else None
 if kind and w['points'][0]==w['points'][-1]:
  ring=clip(w['points'][:-1])
  if len(ring)>2:polygons.append(dict(id=w['id'],kind=kind,name=w['tags'].get('name',''),points=ring))
e=json.loads((a.evidence/'usgs-export.json').read_text());im=Image.open(a.evidence/'usgs-dem.tif');assert im.mode=='F';v=[round(x,3) for x in im.getdata()];assert all(math.isfinite(x) and -30<x<150 for x in v)
ex=e['extent'];dx=(ex['xmax']-ex['xmin'])/im.width;dy=(ex['ymax']-ex['ymin'])/im.height
terrain=dict(source='USGS 3DEP bare-earth DEM',sourceUrl=e['requestUrl'],extent=ex,grid=dict(minX=(ex['xmin']+dx/2-origin[0])*f*c,minZ=-(ex['ymax']-dy/2-origin[1])*f,stepX=dx*f*c,stepZ=dy*f,columns=im.width,rows=im.height),values=v)
out=dict(name='Pacific Grove waterfront to the Aquarium',origin=origin,crop=crop,downloaded='2026-10-24',buildingSnapshot=regional['downloaded'],source='OpenStreetMap contributors',sourceUrl='https://api.openstreetmap.org/api/0.6/map?bbox=-121.9186,36.6173,-121.8995,36.6247',license='ODbL 1.0',attributionUrl='https://www.openstreetmap.org/copyright',mappedNorthSeam=seam,coast=coast,land=land,paths=roads,buildings=buildings,polygons=polygons,terrain=terrain,limits='OSM footprints/route tags and USGS terrain. Authored heights, roof forms, vegetation, path widths and 20 m seam blending. No building interiors or surveyed bathymetry.')
a.output.write_text(json.dumps(out,separators=(',',':'))+'\n');print(len(coast),'coast vertices;',len(buildings),'buildings;',len(roads),'route segments;',len(polygons),'polygons;',im.size,'DEM',min(v),max(v))
