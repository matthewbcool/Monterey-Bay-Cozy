"""Rebuild the small Meals on Wheels annex from retained OSM/USGS evidence, offline.

python3 scripts/extract-caledonia-meals.py --output /tmp/caledonia-meals-site.json
Requires Pillow for the retained F32 GeoTIFF. Makes no provider requests.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = [-121.91685, 36.6256]
CROP = [-240, 15, -145, 90]
RADIUS = 6371008.8
FACTOR = RADIUS * math.pi / 180
COSINE = math.cos(math.radians(ORIGIN[1]))
BUILDING_ID = 559348745


def local(lon, lat):
    return [round((lon - ORIGIN[0]) * FACTOR * COSINE, 4),
            round((ORIGIN[1] - lat) * FACTOR, 4)]


def clip_segment(a, b):
    lo, hi = 0.0, 1.0
    for axis, edge, sign in [(0, CROP[0], 1), (0, CROP[2], -1),
                             (1, CROP[1], 1), (1, CROP[3], -1)]:
        distance = (a[axis] - edge) * sign
        velocity = (b[axis] - a[axis]) * sign
        if abs(velocity) < 1e-12:
            if distance < 0:
                return None
        elif velocity > 0:
            lo = max(lo, -distance / velocity)
        else:
            hi = min(hi, -distance / velocity)
    if lo >= hi:
        return None
    return [[round(a[k] + t * (b[k] - a[k]), 4) for k in (0, 1)]
            for t in (lo, hi)]


def extract(evidence):
    requests = json.loads((evidence / 'source-requests.json').read_text())
    full_way = json.loads((evidence / 'meals-building.json').read_text())
    nodes = {n['id']: local(n['lon'], n['lat'])
             for n in full_way['elements'] if n['type'] == 'node'}
    way = next(w for w in full_way['elements']
               if w['type'] == 'way' and w['id'] == BUILDING_ID)
    ids = way['nodes']
    assert ids[0] == ids[-1], 'Building footprint must be closed'
    assert all(i in nodes for i in ids), 'Incomplete full-way response'
    ring = [nodes[i] for i in ids[:-1]]
    assert len(ring) == 29, 'Review a changed primary footprint before regenerating'
    assert all(CROP[0] <= x <= CROP[2] and CROP[1] <= z <= CROP[3]
               for x, z in ring), 'Annex must contain the complete building'
    building = dict(id=f'way/{BUILDING_ID}', rings=[ring], tags=way['tags'],
                    version=way['version'], sourceTimestamp=way['timestamp'],
                    nodeIds=ids[:-1])

    osm = ET.parse(evidence / 'meals-annex-map.osm').getroot()
    assert osm.tag == 'osm', 'Not an OSM map response'
    map_nodes = {n.attrib['id']: local(float(n.attrib['lon']), float(n.attrib['lat']))
                 for n in osm.findall('node')}
    paths = []
    for source_way in osm.findall('way'):
        tags = {t.attrib['k']: t.attrib['v'] for t in source_way.findall('tag')}
        if 'highway' not in tags:
            continue
        refs = [n.attrib['ref'] for n in source_way.findall('nd')]
        assert all(i in map_nodes for i in refs), 'Incomplete route member nodes'
        points = [map_nodes[i] for i in refs]
        for a, b in zip(points, points[1:]):
            clipped = clip_segment(a, b)
            if clipped:
                paths.append(dict(id='way/' + source_way.attrib['id'],
                                  kind=tags['highway'], name=tags.get('name', ''),
                                  width=tags.get('width', ''), points=clipped, tags=tags))
    assert any(p['name'] == 'Briggs Avenue' for p in paths), 'Missing road context'

    meta = json.loads((evidence / 'usgs-export.json').read_text())
    control = json.loads((evidence / 'usgs-control-point.json').read_text())
    with Image.open(evidence / 'usgs-dem.tif') as raster:
        assert raster.mode == 'F', 'Expected a single-band floating-point DEM'
        assert raster.size == (meta['width'], meta['height']), 'Raster/export mismatch'
        columns, rows = raster.size
        pixels = raster.get_flattened_data() if hasattr(raster, 'get_flattened_data') else raster.getdata()
        values = [round(float(v), 3) for v in pixels]
    assert all(math.isfinite(v) and -20 < v < 150 for v in values), 'Invalid/no-data terrain'
    extent = meta['extent']
    dx = (extent['xmax'] - extent['xmin']) / columns
    dy = (extent['ymax'] - extent['ymin']) / rows
    grid = dict(minX=(extent['xmin'] + dx / 2 - ORIGIN[0]) * FACTOR * COSINE,
                minZ=(ORIGIN[1] - extent['ymax'] + dy / 2) * FACTOR,
                stepX=dx * FACTOR * COSINE, stepZ=dy * FACTOR,
                columns=columns, rows=rows)
    assert grid['minX'] <= CROP[0] and grid['minZ'] <= CROP[1]
    assert grid['minX'] + (columns - 1) * grid['stepX'] >= CROP[2]
    assert grid['minZ'] + (rows - 1) * grid['stepZ'] >= CROP[3]
    sample = control['samples'][0]
    terrain = dict(grid=grid, values=values, units='metres',
                   verticalDatum=sample['attributes']['VerticalDatum'],
                   sourceName=sample['attributes']['Name'],
                   sourceAcquisitionStart=sample['attributes']['StartDate'],
                   sourceAcquisitionEnd=sample['attributes']['EndDate'],
                   controlPoint=dict(longitude=sample['location']['x'],
                                     latitude=sample['location']['y'],
                                     height=float(sample['value']),
                                     sourceResolutionMetres=sample['resolution']),
                   limits='Bilinearly resampled USGS 3DEP terrain; source control point '
                          'identifies 1 m lidar terrain, while this cache samples about '
                          '4.79 by 5.97 m. Building floor/porch grading is authored separately.')
    source_files = ['meals-building.json', 'meals-annex-map.osm', 'usgs-dem.tif',
                    'usgs-export.json', 'usgs-control-point.json', 'source-requests.json']
    hashes = {name: hashlib.sha256((evidence / name).read_bytes()).hexdigest()
              for name in source_files}
    return dict(name='Meals on Wheels Community Center north annex', origin=ORIGIN,
                crop=CROP, downloaded=requests['downloaded'],
                projection=dict(type='local equirectangular', earthRadiusMetres=RADIUS,
                                sourceCRS='EPSG:4326', x='east', z='south', units='metres'),
                buildingId=f'way/{BUILDING_ID}', osmUrl=requests['mapUrl'],
                buildingUrl=requests['buildingUrl'], terrainUrl=requests['terrainUrl'],
                license='OSM: ODbL 1.0; USGS: public domain',
                buildings=[building], paths=paths, terrain=terrain, sourceHashes=hashes,
                limits='Only this complete building and clipped road/path context are included. '
                       'Neighboring structures are outside this asset scope. OSM paths tagged '
                       'golf cartpath or private retain those tags and are not public streets.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--evidence', type=Path,
                        default=ROOT / 'artifacts/caledonia-refinement/sources')
    parser.add_argument('--output', type=Path,
                        default=ROOT / 'src/data/caledonia-meals-site.json')
    args = parser.parse_args()
    result = extract(args.evidence)
    args.output.write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f"Wrote {args.output}: 29 footprint vertices, {len(result['paths'])} route segments, "
          f"{len(result['terrain']['values'])} DEM samples")


if __name__ == '__main__':
    main()
