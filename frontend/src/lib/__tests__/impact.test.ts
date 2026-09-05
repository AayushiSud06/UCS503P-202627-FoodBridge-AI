/**
 * Per-account impact figures.
 *
 * D-32 is the rule these enforce: one account asking one question gets one
 * answer, computed from that account's own rows. The desktop portal and the
 * `/m/*` screens both read this module precisely because they used to disagree,
 * and nothing in the type system would notice if they started disagreeing again.
 */

import { describe, expect, it } from 'vitest';
import { donorImpact, ngoImpact, volunteerImpact } from '../impact';
import { apiVolunteer, donation } from '../../test/fixtures';
import { toVolunteer } from '../adapters';

describe('donorImpact', () => {
  it('counts only this donor, and only counts COMPLETED as delivered', () => {
    const donations = [
      donation({ id: 1, donorId: 1, quantity: 40, status: 'COMPLETED', recipientName: 'Helping Hands' }),
      // Delivered but not confirmed received: listed, not delivered.
      donation({ id: 2, donorId: 1, quantity: 10, status: 'DELIVERED', recipientName: 'Helping Hands' }),
      // Somebody else's donation, visible in the same list.
      donation({ id: 3, donorId: 2, quantity: 99, status: 'COMPLETED' }),
    ];

    const impact = donorImpact(donations, '1');

    expect(impact.listedCount).toBe(2);
    expect(impact.listedMeals).toBe(50);
    expect(impact.deliveredCount).toBe(1);
    expect(impact.deliveredMeals).toBe(40);
  });

  it('leaves an unmatched donation out of the kitchen breakdown rather than inventing one', () => {
    const donations = [
      donation({ id: 1, donorId: 1, quantity: 30, status: 'COMPLETED', recipientName: 'Helping Hands' }),
      donation({ id: 2, donorId: 1, quantity: 10, status: 'COMPLETED', recipientName: null }),
    ];

    const impact = donorImpact(donations, '1');

    expect(impact.kitchens).toEqual([{ label: 'Helping Hands', meals: 30, percent: 100 }]);
  });

  it('sums only the distances the server actually sent', () => {
    // No distance is computed in the browser (D-33); a donation without one
    // contributes nothing rather than a guess.
    const donations = [
      donation({ id: 1, donorId: 1, distanceKm: 3.5 }),
      donation({ id: 2, donorId: 1, distanceKm: null }),
    ];

    expect(donorImpact(donations, '1').distanceKm).toBe(3.5);
  });
});

describe('ngoImpact', () => {
  it('separates what was served from what is still in flight', () => {
    const donations = [
      donation({ id: 1, recipientId: 7, quantity: 25, status: 'COMPLETED', donorOrganization: 'Hotel Rasoi' }),
      donation({ id: 2, recipientId: 7, quantity: 15, status: 'ACCEPTED', donorOrganization: 'Hotel Rasoi' }),
      donation({ id: 3, recipientId: 8, quantity: 50, status: 'COMPLETED' }),
    ];

    const impact = ngoImpact(donations, '7');

    expect(impact.acceptedCount).toBe(2);
    expect(impact.collections).toBe(1);
    expect(impact.servedMeals).toBe(25);
  });
});

describe('volunteerImpact', () => {
  it("prefers the server's lifetime run counter over what this session loaded", () => {
    const donations = [donation({ id: 1, volunteerId: 5, quantity: 20, status: 'COMPLETED' })];
    const profile = toVolunteer(apiVolunteer({ id: 5, completedDeliveries: 12 }));

    const impact = volunteerImpact(donations, '5', profile);

    expect(impact.runs).toBe(12);
    expect(impact.runsFromServer).toBe(true);
    // Meals still come from the loaded list; only the run count is the counter.
    expect(impact.deliveredMeals).toBe(20);
  });

  it('falls back to the loaded runs when no profile row is available', () => {
    const donations = [
      donation({ id: 1, volunteerId: 5, quantity: 20, status: 'COMPLETED' }),
      donation({ id: 2, volunteerId: 5, quantity: 30, status: 'DELIVERED' }),
    ];

    const impact = volunteerImpact(donations, '5', null);

    // COMPLETED only — the transition the server's counter increments on.
    expect(impact.runs).toBe(1);
    expect(impact.runsFromServer).toBe(false);
    expect(impact.deliveredMeals).toBe(20);
  });
});
