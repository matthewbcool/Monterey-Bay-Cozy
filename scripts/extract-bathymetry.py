"""Offline USGS DS781 extraction. Requires rasterio + pyproj; never edits source.
Usage: python extract-bathymetry.py SOURCE.tif --output OUTPUT.json
The input may be the original GeoTIFF or the retained georeferenced crop.
"""
import argparse, hashlib, json, math
from pathlib import Path
import rasterio
from pyproj import Transformer
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('source', type=Path)
p.add_argument('--output', required=True, type=Path)
a = p.parse_args()
g = dict(minX=-160, minZ=-250, step=10, columns=169, rows=118)
origin = [-121.91685, 36.6256]
factor = 6371008.8 * math.pi / 180
with rasterio.open(a.source) as raster:
    assert raster.crs.to_epsg() == 26910 and raster.res == (2, 2)
    transform = Transformer.from_crs('EPSG:4326', raster.crs, always_xy=True)
    def projected(x, z):
        return transform.transform(origin[0] + x / (factor * math.cos(math.radians(origin[1]))), origin[1] - z / factor)
    xy = [projected(g['minX'] + i*g['step'], g['minZ'] + j*g['step']) for j in range(g['rows']) for i in range(g['columns'])]
    def sample(points):
        return [None if v.mask[0] else round(float(v[0]), 3) for v in raster.sample(points, masked=True)]
    values = sample(xy)
    controls = [[110,-20],[140,-40],[180,-50],[240,-100],[100,-200],[200,-220],[500,0],[92.71,41.95]]
    controls = [dict(x=x,z=z,elevation=y) for (x,z),y in zip(controls,sample([projected(x,z) for x,z in controls]))]
source = dict(title='USGS Bathymetry, Offshore of Monterey, California', doi='https://doi.org/10.5066/F70Z71C8',
    metadata='https://cmgds.marine.usgs.gov/data/csmp/OffshoreMonterey/metadata/Bathymetry_2m_OffshoreMonterey_metadata.html',
    download='https://cmgds.marine.usgs.gov/data/csmp/OffshoreMonterey/data/Bathymetry_2m_OffshoreMonterey.zip',
    publication=2016, surveyYears=[1998,2012], retrieved='2026-10-25', horizontalCRS='EPSG:26910', verticalDatum='NAVD88', unit='metres', nativeCellMetres=2,
    inputSha256=hashlib.sha256(a.source.read_bytes()).hexdigest(), sampling='Nearest native cell at a 10 m local grid. Null preserves NoData. No smoothing, depth clamp or vertical offset.',
    localProjection='WGS84 lon/lat; Earth radius 6371008.8 m, cos(origin latitude); X east, Z south. pyproj transforms EPSG:4326 to EPSG:26910 before sampling.')
a.output.write_text(json.dumps(dict(source=source,origin=origin,grid=g,values=values,controls=controls),separators=(',',':'))+'\n')
print(json.dumps(dict(nodes=len(values),valid=sum(v is not None for v in values),min=min(v for v in values if v is not None),max=max(v for v in values if v is not None),controls=controls)))
