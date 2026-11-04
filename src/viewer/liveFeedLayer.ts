import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import { feedLocations, feedsAt, isWithinMap, liveFeedCandidates, liveFeedDatabase, type FeedLocation } from '../data/liveFeeds';

type Position = [number, number];
interface MapFeedOptions {
  host: HTMLElement;
  mount: HTMLElement;
  camera: PerspectiveCamera;
  bounds: readonly number[];
  project: (point: Position) => Vector2;
  focus: (locations: FeedLocation[], includeCoverage: boolean) => void;
  draw: () => void;
}

const css = [
  '.map-feed-tools{border-top:1px solid #bdd4be35;padding-top:10px}',
  '.map-feed-tools summary{font-weight:600;color:#ffe0ac;min-height:30px}',
  '.map-feed-tools select{width:100%;max-width:100%;font-size:12px}',
  '.map-feed-tools .feed-select-label{display:block;margin-bottom:5px}',
  '.map-feed-tools p{line-height:1.5;overflow-wrap:anywhere}',
  '.map-feed-tools .feed-title{font-size:14px;margin-bottom:5px}',
  '.feed-badge{display:inline-block;border:1px solid #edc48a88;border-radius:5px;padding:3px 6px;color:#ffe0ac;font-size:11px}',
  '.map-feed-tools .feed-actions{display:flex;gap:5px;flex-wrap:wrap;margin:9px 0}',
  '.feed-actions button{min-height:44px;padding:8px;border-radius:6px;background:#315151;color:inherit;font-size:12px}',
  '.map-feed-tools a{color:#ffe0ac}',
  '.feed-source-link{display:inline-flex;align-items:center;min-height:44px}',
  '.feed-precision,.feed-coverage{font-size:11px;color:#cad8cb}',
  '.feed-label-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
  '.feed-map-pin{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;min-height:44px;max-width:225px;border:1px solid #ffe0ac;border-radius:9px 9px 9px 0;padding:7px 10px;background:#203e40f5;color:#fff1ce;font-size:12px;line-height:1.3;text-align:left;box-shadow:0 2px 8px #071a2370}',
  '.feed-map-pin[aria-pressed=true]{background:#f0d4a1;color:#17353a;border-color:#fff1ce}',
  '.feed-map-pin:focus-visible{outline:3px solid white;outline-offset:3px}',
  '.feed-map-pin[hidden]{display:none}',
  '.feed-map-pin small{display:block;font-size:10px;opacity:.85}',
  '.feed-view-note{display:none;position:absolute;bottom:72px;left:340px;right:18px;margin:0;text-align:right;color:#e5ddbd;font-size:11px;line-height:1.5;pointer-events:none}',
  '[data-map-view=feeds] .feed-view-note{display:block}',
  '.aquarium-open .feed-label-layer{display:none}',
  '@media(max-width:700px){.feed-map-pin{max-width:145px;font-size:10px;padding:6px}.map-feed-tools select{font-size:11px}.map-feed-tools .feed-title{font-size:12px}.feed-view-note{left:12px;right:12px;bottom:105px;text-align:left}}',
].join('\n');

/** DOM pins add no model draw calls and update only when the map draws. */
export function createLiveFeedLayer(options: MapFeedOptions) {
  const { host, mount, camera, bounds, project, focus, draw } = options;
  const abort = new AbortController();
  const details = document.createElement('details');
  details.className = 'map-feed-tools';
  details.innerHTML = [
    '<style>' + css + '</style>',
    '<summary>Potential live feeds · ' + liveFeedCandidates.length + '</summary>',
    '<p class="feed-intro">Real-world windows to explore. These are candidates; playback and embedding permission are not confirmed.</p>',
    '<label><input id="map-feeds-visible" type="checkbox" checked> Show feed locations</label>',
    '<label class="feed-select-label" for="map-feed-select">Candidate feed</label><select id="map-feed-select"></select>',
    '<div class="feed-actions"><button type="button" id="map-feed-focus">Focus location</button><button type="button" id="map-feed-all">All feed locations</button></div>',
    '<h2 class="feed-title"></h2><span class="feed-badge"></span><p class="feed-subject"></p>',
    '<p class="feed-coverage"></p><p class="feed-precision"></p>',
    '<a class="feed-source-link" target="_blank" rel="noopener noreferrer">Open provider page ↗</a>',
    '<details><summary>Schedule, evidence &amp; next step</summary><p class="feed-schedule"></p><p class="feed-availability"></p><p class="feed-next-step"></p><p class="feed-position-basis"></p><ul class="feed-evidence"></ul><p class="feed-date"></p></details>',
  ].join('');
  host.querySelector('.map-buttons')!.after(details);
  const labels = document.createElement('div');
  labels.className = 'feed-label-layer';
  labels.setAttribute('aria-label', 'Potential live feed locations');
  const coverageNote = document.createElement('p');
  coverageNote.className = 'feed-view-note';
  coverageNote.textContent = 'North ↑ · Approximate geographic pins. Detailed streets cover the local Monterey–Pacific Grove study; regional terrain extends around the bay.';
  labels.append(coverageNote);
  mount.append(labels);
  const query = <T extends HTMLElement>(selector: string) => details.querySelector<T>(selector)!;
  const select = query<HTMLSelectElement>('#map-feed-select');
  for (const location of feedLocations) {
    const group = document.createElement('optgroup');
    group.label = location.name + (isWithinMap(location, bounds) ? '' : ' · outside street snapshot');
    for (const feed of feedsAt(location.id)) group.append(new Option(feed.name, feed.id));
    select.append(group);
  }
  let selectedId = liveFeedCandidates[0].id;
  let mapVisible = true;
  let markersVisible = true;
  const pins = feedLocations.map(location => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'feed-map-pin';
    button.dataset.feedLocation = location.id;
    const name = document.createElement('span');
    name.textContent = location.name;
    const precision = document.createElement('small');
    precision.textContent = feedsAt(location.id).length + ' candidate' + (feedsAt(location.id).length === 1 ? '' : 's') + ' · approximate location';
    button.append(name, precision);
    button.setAttribute('aria-label', 'Inspect live feed candidates at ' + location.name);
    button.addEventListener('click', () => {
      const current = liveFeedCandidates.find(feed => feed.id === selectedId)!;
      choose(current.locationId === location.id ? current.id : feedsAt(location.id)[0].id);
      details.open = true;
    }, { signal: abort.signal });
    labels.append(button);
    return { location, button };
  });

  function choose(id: string) {
    const feed = liveFeedCandidates.find(candidate => candidate.id === id);
    if (!feed) return;
    const location = feedLocations.find(candidate => candidate.id === feed.locationId)!;
    selectedId = id;
    select.value = id;
    host.dataset.liveFeedId = id;
    host.dataset.liveFeedLocation = location.id;
    query('.feed-title').textContent = feed.name;
    query('.feed-badge').textContent = feed.embedding.status === 'commercial-agreement-required' ? 'Provider agreement required' : 'Embedding permission unconfirmed';
    query('.feed-subject').textContent = feed.subject + (feed.environment === 'managed-exhibit' ? ' This is an exhibit, not a wild-camera location.' : '');
    query('.feed-coverage').textContent = isWithinMap(location, bounds) ? 'Within the downloaded street map.' : 'Outside the downloaded street map. Focus or All feed locations shows its actual recorded position; surrounding streets are not mapped.';
    query('.feed-precision').textContent = location.latitude.toFixed(5) + '° N, ' + Math.abs(location.longitude).toFixed(5) + '° W · ' + (location.positionKind === 'venue' ? 'Venue anchor' : 'Area estimate') + ' · approximately ' + location.uncertaintyMeters + ' m uncertainty; not an exact camera mount.';
    const link = query<HTMLAnchorElement>('.feed-source-link');
    link.href = feed.pageUrl;
    link.setAttribute('aria-label', 'Open ' + feed.name + ' on the provider website');
    query('.feed-schedule').textContent = feed.availability.schedule;
    query('.feed-availability').textContent = feed.availability.notes;
    query('.feed-next-step').textContent = feed.embedding.nextStep;
    query('.feed-position-basis').textContent = location.basis;
    query('.feed-date').textContent = 'Sources checked ' + feed.checkedOn + '. Live playback has not been verified.';
    const evidence = query('.feed-evidence');
    evidence.replaceChildren();
    for (const url of new Set([...feed.evidenceUrls, ...location.sourceUrls])) {
      const row = document.createElement('li'), anchor = document.createElement('a');
      anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.textContent = new URL(url).hostname.replace('www.', '') + ' · source';
      row.append(anchor); evidence.append(row);
    }
    for (const pin of pins) pin.button.setAttribute('aria-pressed', String(pin.location.id === location.id));
    draw();
  }

  function updateLabels() {
    labels.hidden = !mapVisible || !markersVisible;
    if (labels.hidden) return;
    camera.updateMatrixWorld();
    const occupied: { x: number; y: number; width: number }[] = [];
    const current = liveFeedCandidates.find(feed => feed.id === selectedId)!;
    for (const { location, button } of [...pins].sort((a, b) => Number(b.location.id === current.locationId) - Number(a.location.id === current.locationId))) {
      const projected = project([location.longitude, location.latitude]);
      const v = new Vector3(projected.x, 16, -projected.y).project(camera);
      const x = (v.x * .5 + .5) * mount.clientWidth, y = (-v.y * .5 + .5) * mount.clientHeight;
      const width = Math.min(innerWidth < 700 ? 145 : 225, location.name.length * 6.3 + 22);
      const overlap = occupied.some(other => Math.abs(other.x - x) < (other.width + width) / 2 + 8 && Math.abs(other.y - y) < 58);
      button.hidden = v.z < -1 || v.z > 1 || x < width / 2 + 5 || x > mount.clientWidth - width / 2 - 5 || y < 52 || y > mount.clientHeight - 35 || overlap;
      if (button.hidden) continue;
      occupied.push({ x, y, width });
      button.style.left = x + 'px'; button.style.top = y + 'px';
    }
  }

  select.addEventListener('change', () => choose(select.value), { signal: abort.signal });
  query('#map-feeds-visible').addEventListener('change', () => {
    markersVisible = query<HTMLInputElement>('#map-feeds-visible').checked; draw();
  }, { signal: abort.signal });
  query('#map-feed-focus').addEventListener('click', () => {
    const feed = liveFeedCandidates.find(candidate => candidate.id === selectedId)!;
    focus([feedLocations.find(location => location.id === feed.locationId)!], false);
  }, { signal: abort.signal });
  function frameAll() { focus(feedLocations, true); }
  query('#map-feed-all').addEventListener('click', frameAll, { signal: abort.signal });
  choose(selectedId);

  return {
    data: liveFeedDatabase,
    get selectedId() { return selectedId; },
    choose, frameAll, updateLabels,
    open() { details.open = true; },
    setMapVisible(value: boolean) { mapVisible = value; labels.hidden = !value || !markersVisible; },
    dispose() { abort.abort(); details.remove(); labels.remove(); delete host.dataset.liveFeedId; delete host.dataset.liveFeedLocation; },
  };
}
