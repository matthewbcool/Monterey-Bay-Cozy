"""Rebuild the bounded NOAA ecology cache. Offline by default; --fetch refreshes evidence."""
import argparse, csv, datetime, hashlib, io, json, math, urllib.parse, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BOUNDS = [-122.12, 36.55, -121.7, 37.03]
TAXA = {'Sebastes mystinus': 'blue-rockfish', 'Ophiodon elongatus': 'lingcod', 'Sardinops sagax': 'pacific-sardine'}
BASE = 'https://coastwatch.pfeg.noaa.gov/erddap/'
FILTER = '&latitude>=36.55&latitude<=37.03&longitude>=-122.12&longitude<=-121.7&time>=2015-01-01T00:00:00Z&time<=2025-12-31T23:59:59Z'
def urls():
    values = {'metadata': BASE+'info/FED_Rockfish_Catch/index.csv', 'hauls': BASE+'tabledap/FED_Rockfish_Catch.csv?time,latitude,longitude,cruise,haul_no'+FILTER+'&distinct()', 'catches': BASE+'tabledap/FED_Rockfish_Catch.csv?time,latitude,longitude,cruise,haul_no,station,catch,species_code,common_name,sci_name,maturity'+FILTER+'&sci_name=~"(Sebastes mystinus|Ophiodon elongatus|Sardinops sagax)"'}
    return {k: urllib.parse.quote(v, safe=':/?&=,()') for k,v in values.items()}
def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--fetch', action='store_true');p.add_argument('--sources', type=Path, default=ROOT/'artifacts/ecology/sources');p.add_argument('--output', type=Path, default=ROOT/'src/data/ecology/monterey-ecology.json');a=p.parse_args()
    if a.fetch:
        downloaded={k:urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Monterey-Bay-Cozy ecology research'}),timeout=60).read() for k,u in urls().items()}
        a.sources.mkdir(parents=True,exist_ok=True);manifest={}
        for k,raw in downloaded.items():
            (a.sources/(k+'.csv')).write_bytes(raw);manifest[k]={'url':urls()[k], 'retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sha256':hashlib.sha256(raw).hexdigest(), 'bytes':len(raw)}
        (a.sources/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    manifest=json.loads((a.sources/'manifest.json').read_text())
    raw={}
    for k in ('hauls','catches','metadata'):
        b=(a.sources/(k+'.csv')).read_bytes()
        if hashlib.sha256(b).hexdigest()!=manifest[k]['sha256']:raise ValueError('Source checksum mismatch: '+k)
        if urllib.parse.unquote(manifest[k]['url'])!=urllib.parse.unquote(urls()[k]):raise ValueError('Unexpected source query: '+k)
        raw[k]=b.decode()
    def rows(k):
        reader=csv.DictReader(io.StringIO(raw[k]));next(reader) # ERDDAP units row
        return list(reader)
    hauls=[];by_id={}
    for r in rows('hauls'):
        lon,lat=float(r['longitude']),float(r['latitude']);ident=r['cruise']+':'+r['haul_no']
        if not (BOUNDS[0]<=lon<=BOUNDS[2] and BOUNDS[1]<=lat<=BOUNDS[3]):raise ValueError('Out-of-bounds haul')
        if ident in by_id:raise ValueError('Duplicate haul')
        datetime.datetime.fromisoformat(r['time'].replace('Z','+00:00'))
        by_id[ident]=len(hauls);hauls.append({'id':ident,'time':r['time'],'longitude':lon,'latitude':lat})
    records=[];seen=set()
    for r in rows('catches'):
        haul=by_id[r['cruise']+':'+r['haul_no']];species=TAXA[r['sci_name']];stage=r['maturity'];value=int(r['catch'])
        if stage not in ('Y','A','U') or value<0 or value==2147483647:raise ValueError('Invalid stage/catch')
        if (r['time'],float(r['longitude']),float(r['latitude'])) != (hauls[haul]['time'],hauls[haul]['longitude'],hauls[haul]['latitude']):raise ValueError('Haul/catch join mismatch')
        key=(haul,species,stage)
        if key in seen:raise ValueError('Duplicate observation')
        seen.add(key);records.append({'haul':haul,'speciesId':species,'lifeStage':stage,'count':value})
    meta=list(csv.DictReader(io.StringIO(raw['metadata'])))
    attrs={r['Attribute Name']:r['Value'] for r in meta if r['Variable Name']=='NC_GLOBAL'}
    result={'schemaVersion':1,'bounds':BOUNDS,'cellSizeMeters':2000,'window':{'start':'2015-01-01T00:00:00Z','end':'2025-12-31T23:59:59Z'},'source':{'id':'noaa-rreas','title':attrs['title'],'institution':attrs['institution'],'metadataUrl':BASE+'info/FED_Rockfish_Catch/index.html','timeCoverageEnd':attrs['time_coverage_end'],'license':attrs['license'],'files':manifest,'method':'Midwater trawl; net-in coordinates. Hauls are represented catch-table hauls, not a complete effort log.','limitations':['Counts are specimens caught, not population counts or density. No tow effort or catchability correction is included.','Y is young-of-year/pelagic; A is older-than-YOY/post-settlement, not reproductive maturity. U is unknown.','Zero detection is assigned only for explicit zero rows in the selected species, stage and date filters.','Locations are trawl net-in points aggregated to authored 2 km cells, not fish GPS positions or NOAA DisMAP predictions.','Sampling months do not establish year-round seasonality. Adult blue rockfish habitat requires additional nearshore survey evidence.']},'hauls':hauls,'observations':records}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n')
    print(json.dumps({'hauls':len(hauls),'observations':len(records),'positiveRows':sum(r['count']>0 for r in records),'bytes':a.output.stat().st_size,'output':str(a.output)}))
if __name__=='__main__':main()
