/**
 * The single place the frontend talks to FastAPI.
 *
 * Everything else in the app calls these functions rather than `fetch`, so
 * three concerns are handled once instead of in forty components:
 *
 *  - the bearer token is attached to every request,
 *  - a failed response becomes a thrown `ApiError` carrying the server's own
 *    `detail` message, which is written to be shown to a person,
 *  - a 401 means the session is gone, and the whole app needs to know at once
 *    rather than each screen discovering it separately.
 *
 * In development requests go to a relative `/api/...` path and Vite proxies
 * them to the backend, so there is no CORS negotiation and no host to
 * configure. `VITE_API_URL` overrides the origin for a real deployment.
 */

import type {
  DonationStatus, FoodCategory, FoodUnit, StorageType, UserRole,
} from '../types';

const BASE_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

const TOKEN_KEY = 'foodlink.token';

// ─── Session token ────────────────────────────────────────────────────────────

/**
 * The token lives in localStorage so a refresh does not sign the user out.
 * That trades a little XSS exposure for the session surviving a page reload,
 * which is the right trade for this app: any script able to read it could just
 * as easily act through the already-authenticated page.
 */
export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // Private mode, or storage disabled.
  }
}

export function setToken(token: string | null): void {
  try {
    if (token === null) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* Nothing useful to do; the session simply will not survive a reload. */
  }
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }

  /** True when the server rejected *this action*, not the credentials. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** True when the lifecycle would not allow the transition. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

/** Raised when the network never reached the server at all. */
export class NetworkError extends ApiError {
  constructor() {
    super(0, 'Cannot reach the FoodLink server. Is the backend running?');
    this.name = 'NetworkError';
  }
}

// ─── Expired / revoked sessions ───────────────────────────────────────────────

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/**
 * Registered once by AuthContext. Called whenever any request comes back 401,
 * which happens when a token expires or an administrator suspends the account
 * mid-session — the backend re-reads the account on every request, so this can
 * arrive at any moment rather than only at login.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

// ─── Request plumbing ─────────────────────────────────────────────────────────

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send as form-encoded rather than JSON — the login endpoint wants OAuth2 form fields. */
  form?: Record<string, string>;
  /** Skip the 401 handler; used by the login call, where a 401 is just "wrong password". */
  anonymous?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, form, anonymous = false } = options;

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && !anonymous) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 401 && !anonymous) {
    // The token is no longer good for anything. Drop it before anyone can
    // retry with it, then let the app fall back to the login screen.
    setToken(null);
    onUnauthorized?.();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    // A dead backend reaches the browser as a proxy error with no JSON body,
    // not as a failed fetch — so "Request failed (500)" would be the least
    // useful true thing we could say. Name the actual problem instead.
    if (response.status >= 500 && parsed === null) {
      throw new NetworkError();
    }
    throw new ApiError(response.status, extractDetail(parsed, response.status));
  }

  return parsed as T;
}

/**
 * FastAPI reports errors as `{detail: ...}`, where detail is a string for our
 * own `HTTPException`s and a list of field errors for schema validation. Both
 * need to become one sentence a person can read.
 */
function extractDetail(parsed: unknown, status: number): string {
  const detail = (parsed as { detail?: unknown } | null)?.detail;

  if (typeof detail === 'string') return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map(item => {
        const entry = item as { loc?: unknown[]; msg?: string };
        const field = Array.isArray(entry.loc) ? entry.loc[entry.loc.length - 1] : null;
        const message = entry.msg ?? 'is invalid';
        // Pydantic prefixes its own messages; strip it so the field name reads first.
        const cleaned = message.replace(/^Value error,\s*/, '');
        return field ? `${humanise(String(field))}: ${cleaned}` : cleaned;
      })
      .filter(Boolean);
    if (messages.length) return messages.join('. ');
  }

  return `Request failed (${status})`;
}

function humanise(field: string): string {
  const spaced = field.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ─── Wire types ───────────────────────────────────────────────────────────────
// These mirror the Pydantic schemas exactly. Translation into the app's own
// types happens in `adapters.ts`, so a change on either side has one place to
// meet rather than leaking through every component.

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  organization: string | null;
  initials: string;
  recipientId: number | null;
  volunteerId: number | null;
}

export interface ApiAdminUser extends ApiUser {
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ApiToken {
  accessToken: string;
  tokenType: string;
  user: ApiUser;
}

export interface ApiStatusEvent {
  toStatus: DonationStatus;
  fromStatus: DonationStatus | null;
  occurredAt: string;
  note: string | null;
}

export interface ApiDonation {
  id: number;
  donorId: number;
  donorName: string;
  donorOrganization: string | null;
  foodName: string;
  category: string;
  quantity: number;
  unit: string;
  storageType: string;
  description: string;
  imageUrl: string | null;
  location: string;
  latitude: number;
  longitude: number;
  preparedAt: string | null;
  pickupDeadline: string;
  status: DonationStatus;
  recipientId: number | null;
  recipientName: string | null;
  volunteerId: number | null;
  volunteerName: string | null;
  matchScore: number | null;
  distanceKm: number | null;
  createdAt: string;
  events: ApiStatusEvent[];
}

export interface ApiRecipient {
  id: number;
  name: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  capacity: number;
  contactPerson: string | null;
  phone: string | null;
  isVerified: boolean;
  reliabilityScore: number;
  acceptedDonations: number;
}

export interface ApiMatch {
  recipientId: number;
  recipientName: string;
  overallScore: number;
  distanceKm: number;
  distanceScore: number;
  quantityScore: number;
  capacityScore: number;
  deadlineScore: number;
  reliabilityScore: number;
  reasons: string[];
}

export interface ApiRequirement {
  id: number;
  recipientId: number;
  recipientName: string;
  foodType: string;
  quantityNeeded: number;
  unit: string;
  beneficiaryCount: number;
  urgency: string;
  dailyRecurring: boolean;
  notes: string;
  isActive: boolean;
  createdAt: string;
}

export interface ApiVolunteer {
  id: number;
  name: string;
  phone: string | null;
  location: string;
  isAvailable: boolean;
  completedDeliveries: number;
  rating: number;
}

export interface ApiMetrics {
  totalDonations: number;
  totalMeals: number;
  completedDonations: number;
  activeDonations: number;
  expiredDonations: number;
  totalOrganizations: number;
  totalVolunteers: number;
  medianTimeToClaimMinutes: number | null;
  rescueRatePercent: number | null;
  expiryLossRatePercent: number | null;
  medianHandoverMinutes: number | null;
}

export interface DonationCreateBody {
  foodName: string;
  category: FoodCategory | string;
  quantity: number;
  unit: FoodUnit | string;
  storageType: StorageType | string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  preparedAt: string | null;
  pickupDeadline: string;
  imageUrl?: string | null;
}

export interface RegisterBody {
  name: string;
  email: string;
  password: string;
  role: Exclude<UserRole, 'admin'>;
  organization?: string | null;
  phone?: string | null;
  organizationType?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  capacity?: number | null;
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<ApiToken>('/api/auth/login', {
      method: 'POST',
      // OAuth2PasswordRequestForm names the field "username"; ours holds an email.
      form: { username: email, password },
      anonymous: true,
    }),

  register: (body: RegisterBody) =>
    request<ApiToken>('/api/auth/register', { method: 'POST', body, anonymous: true }),

  me: () => request<ApiUser>('/api/auth/me'),

  updateMe: (body: { name?: string; organization?: string; phone?: string }) =>
    request<ApiUser>('/api/auth/me', { method: 'PATCH', body }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<ApiUser>('/api/auth/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  // Donations
  listDonations: (params: { mine?: boolean; status?: DonationStatus[]; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (params.mine) query.set('mine', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    params.status?.forEach(s => query.append('status', s));
    const suffix = query.toString();
    return request<ApiDonation[]>(`/api/donations${suffix ? `?${suffix}` : ''}`);
  },

  getDonation: (id: number) => request<ApiDonation>(`/api/donations/${id}`),

  createDonation: (body: DonationCreateBody) =>
    request<ApiDonation>('/api/donations', { method: 'POST', body }),

  getMatches: (id: number, limit = 5) =>
    request<ApiMatch[]>(`/api/donations/${id}/matches?limit=${limit}`),

  updateStatus: (
    id: number,
    status: DonationStatus,
    extra: { recipientId?: number; note?: string } = {},
  ) =>
    request<ApiDonation>(`/api/donations/${id}/status`, {
      method: 'POST',
      body: { status, ...extra },
    }),

  // Organisations
  listRecipients: () => request<ApiRecipient[]>('/api/recipients'),
  myRecipient: () => request<ApiRecipient>('/api/recipients/me'),
  updateMyRecipient: (body: Partial<Omit<ApiRecipient, 'id' | 'isVerified'>>) =>
    request<ApiRecipient>('/api/recipients/me', { method: 'PATCH', body }),

  listRequirements: () => request<ApiRequirement[]>('/api/requirements'),
  createRequirement: (body: {
    foodType: string;
    quantityNeeded: number;
    unit: string;
    beneficiaryCount: number;
    urgency: string;
    dailyRecurring: boolean;
    notes: string;
  }) => request<ApiRequirement>('/api/requirements', { method: 'POST', body }),

  listVolunteers: () => request<ApiVolunteer[]>('/api/volunteers'),
  myVolunteer: () => request<ApiVolunteer>('/api/volunteers/me'),
  updateMyVolunteer: (body: {
    isAvailable?: boolean;
    location?: string;
    latitude?: number;
    longitude?: number;
  }) => request<ApiVolunteer>('/api/volunteers/me', { method: 'PATCH', body }),

  // Metrics
  metrics: () => request<ApiMetrics>('/api/metrics'),

  // Admin
  listUsers: () => request<ApiAdminUser[]>('/api/admin/users'),
  updateUser: (
    id: number,
    body: { isActive?: boolean; role?: UserRole; name?: string; organization?: string },
  ) => request<ApiAdminUser>(`/api/admin/users/${id}`, { method: 'PATCH', body }),
  verifyRecipient: (id: number) =>
    request<ApiRecipient>(`/api/admin/recipients/${id}/verify`, { method: 'POST' }),
  revokeVerification: (id: number) =>
    request<ApiRecipient>(`/api/admin/recipients/${id}/verify`, { method: 'DELETE' }),
  expireOverdue: () =>
    request<{ expired: number }>('/api/admin/maintenance/expire', { method: 'POST' }),
};
