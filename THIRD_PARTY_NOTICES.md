# Third-party notices and data rights

The root [MIT License](LICENSE) covers the project's original code, procedural asset definitions and project-authored documentation. Original asset output may be used under the same terms, subject to any separately identified data or third-party rights. AI tools including Codex and Claude assisted development; their use does not change third-party licensing or grant rights to reference imagery. A location or species reference is not an endorsement by the institution concerned.

## OpenStreetMap

© OpenStreetMap contributors. OpenStreetMap data and adapted databases are available under the **Open Database License 1.0 (ODbL-1.0)**, not MIT. See [copyright and attribution](https://www.openstreetmap.org/copyright) and the [ODbL license text](https://opendatacommons.org/licenses/odbl/1-0/).

This includes retained `.osm` downloads and OSM-derived geography in `src/data/`: the Monterey map, Lovers Point mapped features/neighborhood, waterfront, Caledonia park/Meals site, waterfront amenities, museum/Jewell site references and OSM-derived components of the regional cache. Other provider data combined with a cache retains its own provenance and terms. Preserve feature IDs, source/attribution/license fields and visible OSM attribution when using or distributing those data. The MIT code license does not replace database obligations. Related source and limits are documented in the feature guides and the [data guide](src/data/README.md).

## Public environmental and geographic data

Selected retained USGS elevation/bathymetry rasters and metadata, NOAA survey/tide/bathymetry data, NWS weather information, and public regional shoreline/highway/place datasets retain the provenance and provider terms recorded in their source metadata and feature guides. U.S. federal works are generally public domain in the United States, but provider-hosted content may include separately credited material; do not assume every public dataset or photograph has identical rights. No MIT ownership claim is made over downloaded provider data. Preserve source citations, dates, datum/accuracy limits and any provider-specific attribution.

- [USGS copyright policy](https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits)
- [NOAA disclaimer and copyright information](https://www.noaa.gov/disclaimer)
- [Retained provider-file manifest](artifacts/public-data-manifest.json)
- [Bathymetry](docs/bathymetry.md), [regional geography](docs/monterey-bay-region.md), [fish ecology](docs/fish-ecology.md), [weather](docs/weather-sources.md)

## SunCalc adaptation

`src/data/skyAstronomy.ts` adapts SunCalc 1.9.0 formulas under **BSD-2-Clause**. Its full original copyright, conditions and disclaimer are retained in that file and in [the weather guide](docs/weather-sources.md#third-party-astronomy-notice). Keep those notices when redistributing source or binaries. This exception is not relicensed under MIT.

## JavaScript dependencies

Installed dependencies are not vendored here. Preserve their licenses when distributing a compiled bundle or vendor copy. The pinned dependency manifest is `package-lock.json`; each installed package includes its own applicable terms. Current direct packages include Three.js and meshoptimizer (MIT), polygon-clipping (MIT), and development tools TypeScript, Vite, Playwright, tsx, Node/Three type declarations and vitexec. The generated [dependency notice inventory](DEPENDENCY_LICENSES.md) includes installed transitive packages and their declared license identifiers. Do not treat the root MIT license as a replacement for these notices.

## Reference images and brands

Downloaded/user-supplied photographs, aquarium imagery, third-party game screenshots, comparative screenshots, private recordings and historical authoring media are excluded from this public source snapshot. Source-page links and written observations remain for provenance. Reacquiring a reference for study does not establish redistribution rights. Contribute your own imagery or material with verified compatible rights and attribution; do not add unlicensed reference copies to the public tree.

Trademarks, institutional names, recognizable third-party artwork and logos remain with their respective owners. The project does not grant rights to them. Monterey Bay Tech's charter is referenced to describe project alignment; museum, aquarium and city names identify places, not partnerships or official navigation/accessibility guarantees.
