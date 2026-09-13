/**
 * Which distance a given reader is shown.
 *
 * Two server-computed distances can arrive on one donation and they answer
 * different questions (D-33). Both are plain nullable numbers, so putting the
 * wrong one on screen is a change `tsc` cannot see.
 */

import { describe, expect, it } from 'vitest';
import {
  displayDistanceKm, displayDonorLabel, displayPickupLocation, formatDistanceKm,
  isPickupCoarse, isValidCoords,
} from '../geo';
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

/**
 * What a courier is shown about a pickup they have not claimed.
 *
 * The server sends the exact address *or* the coarse cell, never both (D-57),
 * and the withheld donor fields arrive as empty strings through `toDonation`.
 * Reading either one directly would put a blank line on screen, which is the
 * mistake these three helpers exist to make impossible.
 */
describe('pre-claim pickup display', () => {
  const unclaimed = donation({
    location: null,
    latitude: null,
    longitude: null,
    pickupArea: 'Approx. 30.35N, 76.36E',
    donorName: null,
    donorOrganization: null,
    donorId: null,
  });

  const claimed = donation({
    location: '42 Rajindra Road, Model Town, Patiala',
    pickupArea: null,
    donorName: 'Asha Menon',
    donorOrganization: 'Green Leaf Cafe',
  });

  it('shows the coarse area when the address was withheld', () => {
    expect(displayPickupLocation(unclaimed)).toBe('Approx. 30.35N, 76.36E');
    expect(isPickupCoarse(unclaimed)).toBe(true);
  });

  it('shows the real address once the pickup belongs to the reader', () => {
    expect(displayPickupLocation(claimed)).toBe('42 Rajindra Road, Model Town, Patiala');
    expect(isPickupCoarse(claimed)).toBe(false);
  });

  it('never renders a withheld donor as a blank', () => {
    expect(displayDonorLabel(unclaimed)).toBe('Shown once claimed');
    expect(displayDonorLabel(unclaimed, 'an unclaimed pickup')).toBe('an unclaimed pickup');
    expect(displayDonorLabel(claimed)).toBe('Green Leaf Cafe');
  });

  it('says so honestly when neither the address nor an area arrived', () => {
    const neither = donation({ location: null, pickupArea: null });

    expect(displayPickupLocation(neither)).toBe('Location unavailable');
    // Not coarse: there is no area standing in for anything.
    expect(isPickupCoarse(neither)).toBe(false);
  });
});
