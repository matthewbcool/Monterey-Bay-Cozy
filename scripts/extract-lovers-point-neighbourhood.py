#!/usr/bin/env python3
"""Derive the Testing Gym's neighbourhood backdrop from the cached regional OSM download.

Usage: python3 scripts/extract-lovers-point-neighbourhood.py \
  --source src/data/monterey-map.json --output src/data/lovers-point-neighbourhood.json

No network access or dependencies. Reads the same October 13 OpenStreetMap download that
Map Study uses (ODbL 1.0) and keeps buildings and roads that lie outside the gym's detailed
crop but within RADIUS of the park, projected into the gym's metre frame. Buildings keep
their OSM IDs and level tags; heights are not in the source and remain an authored default.
Road segments are kept only when both ends are outside the crop, so they never overlap the
detailed park's own mapped roads. The cached regional lines carry no OSM IDs or highway classes.
"""

import argparse
import json
import math
from pathlib import Path

ORIGIN = [-121.91685, 36.6256]
CROP = [-145, -160, 150, 130]  # minX, minZ, maxX, maxZ of the detailed gym; metre scene axes
RADIUS = 450


def project(lon, lat):
    factor = 6371008.8 * math.pi / 180
    return [(lon - ORIGIN[0]) * factor * math.cos(math.radians(ORIGIN[1])),
            -(lat - ORIGIN[1]) * factor]


def outside_crop(x, z):
    return x < CROP[0] or x > CROP[2] or z < CROP[1] or z > CROP[3]


def near(x, z):
    return math.hypot(x, z) <= RADIUS


def rounded(points):
    return [[round(x, 3), round(z, 3)] for x, z in points]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='src/data/monterey-map.json')
    parser.add_argument('--output', default='src/data/lovers-point-neighbourhood.json')
    args = parser.parse_args()
    data = json.loads(Path(args.source).read_text())
    buildings = []
    for building in data['buildings']:
        outer = [project(*p) for p in building['rings'][0]]
        if outer[0] == outer[-1]:
            outer = outer[:-1]
        if len(outer) < 3 or not all(outside_crop(x, z) for x, z in outer) or not all(near(x, z) for x, z in outer):
            continue
        tags = building.get('tags', {})
        record = {'id': building['id'], 'points': rounded(outer)}
        if 'building:levels' in tags:
            record['levels'] = tags['building:levels']
        buildings.append(record)
    roads = []
    for line in data['lines']:
        if line.get('kind') != 'road':
            continue
        run = []
        for lon, lat in line['points']:
            x, z = project(lon, lat)
            if outside_crop(x, z) and near(x, z):
                run.append([x, z])
            else:
                if len(run) > 1:
                    roads.append({'points': rounded(run)})
                run = []
        if len(run) > 1:
            roads.append({'points': rounded(run)})
    result = {
        'source': 'OpenStreetMap contributors, ODbL 1.0 (via src/data/monterey-map.json)',
        'downloaded': data.get('downloaded'),
        'origin': ORIGIN, 'crop': CROP, 'radius': RADIUS,
        'note': 'Backdrop outside the detailed crop. Heights, ground level beyond the cached DEM and colours are authored.',
        'buildings': buildings, 'roads': roads,
    }
    Path(args.output).write_text(json.dumps(result, separators=(',', ':')) + '\n')
    print(f'{len(buildings)} buildings, {len(roads)} road runs -> {args.output}')


if __name__ == '__main__':
    main()
