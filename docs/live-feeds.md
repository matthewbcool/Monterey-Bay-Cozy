# Potential real-world live feeds

Research snapshot: **October 20, 2026**. The canonical database is [src/data/live-feeds.json](../src/data/live-feeds.json). It is a small versioned data collection, not a backend service. The map consumes it through [liveFeeds.ts](../src/data/liveFeeds.ts).

Open [Map study → Potential live feeds](http://127.0.0.1:5191/?tab=map&feeds). Select a candidate, focus its recorded location, or frame all four recorded locations. Labels suppress overlaps; every candidate remains available in the selector and Focus location. Multiple Aquarium feeds share one venue pin. The map adds DOM markers and no additional 3D draw calls. Markers update on map interaction; the map retains demand rendering.

## First inventory

| Candidate | Physical anchor | Position basis | Integration state |
| --- | --- | --- | --- |
| [Monterey Bay Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/monterey-bay-cam) | Aquarium | Campus / ocean-view decks; exact mount unknown | Listed; permission and stable player unconfirmed |
| [Kelp Forest Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/kelp-forest-cam) | Aquarium | Shared campus anchor; managed exhibit | Listed; permission and stable player unconfirmed |
| [Open Sea Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/open-sea-cam) | Aquarium | Shared campus anchor; managed exhibit | Listed; permission and stable player unconfirmed |
| [Sea Otter Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/sea-otter-cam) | Aquarium | Shared campus anchor; managed exhibit | Listed; permission and stable player unconfirmed |
| [Moon Jelly Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/moon-jelly-cam) | Aquarium | Shared campus anchor; managed exhibit | Listed; permission and stable player unconfirmed |
| [Aviary Cam](https://www.montereybayaquarium.org/cams-videos/live-cams/aviary-cam) | Aquarium | Shared campus anchor; managed exhibit | Listed; permission and stable player unconfirmed |
| [Surfline Monterey Bay](https://www.surfline.com/surf-report/monterey-bay/584204214e65fad6a7709d05) | Monterey waterfront spot area | Provider map-link centre; not a camera mount | Commercial agreement required |
| [Domenico’s Wharf Feed](https://domenicosmonterey.com/live-feed/) | 50 Fishermans Wharf #1 | Venue point from its official map link | Official listing found; functioning player unresolved |
| [Portola Rooftop Webcam](https://www.portolahotel.com/our-hotel/webcam) | Two Portola Plaza | Official hotel-campus map point; exact roof mount unknown | Official HDOnTap iframe recorded; permission and playback unconfirmed |

All coordinates are WGS84 longitude/latitude. Chosen uncertainty is an explicit research estimate, not a provider accuracy claim:

| Location | Latitude | Longitude | Approximate uncertainty |
| --- | ---: | ---: | ---: |
| Aquarium campus | 36.618084 | -121.901918 | 150 m |
| Surfline Monterey Bay area | 36.606635 | -121.891090 | 750 m |
| Domenico’s venue | 36.6045547 | -121.892460 | 75 m |
| Portola campus | 36.6019676 | -121.8943365 | 150 m |

The Aquarium uses the existing OSM-anchored campus point. Surfline’s point comes from its report’s [View Map link](https://www.surfline.com/surf-reports-forecasts-cams-map/buoys/@36.606635,-121.89109,8z). Domenico’s [official address link](https://goo.gl/maps/HhhN4iohJzmoR3Bi7) resolves to its venue point. Portola’s [official site](https://www.portolahotel.com/) provides a Jacks Monterey map point at the same hotel address; it is a campus approximation. Viewing direction, altitude and exact camera mounts remain unknown.

## Map coverage and honesty

The existing downloaded street/building rectangle covers Cannery Row and nearby Pacific Grove. The three waterfront/downtown locations lie south of it. Their pins retain their geographic positions: they are not snapped into the game boundary. **All feed locations** includes the original map rectangle and the candidate positions; areas outside the snapshot have pins but no invented streets, buildings, coastline or terrain. The same local approximate projection is used; these additions extend the local study only a short distance and are not surveying or navigation data.

The six Aquarium cameras are six content candidates at one known venue, not six surveyed positions. Exhibit cameras show managed habitats, not the wild bay. A future connection to the interior layout may identify the exhibit while still keeping camera-mount accuracy separate.

## Access and potential embedding

These are research candidates, not approved integrations. Pages were checked; media playback, in-game iframe operation, bandwidth, resolution, uptime, account requirements and exact live/replay state were not verified. Public page availability or an iframe on the provider’s own site does not establish permission for third-party game use.

Surfline’s [official embedding guidance](https://support.surfline.com/hc/en-us/articles/13883563949979-Can-we-embed-a-forecast-or-a-cam-to-our-website) directs camera streaming inquiries to support@surfline.com for commercial terms. Keep its record link-only pending an agreement. Do not extract gated streams or save transient player signatures.

The Aquarium lists daytime schedules for exhibit cams and includes off-hours recording states. Recheck schedules and make live versus replay obvious if playback is added. Portola’s public HTML includes a stable-looking HDOnTap embed URL, stored as a candidate only; its page also contains obsolete Flash wording. Domenico’s listing lacks an identifiable current player in the fetched HTML.

For a future player: obtain provider terms, record stable official embed instructions and allowed domains, retain attribution/controls, and test target browsers. Load only the player a person explicitly opens; unload it on close or inactive tabs and avoid simultaneous background streams. Prefer a DOM player panel over a video texture unless the provider and technical constraints support that use. The feed inventory initiates no third-party provider requests or player loading. The app’s existing Google Fonts requests are unchanged and are reported separately in browser QA.

## Maintaining the database

Add stable IDs and a source-backed location with an explicit basis/uncertainty, then add feed records referencing that location. Record provider pages, content/environment type, schedule uncertainty, technical evidence, rights/next step, and the date checked. Keep location accuracy, provider listing, successful playback and permission as independent facts. Treat a stale or missing player as unresolved instead of removing its research history.

Run the feed data and map tests, the production build, and the map browser suites when changing this feature. Browser evidence belongs in artifacts/live-feeds/. No provider contact, backend, feed proxy, playback system or publishing action is part of this research addition.


## Other real-world inputs

See [A living Monterey Bay](real-time-world.md) and the separate [conditions source inventory](../src/data/real-time-sources.json) for tides, daylight, weather, swell, currents, ecology and vessel-traffic possibilities. Camera playback and measurements have different access, spatial, timestamp and quality contracts; a video view is not itself a scientific sensor reading.
