"""Rebuild the bay-wide cache from retained service responses; no network requests.
Requires Pillow and the repository's existing Node/tsx/polygon-clipping dependencies.
"""
import argparse,json,math,subprocess,tempfile,csv
from pathlib import Path
from PIL import Image
p=argparse.ArgumentParser();p.add_argument('--evidence',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--node',default='node');a=p.parse_args()
e=a.evidence
for name in ['land','roads','places-1','places-2','places-3']:
 d=json.loads((e/(name+'.json')).read_text());assert not d.get('error') and not d.get('exceededTransferLimit'),name
im=Image.open(e/'dem.tiff');assert im.mode=='F'
raw=list(im.get_flattened_data());export=json.loads((e/'dem-export.json').read_text())
rows=list(csv.reader((e/'etopo.csv').read_text().splitlines()))[2:]
lats=sorted({float(r[0]) for r in rows},reverse=True);lons=sorted({float(r[1])-360 for r in rows});lookup={(float(r[0]),float(r[1])-360):float(r[2]) for r in rows}
bathy={'columns':len(lons),'rows':len(lats),'west':lons[0],'north':lats[0],'stepLon':lons[1]-lons[0],'stepLat':lats[0]-lats[1],'values':[lookup[(lat,lon)] for lat in lats for lon in lons]}
def sample_bathy(lon,lat):
 x=max(0,min(len(lons)-1.000001,(lon-lons[0])/bathy['stepLon']));z=max(0,min(len(lats)-1.000001,(lats[0]-lat)/bathy['stepLat']));i,j=int(x),int(z);u,v=x-i,z-j
 return sum(bathy['values'][(j+dj)*len(lons)+i+di]*w for di,dj,w in [(0,0,(1-u)*(1-v)),(1,0,u*(1-v)),(0,1,(1-u)*v),(1,1,u*v)])
west,south,east,north=[-122.12,36.55,-121.70,37.03];columns,lines=161,201;ex=export['extent'];filled=0;values=[]
for j in range(lines):
 lat=north+(south-north)*j/(lines-1)
 for i in range(columns):
  lon=west+(east-west)*i/(columns-1);x=max(0,min(im.width-1.000001,(lon-ex['xmin'])/(ex['xmax']-ex['xmin'])*im.width-.5));z=max(0,min(im.height-1.000001,(ex['ymax']-lat)/(ex['ymax']-ex['ymin'])*im.height-.5));ix,iz=int(x),int(z);u,v=x-ix,z-iz
  samples=[(raw[(iz+dj)*im.width+ix+di],w) for di,dj,w in [(0,0,(1-u)*(1-v)),(1,0,u*(1-v)),(0,1,(1-u)*v),(1,1,u*v)]]
  valid=[(h,w) for h,w in samples if math.isfinite(h) and -20<=h<=1000 and w>0]
  if valid:h=sum(h*w for h,w in valid)/sum(w for h,w in valid)
  else:h=max(0,sample_bathy(lon,lat));filled+=1
  values.append(round(max(0,h),1))
terrain={'columns':columns,'rows':lines,'west':west,'north':north,'stepLon':(east-west)/(columns-1),'stepLat':(north-south)/(lines-1),'values':values,'fallbackSamples':filled,'invalidSourceSamples':sum(1 for x in raw if not math.isfinite(x) or not -20<=x<=1000),'sourceRasterSize':[im.width,im.height]}
with tempfile.TemporaryDirectory() as d:
 tmp=Path(d)/'grids.json';tmp.write_text(json.dumps({'terrain':terrain,'bathy':bathy}))
 subprocess.run([a.node,'--import','tsx',str(Path(__file__).with_suffix('.ts')),str(e),str(tmp),str(a.output)],check=True)
