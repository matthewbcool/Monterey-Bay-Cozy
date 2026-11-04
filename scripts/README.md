# Authoring and maintenance tools

Run these from the repository root. These tools support authoring and review; the game does not execute them at runtime. [Data provenance](../src/data/README.md), [LOD ownership](../docs/lod.md) and the [test guide](../tests/README.md) explain their surrounding contracts.

| Tool | Inputs and output | Notes |
| --- | --- | --- |
| `check-public-release.mjs` | Tracked release files → privacy/credential-pattern diagnostics | Read-only; `npm run check:release`; stage new files first; reports filenames and categories, never matched values |
| `check-docs.mjs` | Maintained Markdown → local link/heading diagnostics | Read-only; `npm run check:docs`; no network or extra package |
| `asset-audit.ts` | Current prop catalogue/factories → JSON on stdout | `node --import tsx scripts/asset-audit.ts`; constructs and disposes assets; no renderer; counts are not full scene submissions |
| `lod-report.mjs` | `artifacts/lod/browser-metrics.json` plus existing report/gallery → rewrites that review and gallery | Run after `node tests/lod-browser.mjs`; does not generate or verify new measurements |
| `review-water.mjs` | Running shared preview → fixed screenshots and `first-review.json` under `artifacts/water-depth/` | Historical initial-look capture, not the maintained regression suite; prefer `tests/water-depth-browser.mjs` for current behavior |
| `extract-lovers-point-features.py` | Local OSM API XML + actual retrieval date → requested JSON path | Standard-library Python; no download; retains source IDs/tags, clips paths to the bounded gym |
| `extract-bathymetry.py` | Native USGS EPSG:26910 GeoTIFF → 10 m runtime JSON | Offline rasterio/pyproj authoring; preserves NAVD88, NoData and checksum; [provenance](../docs/bathymetry.md) |
| `extract-lovers-point-elevation.py` | Retained USGS float TIFF/export/source metadata → requested JSON path | Requires Pillow for authoring; no network; preserves source datum and metadata |
| `extract-lovers-point-neighbourhood.py` | Cached regional `monterey-map.json` → neighbourhood JSON | Standard-library Python; no network; defaults overwrite the current derived neighbourhood file |

## Check documentation

```sh
npm run check:docs
```

The checker scans root project guides and Markdown below `docs/`, `src/`, `tests/` and `scripts/`. It checks ordinary inline links/images, reference-style links and Markdown heading fragments, including duplicate headings. Links inside fenced code are ignored. It resolves paths from each document; repository-root paths start at the checkout root.

It verifies linked files/directories exist, including links into `artifacts/` and `public/`, but does not recursively audit historical artifact Markdown. It skips external schemes and does not fetch URLs, parse HTML anchors, validate reference facts, or inspect screenshots. Use ordinary Markdown links to keep maintained guides checkable. Missing files/heading fragments return a nonzero exit status.

## Regenerate geography into a review path first

Preserve downloaded references and their attribution; do not edit them to make generated geometry match a desired result. Extraction has no network step, and a successful run cannot prove source coverage or survey accuracy. For example:

```sh
python3 scripts/extract-lovers-point-elevation.py --output /tmp/lovers-point-elevation.json
python3 scripts/extract-lovers-point-neighbourhood.py --output /tmp/lovers-point-neighbourhood.json
python3 scripts/extract-lovers-point-features.py /path/to/downloaded-map.xml --downloaded YYYY-MM-DD --output /tmp/lovers-point-features.json
```

The XML path and retrieval date must refer to a real retained download; the feature extractor does not recreate missing raw evidence. The elevation extractor uses the retained files in `artifacts/testing-gym-elevation/` unless `--evidence` selects another directory. The source dates/origin in extractors are specific to these snapshots; inspect metadata assumptions before reusing them for another place/date. Do not relabel an old raster as a new download.

Compare the new output with the cached source, inspect source IDs/dimensions/datum and run relevant geography tests before replacing `src/data/` files. Authored building heights, water level, shoreline joins and plant placements remain separate from downloaded measurements. No script here currently rebuilds the original regional OSM snapshot or the hand-curated base `lovers-point-gym.json`; retain their documented source records rather than claiming a one-command full reconstruction.

## Refresh reports deliberately

Browser suites and report generators can overwrite dated evidence. Use a suite's supported output override when available, coordinate shared-file writes and capture the tested source revision. A report generator only formats the input metrics; it is not a validation run. Refer to [test outputs and fixture rules](../tests/README.md#urls-output-folders-and-review-evidence).

## Park tree inventory

`python3 scripts/import-park-trees.py /absolute/path/to/public-response.json` validates an untruncated ArcGIS response and writes `src/data/lovers-point-trees.json`. It projects the original WGS84 points into the shared metre frame and retains only trees within the cached OSM park ring. It makes no network requests and never moves records to fit scenery. [Provenance and refresh limitations](../docs/coastal-trees.md).

`extract-waterfront.py` reads retained OSM XML, USGS TIFF/export metadata and the regional building snapshot. It writes a requested derived JSON path without network access. See [waterfront regeneration](../docs/waterfront-extension.md#budgets-and-maintenance) for the invocation and source limits.

`extract-waterfront-amenities.py` uses Python standard libraries to extract candidate trail facilities from retained OSM XML. It preserves node IDs, original tags and geographic coordinates; it does not fetch or claim refreshed data. See [invocation and provenance](../docs/coastal-life.md).


## Full Monterey Bay cache

`extract-monterey-bay.py --evidence artifacts/monterey-bay-region/sources --output /tmp/monterey-bay-region.json` reads retained raster, vector and request metadata, validates source completeness and no-data values, and invokes the companion `extract-monterey-bay.ts` for clipping/projection. Requires Pillow and existing Node/tsx/polygon-clipping; `--node` selects an explicit runtime. It makes no network requests. [Source ownership and regeneration](../docs/monterey-bay-region.md).

## Caledonia neighborhood cache

`python3 scripts/extract-caledonia.py` reads retained OSM XML and USGS TIFF/export metadata under `artifacts/caledonia-park/`, excludes building IDs already owned by the waterfront and writes `src/data/caledonia-park.json`. It requires Pillow and makes no provider requests. [Source and crop limitations](../docs/caledonia-park.md).

`python3 scripts/extract-caledonia-meals.py --output /tmp/caledonia-meals-site.json` rebuilds the smaller northern community-center annex from retained primary OSM JSON/XML and USGS TIFF/export metadata in `artifacts/caledonia-refinement/sources/`. Requires Pillow; no network calls. Omit `--output` to update the canonical cache.

## NOAA fish ecology

`python3 scripts/extract-ecology.py` validates retained NOAA CSV hashes/joins and rebuilds the runtime snapshot offline. `--output /tmp/monterey-ecology.json` writes a comparison; `--fetch` explicitly refreshes the three public responses. It uses Python standard libraries. [Coverage, methods, API and limits](../docs/fish-ecology.md).
