/**
 * Coordinates, and the one distance figure the interface is allowed to show.
 *
 * The matcher scores recipients by straight-line distance, so a donation has to
 * carry a latitude and longitude — a street address alone cannot be ranked. The
 * form asks for a pin, and starts it somewhere sensible rather than at (0, 0)
 * in the Gulf of Guinea.
 *
 * Nothing here measures a journey. Every kilometre the UI prints comes from the
 * server's `matching.haversine_km`: great-circle distance between two pins,
 * never a road, driving or route distance, and there is no travel-time figure
 * on the wire at all.
 */

import type { Donation } from '../types';

/** Thapar University, Patiala — where the pilot deployment lives. */
export const DEFAULT_COORDS = { latitude: 30.354, longitude: 76.363 };

export interface Coords {
  latitude: number;
  longitude: number;
}

/**
 * Ask the browser where we are. Resolves to `null` rather than rejecting when
 * permission is refused or the device cannot say — a missing pin falls back to
 * the default, which is not an error worth interrupting anyone over.
 */
export function requestCoords(timeoutMs = 8000): Promise<Coords | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null);
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/** True when a pair of values is inside the range the API will accept. */
export function isValidCoords(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  );
}

/**
 * The straight-line distance to show *this* reader for a donation, or `null`.
 *
 * Two server-computed distances can arrive on a donation, and which one answers
 * the reader's question depends on who is reading:
 *
 * - `distanceKm` — donor pin to the **matched** kitchen. Computed in
 *   `serialize.donation_out()` only once a recipient is bound, so an open
 *   donation never carries one.
 * - `viewerMatch.distanceKm` — donor pin to the **calling** organisation's own
 *   kitchen, present while that kitchen can still act on the donation (D-30).
 *   A match about somebody *else's* kitchen carries no distance at all (D-45),
 *   so this is null-checked like the other one rather than assumed present.
 *
 * An NGO looking at an open listing is asking "how far is this from us", which
 * only the second answers — so it wins where both exist. Neither is computed in
 * the browser and there is no third fallback: an unknown distance is reported as
 * unknown rather than filled in with a plausible number.
 */
export function displayDistanceKm(donation: Donation): number | null {
  return donation.viewerMatch?.distanceKm ?? donation.distanceKm ?? null;
}

/** `displayDistanceKm` rendered, with an honest blank when there is none. */
export function formatDistanceKm(donation: Donation, fallback = 'Distance unavailable'): string {
  const km = displayDistanceKm(donation);
  return km === null ? fallback : `${km} km`;
}

/** One wording for what the number means, so no two screens explain it differently. */
export const DISTANCE_HINT =
  'Straight-line distance between the two pinned locations — not a road or driving distance';
