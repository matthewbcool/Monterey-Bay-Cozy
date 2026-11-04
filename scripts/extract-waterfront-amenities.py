#!/usr/bin/env python3
"""Extract candidate facilities from the retained October 24 OSM snapshot."""
from pathlib import Path
import argparse,json,math,xml.etree.ElementTree as E
p=argparse.ArgumentParser(description=__doc__)
p.add_argument("--source",required=True)
p.add_argument("--output",required=True)
a=p.parse_args()
r=E.parse(a.source).getroot();k=math.pi/180*6371008.8
items=[]
for n in r.findall('node'):
 t={a.attrib['k']:a.attrib['v'] for a in n.findall('tag')};kind=t.get('amenity') or t.get('tourism')
 if kind not in ['bench','waste_basket','bicycle_parking','information']:continue
 lon,lat=float(n.attrib['lon']),float(n.attrib['lat']);x=(lon+121.91685)*k*math.cos(36.6256*math.pi/180);z=-(lat-36.6256)*k
 if 130<z<900 and -145<x<1500:items.append(dict(id='node/'+n.attrib['id'],kind=kind,position=[round(x,3),round(z,3)],lonLat=[lon,lat],tags=t))
p=Path(a.output);p.write_text(json.dumps(dict(source='OpenStreetMap contributors',downloaded='2026-10-24',license='ODbL 1.0',sourceFile='artifacts/pacific-grove-waterfront/waterfront.osm',origin=[-121.91685,36.6256],items=items),indent=2)+'\n');print(len(items))
