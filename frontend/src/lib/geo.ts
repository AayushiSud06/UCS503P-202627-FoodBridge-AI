/**
 * Coordinates.
 *
 * The matcher scores recipients by real distance, so a donation has to carry a
 * latitude and longitude — a street address alone cannot be ranked. The form
 * asks for a pin, and starts it somewhere sensible rather than at (0, 0) in
 * the Gulf of Guinea.
 */

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
