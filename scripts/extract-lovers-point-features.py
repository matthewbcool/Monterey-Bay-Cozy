#!/usr/bin/env python3
"""Extract the bounded gym's OSM features from a local API 0.6 XML snapshot.

Usage: python3 scripts/extract-lovers-point-features.py /path/to/map.xml \
  --downloaded 2026-10-22 --output src/data/lovers-point-features.json

No network access or dependencies. Source ways retain their IDs and semantic tags;
path segments are clipped to the scene crop, while selected closed polygon rings
are preserved. The park boundary does not imply that all of its area is grass.
"""

import argparse
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path

ORIGIN = [-121.91685, 36.6256]
CROP = [-145, -160, 150, 130]  # minX, minZ, maxX, maxZ; metre scene axes
SOURCE_URL = 'https://api.openstreetmap.org/api/0.6/map?bbox=-121.9185,36.6245,-121.914,36.6275'
PHOTO_URL = 'https://files.cityofpacificgrove.org/Document_Center/Departments/Public%20Works/Buildings%20%26%20Grounds/Lovers%20Point%20Park.pdf?t=202510301223500'
TAG_KEYS = {'name', 'highway', 'footway', 'surface', 'width', 'lanes', 'bridge',
            'leisure', 'natural', 'sport', 'lit', 'type', 'wikidata', 'access', 'amenity', 'man_made'}


def project(lon, lat):
    factor = 6371008.8 * math.pi / 180
    return [(lon - ORIGIN[0]) * factor * math.cos(math.radians(ORIGIN[1])),
            -(lat - ORIGIN[1]) * factor]


def rounded(points):
    return [[round(x, 3), round(z, 3)] for x, z in points]


def tags(element):
    return {tag.get('k'): tag.get('v') for tag in element.findall('tag')
            if tag.get('k') in TAG_KEYS}


def clip_segment(a, b):
    """Liang-Barsky: preserve boundary intersections, not just in-crop nodes."""
    dx, dz = b[0] - a[0], b[1] - a[1]
    start, end = 0.0, 1.0
    for p, q in ((-dx, a[0] - CROP[0]), (dx, CROP[2] - a[0]),
                 (-dz, a[1] - CROP[1]), (dz, CROP[3] - a[1])):
        if p == 0:
            if q < 0:
                return None
        elif p < 0:
            start = max(start, q / p)
        else:
            end = min(end, q / p)
        if start > end:
            return None
    if end - start < 1e-10:
        return None
    return [[a[0] + start * dx, a[1] + start * dz],
            [a[0] + end * dx, a[1] + end * dz]]


def clipped_runs(points):
    runs, run = [], []
    for a, b in zip(points, points[1:]):
        segment = clip_segment(a, b)
        if segment is None:
            if run:
                runs.append(run)
                run = []
            continue
        a, b = segment
        if run and math.dist(run[-1], a) < 1e-6:
            run.append(b)
        else:
            if run:
                runs.append(run)
            run = [a, b]
    if run:
        runs.append(run)
    return runs


def join_rings(segments):
    """Assemble relation member ways without flattening inner/outer roles."""
    pending = [list(segment) for segment in segments]
    result = []
    while pending:
        ring = pending.pop(0)
        while ring[0] != ring[-1]:
            for index, candidate in enumerate(pending):
                if ring[-1] == candidate[0]:
                    ring += candidate[1:]
                elif ring[-1] == candidate[-1]:
                    ring += list(reversed(candidate[:-1]))
                elif ring[0] == candidate[-1]:
                    ring = candidate[:-1] + ring
                elif ring[0] == candidate[0]:
                    ring = list(reversed(candidate[1:])) + ring
                else:
                    continue
                pending.pop(index)
                break
            else:
                raise ValueError('Incomplete relation ring; fetch the missing source ways')
        result.append(ring)
    return result


def extract(xml_path, downloaded):
    root = ET.parse(xml_path).getroot()
    nodes = {node.get('id'): project(float(node.get('lon')), float(node.get('lat')))
             for node in root.findall('node')}
    ways = {way.get('id'): way for way in root.findall('way')}

    def refs(way):
        return [node.get('ref') for node in way.findall('nd')]

    def positions(node_refs):
        # A partial input must fail rather than silently create guessed edges.
        return [nodes[ref] for ref in node_refs]

    polygons, paths = [], []
    for way in root.findall('way'):
        values = tags(way)
        kind = ('beach' if values.get('natural') == 'beach' else
                'pool' if values.get('leisure') == 'swimming_pool' else
                'volleyball' if values.get('sport') == 'beachvolleyball' else
                'parking' if values.get('amenity') == 'parking' else
                'breakwater' if values.get('man_made') == 'breakwater' else None)
        if kind:
            node_refs = refs(way)
            if kind in ('parking', 'breakwater'):
                outline = positions(node_refs)
                cx = sum(p[0] for p in outline) / len(outline)
                cz = sum(p[1] for p in outline) / len(outline)
                if not (CROP[0] <= cx <= CROP[2] and CROP[1] <= cz <= CROP[3]):
                    continue
            if node_refs[0] != node_refs[-1]:
                raise ValueError(f'Open polygon way/{way.get("id")}')
            polygons.append({'id': f'way/{way.get("id")}', 'kind': kind,
                             'tags': values,
                             'rings': [{'role': 'outer', 'points': rounded(positions(node_refs))}]})
        if values.get('highway'):
            for index, run in enumerate(clipped_runs(positions(refs(way)))):
                paths.append({'id': f'way/{way.get("id")}', 'part': index,
                              'highway': values['highway'], 'tags': values,
                              'points': rounded(run)})

    # The primary park is one multipolygon. Other large park/reserve relations in
    # the API response are intentionally excluded from this small exercise world.
    park = next((relation for relation in root.findall('relation')
                 if relation.get('id') == '16861626'), None)
    if park is None:
        raise ValueError('Missing Lovers Point Park relation/16861626')
    rings = []
    for role in ('outer', 'inner'):
        segments = [refs(ways[member.get('ref')]) for member in park.findall('member')
                    if member.get('type') == 'way' and member.get('role') == role]
        rings.extend({'role': role, 'points': rounded(positions(ring))}
                     for ring in join_rings(segments))
    polygons.append({'id': 'relation/16861626', 'kind': 'park', 'tags': tags(park), 'rings': rings})

    return {
        'origin': ORIGIN, 'downloaded': downloaded,
        'source': 'OpenStreetMap contributors', 'sourceUrl': SOURCE_URL,
        'license': 'ODbL 1.0', 'attributionUrl': 'https://www.openstreetmap.org/copyright',
        'crop': CROP,
        'coordinateFrame': 'Metres; +X east, +Y up, +Z south. Earth radius 6371008.8 m.',
        'limits': 'OSM planimetric features, not a survey. Millimetre rounding is storage precision, not positional accuracy. Paths are clipped to the crop. Polygon source rings are closed and preserved. Park bounds are not mapped lawn coverage; widths, elevations, heights and planting remain authored.',
        'references': [{'url': PHOTO_URL, 'title': 'City of Pacific Grove, Lovers Point Park Facilities assessment (draft)',
                        'reportDate': '2025-07-07', 'siteVisitDate': '2025-06-16',
                        'pages': [33, 34, 44, 53],
                        'use': 'Photo and aerial layout reference only; no image textures or aerial trace are redistributed.'}],
        'polygons': polygons, 'paths': paths,
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('xml', type=Path)
    parser.add_argument('--downloaded', required=True, help='Actual XML retrieval date, YYYY-MM-DD')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    result = extract(args.xml, args.downloaded)
    args.output.write_text(json.dumps(result, separators=(',', ':'), ensure_ascii=False) + '\n')
    print(f'{len(result["polygons"])} polygons; {len(result["paths"])} bounded path runs; {args.output.stat().st_size} bytes')
