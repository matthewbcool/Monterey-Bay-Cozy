"""Offline municipal inventory extraction. Usage: python3 scripts/import-park-trees.py RAW.json
No network call or TLS override. Keep the downloaded public response outside the repo.
Positions are retained exactly in WGS84 and projected with the existing OSM coordinate frame.
"""
import json, math, sys
from pathlib import Path
root = Path(__file__).resolve().parents[1]
features = json.loads((root/'src/data/lovers-point-features.json').read_text())
raw = json.loads(Path(sys.argv[1]).read_text())
assert not raw.get('error') and not raw.get('exceededTransferLimit'), 'Incomplete municipal response'
rings = [r['points'] for f in features['polygons'] if f['kind']=='park' for r in f['rings'] if r['role']=='outer']
def inside(x,z,pts):
    hit = False
    for (a,b),(u,v) in zip(pts,pts[1:]+pts[:1]):
        if (b>z)!=(v>z) and x<(u-a)*(z-b)/(v-b)+a: hit=not hit
    return hit
species = {'Cupressus macrocarpa':'monterey-cypress','Metrosideros excelsus':'pohutukawa','Phoenix canariensis':'canary-island-date-palm','Cordyline australis':'cabbage-tree','Ilex spp.':'inventory-holly'}
trees=[]
for feature in raw['features']:
    a,g=feature['attributes'],feature['geometry']
    x=(g['x']-features['origin'][0])*math.pi/180*6371008.8*math.cos(features['origin'][1]*math.pi/180)
    z=-(g['y']-features['origin'][1])*math.pi/180*6371008.8
    if not any(inside(x,z,ring) for ring in rings): continue
    trees.append(dict(sourceId=a['OBJECTID'],botanical=a['BOTANICAL'],species=species[a['BOTANICAL']],dbhSourceValue=a['DBH'],longitude=g['x'],latitude=g['y'],x=round(x,3),z=round(z,3)))
trees.sort(key=lambda t:t['sourceId'])
data=dict(source='City of Pacific Grove public tree inventory',sourceUrl='https://gis-web.cityofpacificgrove.org/arcgis/rest/services/Open_Data/Trees/MapServer/0',downloaded='2026-10-24',origin=features['origin'],queryBounds=[-121.9185,36.6245,-121.914,36.6275],queryCount=len(raw['features']),selection='Point inside the OSM park outer ring; no automatic relocation or thinning',limitations='Inventory observation dates and positional accuracy unknown. Not a current site survey. Heights, crown widths, orientation and condition are authored. DBH retained in source units, which the service does not identify; never treated as a measured height. Ilex identified only to genus. Service certificate was expired at retrieval; one unauthenticated public GET used a scoped verification exception, not a runtime setting.',trees=trees)
(root/'src/data/lovers-point-trees.json').write_text(json.dumps(data,indent=2)+'\n')
print(f'Saved {len(trees)} park tree records from {len(raw["features"])} bounded records')
