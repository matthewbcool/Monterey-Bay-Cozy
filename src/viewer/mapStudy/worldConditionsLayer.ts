import { PerspectiveCamera, Vector2, Vector3 } from 'three';
import registry from '../../data/real-time-sources.json';
import { isWithinMap, type FeedLocation } from '../../data/liveFeeds';
import { createWorldConditionsService, type WorldConditionsSnapshot } from '../../data/worldConditions';

type Position = [number, number];
type Candidate = typeof registry.sources[number];
type Channel = WorldConditionsSnapshot['observedTide'] | WorldConditionsSnapshot['predictedTides'] | WorldConditionsSnapshot['weather'] | WorldConditionsSnapshot['daylight'];
export interface WorldConditionsLayerOptions {
  host: HTMLElement;
  mount: HTMLElement;
  camera: PerspectiveCamera;
  bounds: readonly number[];
  project: (point: Position) => Vector2;
  focus: (locations: FeedLocation[], includeCoverage: boolean) => void;
  draw: () => void;
}

const css = `
.world-conditions-tools{border-top:1px solid #bdd4be35;padding-top:10px}
.world-conditions-tools summary{color:#ffe0ac;font-weight:600;min-height:32px}
.world-conditions-tools p{line-height:1.5;overflow-wrap:anywhere}
.world-conditions-tools a{color:#ffe0ac;overflow-wrap:anywhere}
.world-conditions-tools select{width:100%;max-width:100%;font-size:12px;min-height:44px}
.world-conditions-tools .world-source-label{display:block;margin:8px 0 4px}
.world-conditions-tools button{min-height:44px;border-radius:7px;background:#315151;color:inherit;padding:8px;font-size:12px}
.world-conditions-tools button:disabled{opacity:.6;cursor:default}
.world-conditions-tools button:focus-visible,.world-conditions-tools a:focus-visible{outline:3px solid #ffe0ac;outline-offset:2px}
.world-conditions-actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.world-conditions-status{color:#d5e1d5;font-size:11px}
.world-condition-card{border-top:1px solid #bdd4be35;padding-top:8px;margin-top:8px}
.world-condition-card h3,.world-source-title{font-size:12px;margin:0 0 5px;color:#fff1ce}
.world-condition-card p{margin:5px 0;font-size:11px}
.world-condition-state,.world-source-state{display:inline-block;border:1px solid #edc48a88;border-radius:5px;padding:2px 6px;font-size:10px;color:#ffe0ac}
.world-condition-state[data-state=stale],.world-condition-state[data-state=unavailable]{color:#ffd0b1;border-color:#f5ae8177}
.world-condition-card .world-condition-value{font-size:13px;color:#fff1ce}
.world-condition-card details{margin-top:5px}
.world-condition-card details summary{font-weight:400;min-height:30px;font-size:11px}
.world-condition-source,.world-source-link{display:inline-flex;align-items:center;min-height:44px}
.world-source-position,.world-source-scope,.world-source-limit{font-size:11px;color:#cad8cb}
.world-source-map-label{min-height:44px}
.world-conditions-label-layer{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.world-conditions-map-pin{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;min-height:44px;max-width:220px;border:1px solid #e9ca83;border-radius:9px 9px 9px 0;padding:7px 10px;background:#244a45f5;color:#fff1ce;font-size:12px;line-height:1.3;text-align:left;box-shadow:0 2px 8px #071a2370}
.world-conditions-map-pin[aria-pressed=true]{background:#f0d4a1;color:#17353a}
.world-conditions-map-pin:focus-visible{outline:3px solid white;outline-offset:3px}
.world-conditions-map-pin small{display:block;font-size:10px;margin-top:2px}
.world-conditions-map-pin[hidden],.world-conditions-label-layer[hidden]{display:none}
@media(max-width:700px){.world-conditions-map-pin{max-width:150px;font-size:10px;padding:6px}.world-conditions-tools select{font-size:11px}.world-condition-card .world-condition-value{font-size:12px}}
`;

const channelNames = {
  observedTide: 'Observed tide', predictedTides: 'Predicted tides', weather: 'Weather forecast', daylight: 'Local time & daylight',
} as const;
const activeSources = new Set(['local-sky-clock', 'noaa-monterey-water-level', 'noaa-monterey-tide-predictions', 'nws-monterey-weather']);
const localTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });

function formatTime(value: string | null | undefined) {
  if (!value) return 'Not supplied';
  const time = new Date(value);
  return Number.isFinite(time.getTime()) ? localTime.format(time) : 'Not supplied';
}
function positionLabel(point: number[]) {
  return `${Math.abs(point[1]).toFixed(5)}° ${point[1] < 0 ? 'S' : 'N'}, ${Math.abs(point[0]).toFixed(5)}° ${point[0] < 0 ? 'W' : 'E'}`;
}
function candidateLocation(candidate: Candidate): FeedLocation | null {
  const point = candidate.spatial.coordinates;
  if (!point) return null;
  return {
    id: candidate.id, name: candidate.name, longitude: point[0], latitude: point[1],
    positionKind: 'venue', uncertaintyMeters: 0, basis: candidate.spatial.basis,
    sourceUrls: candidate.sources, gamePlace: candidate.spatial.kind,
  };
}

/** Small source cards and geographic DOM pins. No scene meshes or polling loop. */
export function createWorldConditionsLayer(options: WorldConditionsLayerOptions) {
  const { host, mount, camera, bounds, project, focus, draw } = options;
  const abort = new AbortController(), service = createWorldConditionsService();
  const details = document.createElement('details');
  details.className = 'world-conditions-tools';
  details.innerHTML = `
    <style>${css}</style><summary>Real-world conditions</summary>
    <p>Readings and forecasts for the bay. Each source has its own time and area of coverage.</p>
    <div class="world-conditions-actions"><button type="button" id="world-conditions-refresh">Refresh live data</button></div>
    <p class="world-conditions-status" role="status" aria-live="polite" aria-atomic="true"></p>
    <div class="world-condition-cards"></div>
    <details class="world-source-catalogue"><summary>Source map · ${registry.sources.length} sources</summary>
      <p>Available readings and research candidates are listed separately below. Unresolved locations have no pin.</p>
      <label class="world-source-map-label"><input type="checkbox" id="world-source-pins" checked> Show source locations</label>
      <label class="world-source-label" for="world-source-select">Data source</label><select id="world-source-select"></select>
      <div class="world-conditions-actions"><button type="button" id="world-source-focus">Focus source</button><button type="button" id="world-source-all">All known locations</button></div>
      <h3 class="world-source-title"></h3><span class="world-source-state"></span>
      <p class="world-source-position"></p><p class="world-source-scope"></p><p class="world-source-limit"></p>
      <a class="world-source-link" target="_blank" rel="noopener noreferrer">Open provider source ↗</a>
    </details>`;
  const tools = host.querySelector('.map-tools') ?? host;
  const feeds = tools.querySelector('.map-feed-tools');
  if (feeds) feeds.after(details); else tools.append(details);
  const labels = document.createElement('div');
  labels.className = 'world-conditions-label-layer';
  labels.setAttribute('aria-label', 'Real-world data source locations');
  mount.append(labels);
  const query = <T extends HTMLElement>(selector: string) => details.querySelector<T>(selector)!;
  const select = query<HTMLSelectElement>('#world-source-select');
  for (const source of registry.sources) select.append(new Option(source.name + (activeSources.has(source.id) ? '' : ' · research only'), source.id));
  const cards = new Map<string, HTMLElement>();
  for (const [key, title] of Object.entries(channelNames)) {
    const card = document.createElement('section');
    card.className = 'world-condition-card'; card.dataset.channel = key;
    card.innerHTML = `<h3>${title}</h3><span class="world-condition-state"></span><p class="world-condition-value"></p><p class="world-condition-time"></p><p class="world-condition-note"></p><details><summary>Source &amp; coverage</summary><p class="world-condition-scope"></p><p class="world-condition-fetched"></p><p class="world-condition-quality"></p><a class="world-condition-source" target="_blank" rel="noopener noreferrer">Open source ↗</a></details>`;
    cards.set(key, card); query('.world-condition-cards').append(card);
  }
  let active = true, mapVisible = true, pinsVisible = true, disposed = false;
  let selectedId = 'noaa-monterey-water-level';
  let snapshot = service.getSnapshot();
  const grouped = new Map<string, { point: Position; sources: Candidate[] }>();
  for (const source of registry.sources) {
    const point = source.spatial.coordinates;
    if (!point) continue;
    const key = point.join(',');
    const group = grouped.get(key) ?? { point: [point[0], point[1]] as Position, sources: [] };
    group.sources.push(source); grouped.set(key, group);
  }
  const pins = [...grouped.values()].map(group => {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'world-conditions-map-pin'; button.dataset.worldSources = group.sources.map(s => s.id).join(' ');
    const name = document.createElement('span'), note = document.createElement('small');
    name.textContent = group.sources.some(s => s.id === 'noaa-monterey-water-level') ? 'Monterey tide station'
      : group.sources.some(s => s.id === 'local-sky-clock') ? 'Local weather & daylight' : 'Offshore buoy 46042';
    note.textContent = group.sources.every(s => !activeSources.has(s.id)) ? 'Research only · offshore station'
      : group.sources[0].spatial.kind === 'query-anchor' ? 'Query location · not a weather station' : 'Observed & predicted tides';
    button.append(name, note); labels.append(button);
    button.setAttribute('aria-label', `Inspect ${name.textContent}`);
    button.addEventListener('click', () => {
      choose(group.sources.some(s => s.id === selectedId) ? selectedId : group.sources[0].id);
      open(); query<HTMLDetailsElement>('.world-source-catalogue').open = true;
    }, { signal: abort.signal });
    return { ...group, button };
  });

  function setCard(key: string, channel: Channel, value: string) {
    const card = cards.get(key)!;
    const set = (selector: string, text: string) => { card.querySelector<HTMLElement>(selector)!.textContent = text; };
    const state = card.querySelector<HTMLElement>('.world-condition-state')!;
    state.textContent = key !== 'daylight' && !snapshot.lastRequestedAt ? 'Not loaded' : channel.state === 'computed' ? 'Calculated locally' : channel.state[0].toUpperCase() + channel.state.slice(1);
    state.dataset.state = channel.state;
    set('.world-condition-value', value);
    set('.world-condition-time', (channel.sourceTime ? 'Source time: ' + formatTime(channel.sourceTime) : key === 'predictedTides' ? 'Prediction issue time not supplied' : 'Source time not supplied')
      + (key !== 'daylight' && channel.validFrom && channel.validUntil ? ` · Valid ${formatTime(channel.validFrom)} – ${formatTime(channel.validUntil)}` : ''));
    set('.world-condition-note', channel.reason ?? '');
    set('.world-condition-scope', channel.spatialSupport);
    set('.world-condition-fetched', channel.fetchedAt ? 'Fetched ' + formatTime(channel.fetchedAt) : key === 'daylight' ? 'Calculated using the browser clock · America/Los_Angeles' : 'No successful fetch yet.');
    set('.world-condition-quality', channel.qualityFlags.length ? 'Quality: ' + channel.qualityFlags.join(' · ') : '');
    const link = card.querySelector<HTMLAnchorElement>('.world-condition-source')!;
    link.href = channel.sourceUrl;
    link.textContent = key === 'weather' ? 'National Weather Service ↗' : key === 'daylight' ? 'NOAA daylight calculation ↗' : 'NOAA Monterey 9413450 ↗';
    link.setAttribute('aria-label', `Open source for ${channelNames[key as keyof typeof channelNames]}`);
  }

  function render() {
    snapshot = service.getSnapshot();
    const tide = snapshot.observedTide.value;
    setCard('observedTide', snapshot.observedTide, tide ? `${tide.heightMetres.toFixed(2)} m · ${tide.datum} · ${tide.quality}` : snapshot.lastRequestedAt ? 'Observation unavailable' : 'Refresh to load an observation');
    const prediction = snapshot.predictedTides.value;
    const tideEvent = (label: string, event: { time: string; heightMetres: number } | null) => event ? `${label}: ${event.heightMetres.toFixed(2)} m at ${formatTime(event.time)}` : `${label}: not available`;
    setCard('predictedTides', snapshot.predictedTides, prediction ? tideEvent('Next high', prediction.nextHigh) + ' · ' + tideEvent('Next low', prediction.nextLow) + ' · MLLW' : snapshot.lastRequestedAt ? 'Prediction unavailable' : 'Refresh to load tide predictions');
    const weather = snapshot.weather.value;
    setCard('weather', snapshot.weather, weather ? [weather.summary, weather.temperatureC == null ? null : `${weather.temperatureC.toFixed(1)} °C`, weather.windSpeedMps ? `Wind ${weather.windSpeedMps.map(v => v.toFixed(1)).join('–')} m/s ${weather.windDirection ?? ''}` : null, weather.precipitationPercent == null ? null : `${weather.precipitationPercent}% chance of precipitation`].filter(Boolean).join(' · ') : snapshot.lastRequestedAt ? 'Forecast unavailable' : 'Refresh to load a forecast');
    const daylight = snapshot.daylight.value;
    setCard('daylight', snapshot.daylight, daylight ? `Time when checked: ${formatTime(snapshot.generatedAt)} · Sunrise ${formatTime(daylight.sunrise)} · Sunset ${formatTime(daylight.sunset)}` : 'Local daylight unavailable');
    const ready = [snapshot.observedTide, snapshot.predictedTides, snapshot.weather].filter(c => c.value && c.state !== 'stale').length;
    query<HTMLButtonElement>('#world-conditions-refresh').disabled = service.isRefreshing || !active || !mapVisible;
    query('.world-conditions-status').textContent = service.isRefreshing ? 'Refreshing tide and weather sources…' : snapshot.lastRequestedAt
      ? `${ready} of 3 remote channels available · Checked ${formatTime(snapshot.lastRequestedAt)}. Refresh when needed.`
      : 'Live sources are not loaded. Choose Refresh live data when ready. No automatic refresh.';
  }

  async function refresh() {
    if (disposed || !active || !mapVisible) return;
    const pending = service.refresh(); render();
    try {
      await pending;
      if (!disposed) { render(); draw(); }
    } catch {
      if (!disposed) {
        render(); query('.world-conditions-status').textContent = 'Could not complete this refresh. Review the source details and try again.';
      }
    }
  }
  function open() { details.open = true; }
  function choose(id: string) {
    const source = registry.sources.find(s => s.id === id);
    if (!source) return;
    selectedId = id; select.value = id; host.dataset.worldSource = id;
    query('.world-source-title').textContent = source.name + ' · ' + source.provider;
    query('.world-source-state').textContent = activeSources.has(id) ? id === 'local-sky-clock' ? 'Local time & daylight available' : 'Available on refresh' : 'Research only · not connected';
    const location = candidateLocation(source);
    query<HTMLButtonElement>('#world-source-focus').disabled = !location;
    query('.world-source-position').textContent = source.spatial.coordinates ? positionLabel(source.spatial.coordinates)
      + ' · ' + (source.spatial.kind === 'query-anchor' ? 'Query anchor, not a measurement station.' : 'Published station position.')
      : 'Location or coverage is unresolved; no map pin.';
    query('.world-source-scope').textContent = source.spatial.basis + (location && !isWithinMap(location, bounds) ? ' Outside the downloaded street map. Focus shows the recorded location; surrounding streets are not mapped.' : '');
    query('.world-source-limit').textContent = source.limitations.join(' ') + (id === 'local-sky-clock' ? ' Moon calculations remain a research candidate.' : '');
    const sourceLink = query<HTMLAnchorElement>('.world-source-link');
    sourceLink.href = id === 'local-sky-clock' ? snapshot.daylight.sourceUrl : source.sources[0];
    sourceLink.textContent = id === 'local-sky-clock' ? 'Open daylight calculation source ↗' : 'Open provider source ↗';
    for (const pin of pins) pin.button.setAttribute('aria-pressed', String(pin.sources.some(s => s.id === id)));
    draw();
  }
  function frameAll() {
    const locations = [...grouped.values()].map(group => candidateLocation(group.sources[0])!);
    focus(locations, true);
  }
  function updateLabels() {
    labels.hidden = !active || !mapVisible || !details.open || !pinsVisible;
    if (labels.hidden) return;
    camera.updateMatrixWorld();
    const occupied: { x: number; y: number; width: number }[] = [];
    for (const pin of [...pins].sort((a, b) => Number(b.sources.some(s => s.id === selectedId)) - Number(a.sources.some(s => s.id === selectedId)))) {
      const point = project(pin.point), v = new Vector3(point.x, 16, -point.y).project(camera);
      const x = (v.x * .5 + .5) * mount.clientWidth, y = (-v.y * .5 + .5) * mount.clientHeight;
      const width = Math.min(mount.clientWidth < 700 ? 150 : 220, mount.clientWidth - 12);
      const overlaps = occupied.some(other => Math.abs(other.x - x) < (width + other.width) / 2 + 8 && Math.abs(other.y - y) < 66);
      pin.button.hidden = v.z < -1 || v.z > 1 || x < width / 2 + 5 || x > mount.clientWidth - width / 2 - 5 || y < 70 || y > mount.clientHeight - 35 || overlaps;
      if (pin.button.hidden) continue;
      occupied.push({ x, y, width }); pin.button.style.left = x + 'px'; pin.button.style.top = y + 'px';
    }
  }
  details.addEventListener('toggle', () => {
    if (details.open) render();
    draw();
  }, { signal: abort.signal });
  select.addEventListener('change', () => choose(select.value), { signal: abort.signal });
  query('#world-conditions-refresh').addEventListener('click', () => { void refresh(); }, { signal: abort.signal });
  query('#world-source-pins').addEventListener('change', () => { pinsVisible = query<HTMLInputElement>('#world-source-pins').checked; draw(); }, { signal: abort.signal });
  query('#world-source-focus').addEventListener('click', () => {
    const location = candidateLocation(registry.sources.find(s => s.id === selectedId)!);
    if (location) focus([location], false);
  }, { signal: abort.signal });
  query('#world-source-all').addEventListener('click', frameAll, { signal: abort.signal });
  render(); choose(selectedId); updateLabels();
  return {
    data: registry, choose, frameAll, open, refresh, updateLabels,
    get selectedId() { return selectedId; },
    get snapshot() { return service.getSnapshot(); },
    setActive(value: boolean) { active = value; if (!value) service.cancel(); else if (details.open) render(); updateLabels(); },
    setMapVisible(value: boolean) { mapVisible = value; if (!value) service.cancel(); else if (details.open) render(); updateLabels(); },
    dispose() { disposed = true; abort.abort(); service.dispose(); details.remove(); labels.remove(); delete host.dataset.worldSource; },
  };
}
