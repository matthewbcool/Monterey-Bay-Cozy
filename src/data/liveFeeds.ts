import source from './live-feeds.json';

export interface FeedLocation {
  id: string;
  name: string;
  longitude: number;
  latitude: number;
  positionKind: 'venue' | 'area-estimate';
  uncertaintyMeters: number;
  basis: string;
  sourceUrls: string[];
  gamePlace: string;
}
export interface LiveFeedCandidate {
  id: string;
  name: string;
  locationId: string;
  provider: string;
  pageUrl: string;
  environment: 'wild-outdoor' | 'managed-exhibit';
  subject: string;
  availability: {
    status: 'provider-listing-confirmed' | 'listing-only-player-unresolved' | 'provider-player-found';
    schedule: string;
    playbackVerified: boolean;
    notes: string;
  };
  embedding: {
    status: 'permission-unconfirmed' | 'commercial-agreement-required';
    candidatePlayerUrl: string | null;
    technicalStatus: string;
    nextStep: string;
  };
  evidenceUrls: string[];
  checkedOn: string;
}
export interface LiveFeedDatabase {
  schemaVersion: number;
  researchedOn: string;
  timezone: string;
  purpose: string;
  coordinateReference: string;
  locations: FeedLocation[];
  feeds: LiveFeedCandidate[];
}

/** Versioned research data, loaded only with the map. No stream requests or player initialization. */
export const liveFeedDatabase = source as LiveFeedDatabase;
export const feedLocations = liveFeedDatabase.locations;
export const liveFeedCandidates = liveFeedDatabase.feeds;

export function isWithinMap(location: Pick<FeedLocation, 'longitude' | 'latitude'>, bounds: readonly number[]) {
  const [west, south, east, north] = bounds;
  return location.longitude >= west && location.longitude <= east && location.latitude >= south && location.latitude <= north;
}

export function feedsAt(locationId: string) {
  return liveFeedCandidates.filter(feed => feed.locationId === locationId);
}
