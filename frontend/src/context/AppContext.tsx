/**
 * Domain state, loaded from the API.
 *
 * The hook surface is unchanged from the prototype — `useDonations`,
 * `useStats`, `useActivity`, `useRequirements` — because the screens built
 * against it are good and there is no reason to rewrite forty components to
 * change where the data comes from. What changed is underneath: nothing is
 * invented locally any more.
 *
 * Writes go to the server and the affected slice is re-read from it. That is
 * slower than patching local state optimistically, but it is the only way the
 * client and server cannot disagree — and the server is where the lifecycle
 * rules and the server-stamped history live, so its answer is the true one.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import type {
  ActivityLog, AppStats, Donation, DonationStatus, NGORequirement, Recipient, Volunteer,
} from '../types';
import {
  ApiError, api, type ApiDonation, type DonationCreateBody,
} from '../lib/api';
import {
  EMPTY_STATS, toActivity, toDonation, toRecipient, toRequirement, toStats, toVolunteer,
} from '../lib/adapters';
import { errorMessage, useAuth } from './AuthContext';

// ─── Toasts ───────────────────────────────────────────────────────────────────

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  subtitle?: string;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  donations: Donation[];
  /**
   * Standing needs, exactly as the server scoped them for this account.
   *
   * For an `ngo` this includes its own **retired** needs, because the portal
   * has to list what it may reopen; for every other role the server sends
   * active rows only and refuses the flag that would change that. Read it
   * through `useRequirements` (the active board, what almost every screen
   * wants) or `useAllRequirements` (the retired ones too).
   */
  requirements: NGORequirement[];
  recipients: Recipient[];
  volunteers: Volunteer[];
  activity: ActivityLog[];
  stats: AppStats;
  toasts: Toast[];
  /** True during the first load, and during any explicit refresh. */
  isLoading: boolean;
  /** Set when the whole load failed — a down backend, not a single 403. */
  loadError: string | null;
}

const INITIAL_STATE: AppState = {
  donations: [],
  requirements: [],
  recipients: [],
  volunteers: [],
  activity: [],
  stats: EMPTY_STATS,
  toasts: [],
  isLoading: true,
  loadError: null,
};

/** What a screen supplies to post a donation; the server fills in the rest. */
export type DonationDraft = DonationCreateBody;

export interface RequirementDraft {
  foodType: string;
  quantityNeeded: number;
  unit: string;
  beneficiaryCount: number;
  urgency: string;
  dailyRecurring: boolean;
  notes: string;
}

interface AppContextValue {
  state: AppState;
  refresh: () => Promise<void>;
  createDonation: (draft: DonationDraft) => Promise<Donation>;
  createRequirement: (draft: RequirementDraft) => Promise<NGORequirement>;
  /** Revise one of your own requirements; only the given fields change. */
  updateRequirement: (id: string, patch: Partial<RequirementDraft>) => Promise<NGORequirement>;
  /**
   * Take one of your own requirements off the board — met, or no longer
   * needed. The record is kept, not deleted, and stops being listed.
   */
  retireRequirement: (id: string) => Promise<void>;
  /**
   * Put one of your own retired requirements back on the board. The same
   * endpoint and the same single flag as retiring it (D-29) — there is no
   * separate reopen operation and no second lifecycle state.
   */
  reopenRequirement: (id: string) => Promise<void>;
  updateDonationStatus: (
    id: string,
    status: DonationStatus,
    options?: { recipientId?: string; note?: string },
  ) => Promise<Donation>;
  setRecipientVerified: (recipientId: string, verified: boolean) => Promise<void>;
  /** A courier going on or off duty. */
  setAvailability: (isAvailable: boolean) => Promise<void>;
  showToast: (type: Toast['type'], message: string, subtitle?: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Discards the results of a load that a newer one has already superseded,
  // and of any load still in flight when the user signs out.
  const loadId = useRef(0);

  const showToast = useCallback((type: Toast['type'], message: string, subtitle?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setState(prev => ({ ...prev, toasts: [...prev.toasts, { id, type, message, subtitle }] }));

    toastTimers.current[id] = setTimeout(() => {
      setState(prev => ({ ...prev, toasts: prev.toasts.filter(t => t.id !== id) }));
      delete toastTimers.current[id];
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    clearTimeout(toastTimers.current[id]);
    delete toastTimers.current[id];
    setState(prev => ({ ...prev, toasts: prev.toasts.filter(t => t.id !== id) }));
  }, []);

  useEffect(
    () => () => {
      Object.values(toastTimers.current).forEach(clearTimeout);
    },
    [],
  );

  const load = useCallback(async () => {
    const ticket = ++loadId.current;
    setState(prev => ({ ...prev, isLoading: true, loadError: null }));

    // The donation list is the only thing every role can read and the only
    // thing the app is useless without, so it alone decides success. The rest
    // are role-gated — a donor gets 403 from `/api/volunteers`, and that is a
    // correct answer rather than a failure worth showing anyone.
    let donations: ApiDonation[];
    let requirements, recipients, volunteers, metrics, ownVolunteer;
    try {
      [donations, requirements, recipients, volunteers, metrics, ownVolunteer] = await Promise.all([
        api.listDonations({ limit: 500 }),
        // A kitchen reads its own retired needs too, so the portal can list
        // and reopen them. The flag is scoped by the server, not by this call:
        // it never widens *whose* needs come back, and a donor asking for it
        // would still be served the active board (D-44).
        optional(api.listRequirements({ includeInactive: user?.role === 'ngo' })),
        optional(api.listRecipients()),
        // The roster is closed to couriers, so a volunteer reads only their
        // own record. Exactly one of these two returns anything.
        // The roster is open to admins and kitchens only. Asking as anyone
        // else is a 403 we can predict, so don't ask.
        user?.role === 'admin' || user?.role === 'ngo'
          ? optional(api.listVolunteers())
          : Promise.resolve(null),
        optional(api.metrics()),
        user?.role === 'volunteer' ? optional(api.myVolunteer()) : Promise.resolve(null),
      ]);
    } catch (error) {
      if (ticket === loadId.current) {
        setState(prev => ({ ...prev, isLoading: false, loadError: errorMessage(error) }));
      }
      return;
    }

    if (ticket !== loadId.current) return;

    const mapped = donations.map(toDonation);
    setState(prev => ({
      ...prev,
      donations: mapped,
      activity: toActivity(donations),
      requirements: (requirements ?? []).map(toRequirement),
      recipients: (recipients ?? []).map(toRecipient),
      volunteers: (volunteers ?? (ownVolunteer ? [ownVolunteer] : [])).map(toVolunteer),
      stats: metrics ? toStats(metrics, mapped) : EMPTY_STATS,
      isLoading: false,
      loadError: null,
    }));
  }, [user]);

  // Load once someone is signed in; drop everything when they are not, so a
  // second account never sees the first one's records.
  useEffect(() => {
    if (!user) {
      loadId.current++;
      setState(prev => ({ ...INITIAL_STATE, toasts: prev.toasts, isLoading: false }));
      return;
    }
    void load();
  }, [user, load]);

  const createDonation = useCallback(
    async (draft: DonationDraft) => {
      const created = await api.createDonation(draft);
      await load();
      return toDonation(created);
    },
    [load],
  );

  const createRequirement = useCallback(
    async (draft: RequirementDraft) => {
      const created = await api.createRequirement(draft);
      await load();
      return toRequirement(created);
    },
    [load],
  );

  const updateRequirement = useCallback(
    async (id: string, patch: Partial<RequirementDraft>) => {
      const updated = await api.updateRequirement(Number(id), patch);
      await load();
      return toRequirement(updated);
    },
    [load],
  );

  // Retiring is `isActive: false` on the same endpoint: the server has one
  // lifecycle flag, so a need that has been met and one that no longer applies
  // are the same state. The row stays; only the listing drops it.
  const retireRequirement = useCallback(
    async (id: string) => {
      await api.updateRequirement(Number(id), { isActive: false });
      await load();
    },
    [load],
  );

  // And back again, through the same field on the same endpoint. Nothing was
  // deleted when it left the board, so nothing has to be recreated.
  const reopenRequirement = useCallback(
    async (id: string) => {
      await api.updateRequirement(Number(id), { isActive: true });
      await load();
    },
    [load],
  );

  const updateDonationStatus = useCallback(
    async (
      id: string,
      status: DonationStatus,
      options: { recipientId?: string; note?: string } = {},
    ) => {
      const updated = await api.updateStatus(Number(id), status, {
        recipientId: options.recipientId ? Number(options.recipientId) : undefined,
        note: options.note,
      });
      await load();
      return toDonation(updated);
    },
    [load],
  );

  const setAvailability = useCallback(
    async (isAvailable: boolean) => {
      await api.updateMyVolunteer({ isAvailable });
      await load();
    },
    [load],
  );

  const setRecipientVerified = useCallback(
    async (recipientId: string, verified: boolean) => {
      const id = Number(recipientId);
      await (verified ? api.verifyRecipient(id) : api.revokeVerification(id));
      await load();
    },
    [load],
  );

  const value = useMemo(
    () => ({
      state,
      refresh: load,
      createDonation,
      createRequirement,
      updateRequirement,
      retireRequirement,
      reopenRequirement,
      updateDonationStatus,
      setRecipientVerified,
      setAvailability,
      showToast,
      dismissToast,
    }),
    [
      state, load, createDonation, createRequirement, updateRequirement, retireRequirement,
      reopenRequirement, updateDonationStatus, setRecipientVerified, setAvailability,
      showToast, dismissToast,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * Resolve to `null` instead of throwing, for the role-gated slices. A donor
 * being refused the courier roster is the system working.
 */
async function optional<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 422)) return null;
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// ─── Selector hooks ───────────────────────────────────────────────────────────

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useDonations() {
  return useApp().state.donations;
}

export function useStats() {
  return useApp().state.stats;
}

export function useActivity() {
  return useApp().state.activity;
}

/**
 * The active demand board.
 *
 * Every screen that shows a *board* — the donor needs board, the mobile NGO
 * home — means the needs that are open now, so that stays what the plain hook
 * answers and the retired rows are opt-in through `useAllRequirements`. This
 * filter is presentation and not a security boundary: the server never sends a
 * donor an inactive row in the first place, whatever the client asks for. It is
 * defence in depth in the same way D-44 kept the portal's own `myRecipient`
 * filter after the endpoint started scoping by role.
 */
export function useRequirements() {
  const requirements = useApp().state.requirements;
  return useMemo(() => requirements.filter(r => r.isActive), [requirements]);
}

/**
 * Every standing need the server returned for this account, retired ones
 * included where it sent them — which is an `ngo` reading its own board, and
 * nobody else. The NGO requirements portal is the one screen that wants the
 * history, because reopening a need needs it listed first.
 */
export function useAllRequirements() {
  return useApp().state.requirements;
}

export function useRecipients() {
  return useApp().state.recipients;
}

export function useVolunteers() {
  return useApp().state.volunteers;
}

/** Loading / failure state of the initial fetch, for screens that show it. */
export function useLoadState() {
  const { state, refresh } = useApp();
  return { isLoading: state.isLoading, error: state.loadError, retry: refresh };
}

/**
 * The organisation the signed-in NGO account acts for, resolved out of the
 * recipient list. Null for every other role.
 */
export function useMyRecipient(): Recipient | null {
  const { user } = useAuth();
  const recipients = useRecipients();
  if (!user || user.role !== 'ngo' || !user.entityId) return null;
  return recipients.find(r => r.id === user.entityId) ?? null;
}

/**
 * The courier profile the signed-in volunteer account owns. Null for every
 * other role — and also for a volunteer whose roster the API will not serve,
 * since `/api/volunteers` is open to admins and kitchens only.
 */
export function useMyVolunteer(): Volunteer | null {
  const { user } = useAuth();
  const volunteers = useVolunteers();
  if (!user || user.role !== 'volunteer' || !user.entityId) return null;
  return volunteers.find(v => v.id === user.entityId) ?? null;
}
