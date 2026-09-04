/**
 * Translation between the API's shapes and the app's own.
 *
 * The UI was built against the types in `../types` and works well; the point
 * of this file is that it keeps working. Rather than rewrite forty components
 * around the wire format, every difference between the two is resolved here:
 *
 *  - ids are numbers on the wire and strings in the UI,
 *  - the API records a donation's history as an append-only `events` list,
 *    while the UI reads named timestamps (`acceptedAt`, `pickedUpAt`, …),
 *  - the API has no activity-feed endpoint, so the feed the dashboards show is
 *    folded out of those same events.
 */

import type {
  ActivityLog, AppStats, Donation, DonationStatus, FoodCategory, FoodUnit,
  MatchAnalysis, NGORequirement, Recipient, StorageType, User, Volunteer,
} from '../types';
import type {
  ApiDonation, ApiMatch, ApiMetrics, ApiRecipient, ApiRequirement, ApiStatusEvent,
  ApiUser, ApiVolunteer,
} from './api';

// ─── User ─────────────────────────────────────────────────────────────────────

export function toUser(api: ApiUser): User {
  return {
    id: String(api.id),
    name: api.name,
    email: api.email,
    role: api.role,
    avatarInitials: api.initials,
    organization: api.organization ?? undefined,
    phone: api.phone ?? undefined,
    // Which record this account acts through when filtering donations. Donors
    // act as themselves; NGOs and couriers act through their profile row.
    entityId:
      api.recipientId !== null
        ? String(api.recipientId)
        : api.volunteerId !== null
          ? String(api.volunteerId)
          : String(api.id),
  };
}

// ─── Donation ─────────────────────────────────────────────────────────────────

function eventTime(events: ApiStatusEvent[], status: DonationStatus): string | undefined {
  return events.find(e => e.toStatus === status)?.occurredAt;
}

export function toDonation(api: ApiDonation): Donation {
  const events = api.events ?? [];
  return {
    id: String(api.id),
    donorId: String(api.donorId),
    donorName: api.donorName,
    donorOrganization: api.donorOrganization ?? api.donorName,
    foodName: api.foodName,
    category: api.category as FoodCategory,
    quantity: api.quantity,
    unit: api.unit as FoodUnit,
    // Kept as ISO instants rather than "8:00 PM" display strings. A deadline
    // is a moment in time, and the urgency logic has to be able to tell
    // tomorrow morning from this morning.
    preparedAt: api.preparedAt ?? '',
    pickupDeadline: api.pickupDeadline,
    location: api.location,
    description: api.description,
    storageType: api.storageType as StorageType,
    imagePreview: api.imageUrl ?? undefined,
    status: api.status,
    createdAt: api.createdAt,
    recipientId: api.recipientId !== null ? String(api.recipientId) : undefined,
    recipientName: api.recipientName ?? undefined,
    volunteerId: api.volunteerId !== null ? String(api.volunteerId) : undefined,
    volunteerName: api.volunteerName ?? undefined,
    matchScore: api.matchScore ?? undefined,
    viewerMatch: api.viewerMatch ? toMatchAnalysis(api.viewerMatch) : undefined,
    distanceKm: api.distanceKm ?? undefined,
    matchedAt: eventTime(events, 'MATCHED'),
    acceptedAt: eventTime(events, 'ACCEPTED'),
    volunteerAssignedAt: eventTime(events, 'VOLUNTEER_ASSIGNED'),
    pickedUpAt: eventTime(events, 'PICKED_UP'),
    deliveredAt: eventTime(events, 'DELIVERED'),
    completedAt: eventTime(events, 'COMPLETED'),
  };
}

// ─── Organisations, couriers, requirements ────────────────────────────────────

export function toRecipient(api: ApiRecipient): Recipient {
  return {
    id: String(api.id),
    name: api.name,
    type: api.type,
    location: api.location || 'Location not set',
    capacity: api.capacity,
    reliabilityScore: api.reliabilityScore,
    acceptedDonations: api.acceptedDonations,
    contactPerson: api.contactPerson ?? '—',
    phone: api.phone ?? '—',
    isVerified: api.isVerified,
    // Distance is a relationship between a donation and an organisation, not a
    // property of the organisation, so the API only reports it per donation.
    distanceKm: undefined,
  };
}

export function toVolunteer(api: ApiVolunteer): Volunteer {
  return {
    id: String(api.id),
    name: api.name,
    phone: api.phone ?? '—',
    location: api.location || 'Location not set',
    completedDeliveries: api.completedDeliveries,
    rating: api.rating,
    isAvailable: api.isAvailable,
    distanceKm: undefined,
    activeDeliveries: undefined,
  };
}

export function toRequirement(api: ApiRequirement): NGORequirement {
  return {
    id: String(api.id),
    ngoId: String(api.recipientId),
    ngoName: api.recipientName,
    foodType: api.foodType,
    quantityNeeded: api.quantityNeeded,
    unit: api.unit,
    beneficiaryCount: api.beneficiaryCount,
    urgency: (api.urgency as NGORequirement['urgency']) ?? 'Medium',
    dailyRecurring: api.dailyRecurring,
    notes: api.notes,
  };
}

// ─── Match analysis ───────────────────────────────────────────────────────────

export function toMatchAnalysis(api: ApiMatch): MatchAnalysis {
  return {
    recipientName: api.recipientName,
    distanceKm: api.distanceKm,
    overallScore: api.overallScore,
    distanceScore: api.distanceScore,
    quantityScore: api.quantityScore,
    capacityScore: api.capacityScore,
    // The API calls this the deadline score — how comfortably a collection
    // fits before the food expires. The UI's label predates that name.
    pickupAvailabilityScore: api.deadlineScore,
    reliabilityScore: api.reliabilityScore,
    reasons: api.reasons,
  };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function toStats(api: ApiMetrics, donations: Donation[]): AppStats {
  return {
    totalDonations: api.totalDonations,
    totalMeals: api.totalMeals,
    completedDonations: api.completedDonations,
    activeDonations: api.activeDonations,
    totalOrganizations: api.totalOrganizations,
    totalVolunteers: api.totalVolunteers,
    // Not a server metric: the number of runs that reached a courier's hands.
    successfulPickups: donations.filter(d =>
      ['PICKED_UP', 'DELIVERED', 'COMPLETED'].includes(d.status),
    ).length,
    expiredDonations: api.expiredDonations,
    medianTimeToClaimMinutes: api.medianTimeToClaimMinutes ?? undefined,
    medianHandoverMinutes: api.medianHandoverMinutes ?? undefined,
    rescueRatePercent: api.rescueRatePercent ?? undefined,
    expiryLossRatePercent: api.expiryLossRatePercent ?? undefined,
  };
}

export const EMPTY_STATS: AppStats = {
  totalDonations: 0,
  totalMeals: 0,
  completedDonations: 0,
  activeDonations: 0,
  totalOrganizations: 0,
  totalVolunteers: 0,
  successfulPickups: 0,
  expiredDonations: 0,
};

// ─── Activity feed ────────────────────────────────────────────────────────────

const ACTIVITY_TYPES: Record<DonationStatus, ActivityLog['type']> = {
  AVAILABLE: 'donation_created',
  MATCHED: 'donation_accepted',
  ACCEPTED: 'donation_accepted',
  VOLUNTEER_ASSIGNED: 'volunteer_assigned',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'donation_created',
  EXPIRED: 'donation_created',
};

function activityMessage(donation: Donation, event: ApiStatusEvent): string {
  const what = `${donation.quantity} ${donation.unit.toLowerCase()} of ${donation.foodName}`;
  const org = donation.donorOrganization;
  const recipient = donation.recipientName ?? 'a recipient';
  const courier = donation.volunteerName ?? 'a courier';

  switch (event.toStatus) {
    case 'AVAILABLE':
      return `New donation: ${what} from ${org}`;
    case 'MATCHED':
      return `Matched ${what}${donation.matchScore ? ` at ${donation.matchScore}%` : ''}${
        event.note ? ` — ${event.note}` : ''
      }`;
    case 'ACCEPTED':
      return `${recipient} accepted ${what}`;
    case 'VOLUNTEER_ASSIGNED':
      return `${courier} took the pickup for ${what}`;
    case 'PICKED_UP':
      return `${courier} collected ${what} from ${org}`;
    case 'DELIVERED':
      return `${what} delivered to ${recipient}`;
    case 'COMPLETED':
      return `Redistribution complete — ${what} served at ${recipient}`;
    case 'CANCELLED':
      return `${what} was cancelled${event.note ? `: ${event.note}` : ''}`;
    case 'EXPIRED':
      return `${what} expired before anyone claimed it`;
    default:
      return `${what} updated`;
  }
}

/**
 * The activity feed, folded out of every donation's status history.
 *
 * The backend has no feed endpoint, and it does not need one: `status_events`
 * already is the feed, and deriving it here means the timeline the dashboards
 * show is the same server-stamped history the metrics are computed from,
 * rather than a second account of events that could drift from it.
 */
export function toActivity(apiDonations: ApiDonation[], limit = 40): ActivityLog[] {
  const entries: ActivityLog[] = [];

  for (const apiDonation of apiDonations) {
    const donation = toDonation(apiDonation);
    for (const event of apiDonation.events ?? []) {
      entries.push({
        id: `act-${apiDonation.id}-${event.toStatus}-${event.occurredAt}`,
        timestamp: event.occurredAt,
        type: ACTIVITY_TYPES[event.toStatus] ?? 'donation_created',
        message: activityMessage(donation, event),
        donationId: donation.id,
      });
    }
  }

  entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  return entries.slice(0, limit);
}
