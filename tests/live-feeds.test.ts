import test from 'node:test';
import assert from 'node:assert/strict';
import { liveFeedDatabase, liveFeedCandidates, feedLocations, feedsAt, isWithinMap } from '../src/data/liveFeeds';
import map from '../src/data/monterey-map.json';

test('Feed inventory has stable unique IDs, resolvable locations and source provenance', () => {
  assert.equal(liveFeedDatabase.schemaVersion, 1);
  assert.equal(new Set(liveFeedCandidates.map(feed => feed.id)).size, liveFeedCandidates.length);
  assert.equal(new Set(feedLocations.map(location => location.id)).size, feedLocations.length);
  for (const location of feedLocations) {
    assert.ok(Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90);
    assert.ok(Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180);
    assert.ok(location.uncertaintyMeters > 0 && Number.isFinite(location.uncertaintyMeters));
    assert.ok(location.basis.length > 30 && location.sourceUrls.length > 0);
    assert.ok(feedsAt(location.id).length > 0);
    for (const url of location.sourceUrls) assert.equal(new URL(url).protocol, 'https:');
  }
  for (const feed of liveFeedCandidates) {
    assert.ok(feedLocations.some(location => location.id === feed.locationId));
    assert.match(feed.checkedOn, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(feed.evidenceUrls.includes(feed.pageUrl));
    assert.equal(new URL(feed.pageUrl).protocol, 'https:');
    if (feed.embedding.candidatePlayerUrl) assert.equal(new URL(feed.embedding.candidatePlayerUrl).protocol, 'https:');
  }
});

test('Approximate camera sites remain at their geographic positions even outside map coverage', () => {
  const aquarium = feedLocations.find(location => location.id === 'aquarium')!;
  assert.ok(isWithinMap(aquarium, map.bounds));
  for (const id of ['surfline-monterey-bay', 'domenicos-wharf', 'portola-hotel']) {
    const location = feedLocations.find(site => site.id === id)!;
    assert.ok(!isWithinMap(location, map.bounds));
    assert.ok(location.latitude < map.bounds[1], 'South-of-study candidates must not be clamped to its edge');
  }
  assert.ok(isWithinMap({ longitude: map.bounds[0], latitude: map.bounds[1] }, map.bounds));
  assert.ok(!isWithinMap({ longitude: map.bounds[0] - .01, latitude: map.bounds[1] }, map.bounds));
});

test('Candidate status cannot imply approved embedding or verified live playback', () => {
  for (const feed of liveFeedCandidates) {
    assert.equal(feed.availability.playbackVerified, false);
    assert.ok(['permission-unconfirmed', 'commercial-agreement-required'].includes(feed.embedding.status));
    assert.ok(feed.embedding.nextStep.length > 30);
  }
  const surfline = liveFeedCandidates.find(feed => feed.id === 'surfline-monterey-bay')!;
  assert.equal(surfline.embedding.status, 'commercial-agreement-required');
  assert.equal(surfline.embedding.candidatePlayerUrl, null);
  assert.ok(surfline.evidenceUrls.some(url => url.includes('support.surfline.com')));
  const aquariumFeeds = liveFeedCandidates.filter(feed => feed.environment === 'managed-exhibit');
  assert.ok(aquariumFeeds.length > 0);
  assert.ok(aquariumFeeds.every(feed => feed.locationId === 'aquarium'));
});
