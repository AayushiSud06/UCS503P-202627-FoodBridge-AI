/**
 * Builders for the wire shapes the tests feed through the real adapters.
 *
 * The point is that a test states only the field it is about. Everything else
 * comes from a valid default, so adding a field to `ApiDonation` breaks the
 * builder once rather than breaking every suite — and, because these are typed
 * as the real `api.ts` interfaces, a wire shape that drifts from the backend
 * fails to compile here instead of failing silently in a component.
 */

import type {
  ApiDonation, ApiMatch, ApiMetrics, ApiRequirement, ApiStatusEvent, ApiUser, ApiVolunteer,
} from '../lib/api';
import type { Donation, NGORequirement } from '../types';
import { toDonation, toRequirement } from '../lib/adapters';

export function apiUser(overrides: Partial<ApiUser> = {}): ApiUser {
  return {
    id: 1,
    name: 'Asha Menon',
    email: 'asha@example.org',
    role: 'donor',
    organization: 'Hotel Rasoi',
    phone: null,
    initials: 'AM',
    recipientId: null,
    volunteerId: null,
    ...overrides,
  };
}

export function apiMatch(overrides: Partial<ApiMatch> = {}): ApiMatch {
  return {
    recipientId: 7,
    recipientName: 'Helping Hands',
    overallScore: 82,
    distanceKm: 3.4,
    distanceScore: 90,
    quantityScore: 70,
    capacityScore: 65,
    deadlineScore: 88,
    reliabilityScore: 95,
    reasons: ['3.4 km away'],
    ...overrides,
  };
}

export function apiEvent(
  toStatus: ApiStatusEvent['toStatus'],
  occurredAt: string,
  overrides: Partial<ApiStatusEvent> = {},
): ApiStatusEvent {
  return { toStatus, fromStatus: null, occurredAt, note: null, ...overrides };
}

export function apiDonation(overrides: Partial<ApiDonation> = {}): ApiDonation {
  return {
    id: 100,
    donorId: 1,
    donorName: 'Asha Menon',
    donorOrganization: 'Hotel Rasoi',
    foodName: 'Vegetable biryani',
    category: 'Vegetarian',
    quantity: 40,
    unit: 'Meals',
    storageType: 'Room Temperature',
    description: 'Surplus from a function.',
    imageUrl: null,
    location: 'Patiala',
    latitude: 30.354,
    longitude: 76.363,
    preparedAt: null,
    pickupDeadline: '2026-09-05T18:00:00.000Z',
    status: 'AVAILABLE',
    recipientId: null,
    recipientName: null,
    volunteerId: null,
    volunteerName: null,
    matchScore: null,
    viewerMatch: null,
    distanceKm: null,
    createdAt: '2026-09-05T09:00:00.000Z',
    events: [],
    ...overrides,
  };
}

export function apiVolunteer(overrides: Partial<ApiVolunteer> = {}): ApiVolunteer {
  return {
    id: 5,
    name: 'Ravi Kumar',
    phone: null,
    location: '',
    isAvailable: true,
    completedDeliveries: 0,
    rating: 4.5,
    ...overrides,
  };
}

export function apiRequirement(overrides: Partial<ApiRequirement> = {}): ApiRequirement {
  return {
    id: 200,
    recipientId: 7,
    recipientName: 'Helping Hands',
    isVerified: true,
    foodType: 'Hot vegetarian meals',
    quantityNeeded: 120,
    unit: 'Meals',
    beneficiaryCount: 140,
    urgency: 'High',
    dailyRecurring: false,
    notes: '',
    isActive: true,
    createdAt: '2026-09-05T09:00:00.000Z',
    ...overrides,
  };
}

export function apiMetrics(overrides: Partial<ApiMetrics> = {}): ApiMetrics {
  return {
    totalDonations: 0,
    totalMeals: 0,
    completedDonations: 0,
    activeDonations: 0,
    expiredDonations: 0,
    totalOrganizations: 0,
    totalVolunteers: 0,
    medianTimeToClaimMinutes: null,
    rescueRatePercent: null,
    expiryLossRatePercent: null,
    medianHandoverMinutes: null,
    ...overrides,
  };
}

/** An app-side `Donation`, built through the real adapter rather than by hand. */
export function donation(overrides: Partial<ApiDonation> = {}): Donation {
  return toDonation(apiDonation(overrides));
}

/** An app-side requirement, likewise built through the real adapter. */
export function requirement(overrides: Partial<ApiRequirement> = {}): NGORequirement {
  return toRequirement(apiRequirement(overrides));
}
