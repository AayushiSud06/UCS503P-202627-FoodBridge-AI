/**
 * Per-account impact figures, derived from data the account actually holds.
 *
 * Every number a role's Impact screen shows has to be traceable to a row the
 * server sent. Three sources qualify, and nothing else does:
 *
 *  - the donations `GET /api/donations` returned, already scoped to what this
 *    account may read (a donor gets their own listings, an organisation the
 *    open pool plus its own, a courier the unclaimed pool plus its own runs),
 *  - the server-maintained counters on the account's own profile row —
 *    `Volunteer.completedDeliveries`, `Recipient.acceptedDonations` and the
 *    `reliabilityScore` derived from it,
 *  - `GET /api/metrics`, which is ledger-derived but **platform-wide**, so it
 *    answers "how is FoodLink doing" and never "how am *I* doing". The
 *    per-role Impact screens ask the second question, which is why they read
 *    the donation list rather than the metrics endpoint.
 *
 * This module exists so the desktop portal and the `/m/*` screens compute
 * those figures **once**. They previously each had their own arithmetic and
 * disagreed — the same donor's CO2e was `completed x 2.5` on one surface and
 * `listed x 0.86` on the other, and a courier's meal total counted `DELIVERED`
 * on one and not the other. One account asking one question has to get one
 * answer; that is the rule `viewerMatch` was introduced for (D-30).
 *
 * WARNING: `quantity` is a count in the donation's own `unit` — Meals, Kg,
 * Boxes or Pieces — so a sum of it is a mixed-unit total. It is honest as "how
 * much was listed" and it is *not* a mass, which is why nothing here converts
 * it into one. The environmental equivalences these screens used to print (kg
 * CO2e, litres of water) multiplied that mixed count by an unsourced per-meal
 * factor; they were removed rather than re-based, because no factor makes the
 * input mean what the output claimed.
 */

import type { Donation, Volunteer } from '../types';

/** One slice of a breakdown: a name, its total, and its share of the whole. */
export interface ImpactShare {
  label: string;
  meals: number;
  /** Percent of the breakdown's total, rounded. Slices need not sum to 100. */
  percent: number;
}

/** One column of the six-month history. */
export interface ImpactMonth {
  label: string;
  meals: number;
}

function isCompleted(donation: Donation): boolean {
  return donation.status === 'COMPLETED';
}

function sumQuantity(donations: Donation[]): number {
  return donations.reduce((total, donation) => total + donation.quantity, 0);
}

/**
 * Straight-line donor-to-kitchen distance over the given donations.
 *
 * `distanceKm` is the server's haversine between the two pinned coordinates,
 * so it exists only once a donation has a recipient and it is **not** a road
 * distance. Screens must say so; nothing in the repository routes.
 */
function sumDistanceKm(donations: Donation[]): number {
  return donations.reduce((total, donation) => total + (donation.distanceKm ?? 0), 0);
}

/**
 * Group by a field, largest first, as shares of the group's own total.
 *
 * Donations with nothing in that field are dropped rather than bucketed under
 * a placeholder: an unmatched donation has no kitchen, and inventing one would
 * be the kind of filler this module exists to remove.
 */
function shares(donations: Donation[], key: (d: Donation) => string | undefined): ImpactShare[] {
  const totals = new Map<string, number>();
  for (const donation of donations) {
    const label = key(donation);
    if (!label) continue;
    totals.set(label, (totals.get(label) ?? 0) + donation.quantity);
  }

  const overall = [...totals.values()].reduce((a, b) => a + b, 0);
  if (overall === 0) return [];

  return [...totals.entries()]
    .map(([label, meals]) => ({ label, meals, percent: Math.round((100 * meals) / overall) }))
    .sort((a, b) => b.meals - a.meals);
}

/**
 * The last `count` calendar months, oldest first, totalled by listing date.
 *
 * Empty months are kept as zeroes — a gap in donating is a fact about the
 * account, and dropping the column would quietly flatter it.
 */
function monthlyMeals(donations: Donation[], count = 6, now: Date = new Date()): ImpactMonth[] {
  const months: ImpactMonth[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 1);
    const meals = sumQuantity(
      donations.filter(d => {
        const created = Date.parse(d.createdAt);
        return !Number.isNaN(created) && created >= start.getTime() && created < end.getTime();
      }),
    );
    months.push({ label: start.toLocaleString(undefined, { month: 'short' }), meals });
  }
  return months;
}

// --- Donor -------------------------------------------------------------------

export interface DonorImpact {
  /** Everything this donor has listed, whatever became of it. */
  listedMeals: number;
  listedCount: number;
  /** Only what a recipient confirmed receiving. */
  deliveredMeals: number;
  deliveredCount: number;
  /** Kitchens that confirmed receipt, by how much they received. */
  kitchens: ImpactShare[];
  /** Listings by food category — the donor's own `category` values. */
  categories: ImpactShare[];
  monthly: ImpactMonth[];
  /** Straight-line distance the matched donations spanned. */
  distanceKm: number;
}

export function donorImpact(donations: Donation[], donorId: string): DonorImpact {
  const mine = donations.filter(d => d.donorId === donorId);
  const delivered = mine.filter(isCompleted);

  return {
    listedMeals: sumQuantity(mine),
    listedCount: mine.length,
    deliveredMeals: sumQuantity(delivered),
    deliveredCount: delivered.length,
    kitchens: shares(delivered, d => d.recipientName),
    categories: shares(mine, d => d.category),
    monthly: monthlyMeals(mine),
    distanceKm: sumDistanceKm(mine),
  };
}

// --- Recipient organisation --------------------------------------------------

export interface NgoImpact {
  /** Meals this organisation confirmed receiving. */
  servedMeals: number;
  /** Collections seen through to completion. */
  collections: number;
  /** Donations bound to this organisation, completed or still in flight. */
  acceptedCount: number;
  /** Donor organisations that supplied the completed collections. */
  donors: ImpactShare[];
  categories: ImpactShare[];
}

export function ngoImpact(donations: Donation[], recipientId: string): NgoImpact {
  const mine = donations.filter(d => d.recipientId === recipientId);
  const served = mine.filter(isCompleted);

  return {
    servedMeals: sumQuantity(served),
    collections: served.length,
    acceptedCount: mine.length,
    donors: shares(served, d => d.donorOrganization),
    categories: shares(served, d => d.category),
  };
}

// --- Volunteer courier -------------------------------------------------------

export interface VolunteerImpact {
  /** Meals on runs this courier completed. */
  deliveredMeals: number;
  /**
   * Completed runs. The server's own counter wins where it is available: it
   * counts every run this courier has ever finished, while the donation list
   * only covers what this session loaded.
   */
  runs: number;
  /** True when `runs` came from the server counter rather than the list. */
  runsFromServer: boolean;
  /** Straight-line distance those runs spanned, donor pin to kitchen pin. */
  distanceKm: number;
  /** Kitchens this courier delivered to, by meals carried. */
  drops: ImpactShare[];
}

export function volunteerImpact(
  donations: Donation[],
  volunteerId: string,
  profile: Volunteer | null,
): VolunteerImpact {
  const mine = donations.filter(d => d.volunteerId === volunteerId);
  // `COMPLETED`, not `DELIVERED`, because that is the transition the server's
  // `completed_deliveries` counter increments on. Counting a different set
  // here would put the run total and the meal total on different footings.
  const done = mine.filter(isCompleted);

  return {
    deliveredMeals: sumQuantity(done),
    runs: profile?.completedDeliveries ?? done.length,
    runsFromServer: profile?.completedDeliveries !== undefined,
    distanceKm: sumDistanceKm(mine),
    drops: shares(done, d => d.recipientName),
  };
}
