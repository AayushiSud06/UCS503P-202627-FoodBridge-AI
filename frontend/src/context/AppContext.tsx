import React, {
  createContext, useContext, useReducer, useCallback, useRef, type ReactNode
} from 'react';
import type { Donation, DonationStatus, ActivityLog, AppStats, NGORequirement } from '../types';
import {
  INITIAL_DONATIONS, INITIAL_ACTIVITY, INITIAL_STATS, INITIAL_REQUIREMENTS, MOCK_RECIPIENTS
} from '../data/mockData';

// ─── State ────────────────────────────────────────────────────────────────────

interface AppState {
  donations: Donation[];
  requirements: NGORequirement[];
  activity: ActivityLog[];
  stats: AppStats;
  toasts: Toast[];
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  subtitle?: string;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type AppAction =
  | { type: 'ADD_DONATION'; donation: Donation }
  | { type: 'UPDATE_DONATION_STATUS'; id: string; status: DonationStatus; extraFields?: Partial<Donation> }
  | { type: 'ADD_REQUIREMENT'; requirement: NGORequirement }
  | { type: 'ADD_TOAST'; toast: Toast }
  | { type: 'REMOVE_TOAST'; id: string };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_DONATION': {
      const newStats = {
        ...state.stats,
        totalDonations: state.stats.totalDonations + 1,
        activeDonations: state.stats.activeDonations + 1,
      };
      const newActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'donation_created',
        message: `New donation: ${action.donation.quantity} ${action.donation.unit} of ${action.donation.foodName} from ${action.donation.donorOrganization}`,
        donationId: action.donation.id,
      };
      return {
        ...state,
        donations: [action.donation, ...state.donations],
        activity: [newActivity, ...state.activity],
        stats: newStats,
      };
    }

    case 'ADD_REQUIREMENT': {
      return {
        ...state,
        requirements: [action.requirement, ...state.requirements],
      };
    }

    case 'UPDATE_DONATION_STATUS': {
      const now = new Date().toISOString();
      const updatedDonations = state.donations.map(d => {
        if (d.id !== action.id) return d;
        const updates: Partial<Donation> = {
          status: action.status,
          ...action.extraFields,
        };

        // Auto-populate timestamps for each transition
        if (action.status === 'MATCHED' && !d.matchedAt) updates.matchedAt = now;
        if (action.status === 'ACCEPTED' && !d.acceptedAt) updates.acceptedAt = now;
        if (action.status === 'VOLUNTEER_ASSIGNED' && !d.volunteerAssignedAt) updates.volunteerAssignedAt = now;
        if (action.status === 'PICKED_UP' && !d.pickedUpAt) updates.pickedUpAt = now;
        if (action.status === 'DELIVERED' && !d.deliveredAt) updates.deliveredAt = now;
        if (action.status === 'COMPLETED') {
          if (!d.deliveredAt) updates.deliveredAt = now;
          if (!d.completedAt) updates.completedAt = now;
        }

        return { ...d, ...updates };
      });

      // Calculate aggregated metrics
      const completedList = updatedDonations.filter(d => d.status === 'COMPLETED');
      const activeList = updatedDonations.filter(
        d => !['COMPLETED', 'CANCELLED'].includes(d.status)
      );
      
      const newlyAddedMeals = completedList.reduce((sum, d) => sum + d.quantity, 0);
      const totalMeals = 4800 + newlyAddedMeals;

      // Build activity log entry
      const donation = updatedDonations.find(d => d.id === action.id);
      const recipientName = donation?.recipientName || 'Helping Hands Community Kitchen';
      const volunteerName = donation?.volunteerName || 'Volunteer';

      const activityMessages: Record<DonationStatus, string> = {
        AVAILABLE: `Donation #${action.id} is available for matching`,
        MATCHED: `AI matched Donation #${action.id} (${donation?.foodName}) with ${recipientName} (${donation?.matchScore ?? 94}% score)`,
        ACCEPTED: `${recipientName} accepted donation #${action.id} (${donation?.quantity} ${donation?.unit} of ${donation?.foodName})`,
        VOLUNTEER_ASSIGNED: `Volunteer ${volunteerName} assigned to pickup for #${action.id}`,
        PICKED_UP: `Donation #${action.id} picked up from ${donation?.donorOrganization} by ${volunteerName}`,
        DELIVERED: `Donation #${action.id} safely delivered to ${recipientName}`,
        COMPLETED: `Redistribution completed! ${donation?.quantity} ${donation?.unit} of ${donation?.foodName} served at ${recipientName}`,
        CANCELLED: `Donation #${action.id} was cancelled`,
      };

      const activityTypes: Record<DonationStatus, ActivityLog['type']> = {
        AVAILABLE: 'donation_created',
        MATCHED: 'donation_accepted',
        ACCEPTED: 'donation_accepted',
        VOLUNTEER_ASSIGNED: 'volunteer_assigned',
        PICKED_UP: 'picked_up',
        DELIVERED: 'delivered',
        COMPLETED: 'completed',
        CANCELLED: 'donation_created',
      };

      const newActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: now,
        type: activityTypes[action.status],
        message: activityMessages[action.status],
        donationId: action.id,
      };

      return {
        ...state,
        donations: updatedDonations,
        activity: [newActivity, ...state.activity],
        stats: {
          ...state.stats,
          completedDonations: completedList.length + 95,
          activeDonations: activeList.length,
          totalMeals,
          successfulPickups: ['DELIVERED', 'COMPLETED'].includes(action.status)
            ? state.stats.successfulPickups + 1
            : state.stats.successfulPickups,
        },
      };
    }

    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };

    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  addDonation: (donation: Donation) => void;
  addRequirement: (req: NGORequirement) => void;
  updateDonationStatus: (
    id: string,
    status: DonationStatus,
    extraFields?: Partial<Donation>
  ) => void;
  showToast: (type: Toast['type'], message: string, subtitle?: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const INITIAL_STATE: AppState = {
  donations: INITIAL_DONATIONS,
  requirements: INITIAL_REQUIREMENTS,
  activity: INITIAL_ACTIVITY,
  stats: INITIAL_STATS,
  toasts: [],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE);
  const toastTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const addDonation = useCallback((donation: Donation) => {
    // If not specified, attach AI match parameters to the donation
    const enrichedDonation: Donation = {
      ...donation,
      recipientId: donation.recipientId ?? 'r-1',
      recipientName: donation.recipientName ?? 'Helping Hands Community Kitchen',
      matchScore: donation.matchScore ?? 94,
      distanceKm: donation.distanceKm ?? 1.8,
      status: donation.status === 'AVAILABLE' ? 'MATCHED' : donation.status,
      matchedAt: donation.matchedAt ?? new Date().toISOString(),
    };
    dispatch({ type: 'ADD_DONATION', donation: enrichedDonation });
  }, []);

  const addRequirement = useCallback((requirement: NGORequirement) => {
    dispatch({ type: 'ADD_REQUIREMENT', requirement });
  }, []);

  const updateDonationStatus = useCallback(
    (id: string, status: DonationStatus, extraFields?: Partial<Donation>) => {
      dispatch({ type: 'UPDATE_DONATION_STATUS', id, status, extraFields });

      // Automatically advance DELIVERED → COMPLETED after 1.2s for clean demo presentation
      if (status === 'DELIVERED') {
        setTimeout(() => {
          dispatch({ type: 'UPDATE_DONATION_STATUS', id, status: 'COMPLETED' });
        }, 1200);
      }
    },
    []
  );

  const showToast = useCallback((type: Toast['type'], message: string, subtitle?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const toast: Toast = { id, type, message, subtitle };
    dispatch({ type: 'ADD_TOAST', toast });

    // Auto-dismiss after 4 seconds
    toastTimers.current[id] = setTimeout(() => {
      dispatch({ type: 'REMOVE_TOAST', id });
      delete toastTimers.current[id];
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    if (toastTimers.current[id]) {
      clearTimeout(toastTimers.current[id]);
      delete toastTimers.current[id];
    }
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  return (
    <AppContext.Provider value={{ state, addDonation, addRequirement, updateDonationStatus, showToast, dismissToast }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Selector Hooks ───────────────────────────────────────────────────────────

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

export function useRequirements() {
  return useApp().state.requirements;
}
