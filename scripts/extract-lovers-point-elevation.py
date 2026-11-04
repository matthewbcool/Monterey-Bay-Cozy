#!/usr/bin/env python3
"""Rebuild the cached terrain JSON from the retained USGS raster and metadata.
Requires Pillow at authoring time only; the game has no Python/network dependency.
Usage: python3 scripts/extract-lovers-point-elevation.py --output /tmp/elevation.json
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--evidence', type=Path, default=Path('artifacts/testing-gym-elevation'))
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
e = json.loads((args.evidence / 'usgs-export.json').read_text())['extent']
metadata = json.loads((args.evidence / 'usgs-source-metadata.json').read_text())['samples'][0]
im = Image.open(args.evidence / 'usgs-dem.tif')
assert im.mode == 'F', 'Expected a float elevation raster, not a colored image'
f = 6371008.8 * math.pi / 180
c = math.cos(math.radians(36.6256))
dx = (e['xmax'] - e['xmin']) / im.width
dz = (e['ymax'] - e['ymin']) / im.height
values = [round(v, 3) for v in im.getdata()]
assert all(math.isfinite(v) and -20 < v < 100 for v in values), 'Unexpected NoData or elevation'
data = {
    'origin': [-121.91685, 36.6256], 'downloaded': '2026-10-22',
    'source': 'USGS 3DEP bare-earth DEM',
    'sourceUrl': 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer',
    'verticalDatum': metadata['attributes']['VerticalDatum'],
    'pointSourceMetadata': metadata['attributes'], 'extent': e,
    'grid': {'minX': (e['xmin'] + dx/2 + 121.91685)*f*c,
             'minZ': -(e['ymax'] - dz/2 - 36.6256)*f,
             'stepX': dx*f*c, 'stepZ': dz*f, 'columns': im.width, 'rows': im.height,
             'order': 'row-major north to south; west to east'},
    'values': values,
    'limits': 'Bilinearly resampled export from the dynamic USGS DEM; source point checks identify 1 m lidar-derived terrain. Sampling is about 5 by 6.23 m, not survey accuracy. No bathymetry or live tide claim; structures and sharp walls require authored interpretation.'}
args.output.write_text(json.dumps(data, separators=(',', ':')) + '\n')
print(f'{im.width} x {im.height} samples; {min(values):.3f} to {max(values):.3f} m NAVD88')
