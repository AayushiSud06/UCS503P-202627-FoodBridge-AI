/**
 * The wire → app translation seam.
 *
 * These are the conversions forty components depend on without knowing it, so
 * a regression here is invisible to `tsc`: every field involved is a string or
 * a number on both sides, and swapping two of them still compiles.
 */

import { describe, expect, it } from 'vitest';
import { toActivity, toDonation, toMatchAnalysis, toUser } from '../adapters';
import { apiDonation, apiEvent, apiMatch, apiUser } from '../../test/fixtures';

describe('toUser', () => {
  it('resolves entityId through the profile row the account acts as', () => {
    // This is the id donations are filtered by, and the precedence matters:
    // an NGO reads "its own" donations by recipientId, a courier by
    // volunteerId, and a donor — who owns no profile row — by account id.
    expect(toUser(apiUser({ id: 3, role: 'ngo', recipientId: 42 })).entityId).toBe('42');
    expect(toUser(apiUser({ id: 3, role: 'volunteer', volunteerId: 9 })).entityId).toBe('9');
    expect(toUser(apiUser({ id: 3, role: 'donor' })).entityId).toBe('3');
  });

  it('keeps the account id itself distinct from the entity id', () => {
    const user = toUser(apiUser({ id: 3, role: 'ngo', recipientId: 42 }));

    expect(user.id).toBe('3');
    expect(user.entityId).toBe('42');
  });
});

describe('toDonation', () => {
  it('folds the append-only event list into the named timestamps the UI reads', () => {
    const donation = toDonation(
      apiDonation({
        events: [
          apiEvent('AVAILABLE', '2026-09-05T09:00:00.000Z'),
          apiEvent('ACCEPTED', '2026-09-05T10:30:00.000Z'),
          apiEvent('PICKED_UP', '2026-09-05T11:15:00.000Z'),
        ],
      }),
    );

    expect(donation.acceptedAt).toBe('2026-09-05T10:30:00.000Z');
    expect(donation.pickedUpAt).toBe('2026-09-05T11:15:00.000Z');
    // A transition that has not happened has no timestamp, rather than a zero
    // one — the timeline renders the difference.
    expect(donation.deliveredAt).toBeUndefined();
    expect(donation.completedAt).toBeUndefined();
  });

  it('turns absent optional wire values into undefined, not the string "null"', () => {
    const donation = toDonation(
      apiDonation({ recipientId: null, volunteerId: null, matchScore: null, distanceKm: null }),
    );

    expect(donation.recipientId).toBeUndefined();
    expect(donation.volunteerId).toBeUndefined();
    expect(donation.matchScore).toBeUndefined();
    expect(donation.distanceKm).toBeUndefined();
  });

  it('names the donor as the organisation when no organisation is recorded', () => {
    const donation = toDonation(apiDonation({ donorName: 'Asha Menon', donorOrganization: null }));

    expect(donation.donorOrganization).toBe('Asha Menon');
  });
});

describe('toMatchAnalysis', () => {
  it("carries the API's deadline score into the field the UI calls pickup availability", () => {
    // The two names are the same number; D-30 depends on them not drifting.
    const analysis = toMatchAnalysis(apiMatch({ deadlineScore: 73, reliabilityScore: 61 }));

    expect(analysis.pickupAvailabilityScore).toBe(73);
    expect(analysis.reliabilityScore).toBe(61);
  });
});

describe('toActivity', () => {
  it('orders the folded feed newest first across donations', () => {
    const feed = toActivity([
      apiDonation({ id: 1, events: [apiEvent('AVAILABLE', '2026-09-05T09:00:00.000Z')] }),
      apiDonation({ id: 2, events: [apiEvent('AVAILABLE', '2026-09-05T12:00:00.000Z')] }),
    ]);

    expect(feed.map(entry => entry.timestamp)).toEqual([
      '2026-09-05T12:00:00.000Z',
      '2026-09-05T09:00:00.000Z',
    ]);
  });

  it('honours the limit after sorting, so the newest entries survive the cut', () => {
    const feed = toActivity(
      [
        apiDonation({ id: 1, events: [apiEvent('AVAILABLE', '2026-09-05T09:00:00.000Z')] }),
        apiDonation({ id: 2, events: [apiEvent('AVAILABLE', '2026-09-05T12:00:00.000Z')] }),
      ],
      1,
    );

    expect(feed).toHaveLength(1);
    expect(feed[0].timestamp).toBe('2026-09-05T12:00:00.000Z');
  });

  it('describes a completed handover with the recipient that received it', () => {
    const [entry] = toActivity([
      apiDonation({
        quantity: 40,
        unit: 'Meals',
        foodName: 'Vegetable biryani',
        recipientId: 7,
        recipientName: 'Helping Hands',
        status: 'COMPLETED',
        events: [apiEvent('COMPLETED', '2026-09-05T13:00:00.000Z')],
      }),
    ]);

    expect(entry.type).toBe('completed');
    expect(entry.message).toContain('40 meals of Vegetable biryani');
    expect(entry.message).toContain('Helping Hands');
  });
});
