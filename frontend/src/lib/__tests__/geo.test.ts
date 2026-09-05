/**
 * Which distance a given reader is shown.
 *
 * Two server-computed distances can arrive on one donation and they answer
 * different questions (D-33). Both are plain nullable numbers, so putting the
 * wrong one on screen is a change `tsc` cannot see.
 */

import { describe, expect, it } from 'vitest';
import { displayDistanceKm, formatDistanceKm, isValidCoords } from '../geo';
import { apiMatch, donation } from '../../test/fixtures';

describe('displayDistanceKm', () => {
  it("prefers the reader's own distance over the matched kitchen's", () => {
    // An NGO looking at an open listing is asking "how far is this from us",
    // which only viewerMatch answers.
    const listing = donation({
      distanceKm: 12.4,
      viewerMatch: apiMatch({ distanceKm: 3.1 }),
    });

    expect(displayDistanceKm(listing)).toBe(3.1);
  });

  it('falls back to the matched distance when the reader has no offer', () => {
    expect(displayDistanceKm(donation({ distanceKm: 12.4, viewerMatch: null }))).toBe(12.4);
  });

  it('falls through a match that carries no distance of its own', () => {
    // `/matches` withholds the distance on a row about somebody else's kitchen
    // (D-45). A viewerMatch is always about the reader's own, so this should
    // not arise there — but the field is nullable now, and `??` has to skip a
    // null rather than print it.
    const listing = donation({
      distanceKm: 12.4,
      viewerMatch: apiMatch({ distanceKm: null }),
    });

    expect(displayDistanceKm(listing)).toBe(12.4);
  });

  it('reports an unknown distance as unknown rather than as zero', () => {
    const open = donation({ distanceKm: null, viewerMatch: null });

    expect(displayDistanceKm(open)).toBeNull();
    expect(formatDistanceKm(open)).toBe('Distance unavailable');
  });
});

describe('isValidCoords', () => {
  it('accepts a real pin and rejects one the API would refuse', () => {
    expect(isValidCoords(30.354, 76.363)).toBe(true);
    expect(isValidCoords(91, 0)).toBe(false);
    expect(isValidCoords(0, 181)).toBe(false);
    expect(isValidCoords(Number.NaN, 0)).toBe(false);
  });
});
