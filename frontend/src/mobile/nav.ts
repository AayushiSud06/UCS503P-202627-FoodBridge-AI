import {
  Home, Package, PlusCircle, BarChart2, User, CheckSquare, ClipboardList,
  Truck, History, Building2, Users, LayoutDashboard, type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '../types';

/**
 * Mobile tab bars mirror the desktop sidebars defined in each role's Layout.
 * A phone tab bar tops out at five comfortable targets, so where the desktop
 * sidebar has more entries the overflow moves inside a screen rather than
 * getting dropped — Donor's "Create" is a primary action on Home and a FAB,
 * not a tab.
 */

export interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface RoleConfig {
  role: UserRole;
  /** Small caps line above the screen title. */
  kicker: string;
  /** Signed-in identity mirrored from the desktop layout. */
  userName: string;
  initials: string;
  base: string;
  tabs: Tab[];
}

export const DONOR_TABS: Tab[] = [
  { to: '/m/donor',          label: 'HOME',     icon: Home },
  { to: '/m/donor/listings', label: 'LISTINGS', icon: Package },
  { to: '/m/donor/create',   label: 'DONATE',   icon: PlusCircle },
  { to: '/m/donor/impact',   label: 'IMPACT',   icon: BarChart2 },
  { to: '/m/donor/profile',  label: 'PROFILE',  icon: User },
];

export const NGO_TABS: Tab[] = [
  { to: '/m/ngo',             label: 'HOME',      icon: Home },
  { to: '/m/ngo/available',   label: 'AVAILABLE', icon: Package },
  { to: '/m/ngo/accepted',    label: 'ACCEPTED',  icon: CheckSquare },
  { to: '/m/ngo/requirements',label: 'NEEDS',     icon: ClipboardList },
  { to: '/m/ngo/profile',     label: 'PROFILE',   icon: User },
];

export const VOLUNTEER_TABS: Tab[] = [
  { to: '/m/volunteer',         label: 'HOME',    icon: Home },
  { to: '/m/volunteer/tasks',   label: 'TASKS',   icon: Truck },
  { to: '/m/volunteer/history', label: 'HISTORY', icon: History },
  { to: '/m/volunteer/impact',  label: 'IMPACT',  icon: BarChart2 },
  { to: '/m/volunteer/profile', label: 'PROFILE', icon: User },
];

export const ADMIN_TABS: Tab[] = [
  { to: '/m/admin',            label: 'OVERVIEW',  icon: LayoutDashboard },
  { to: '/m/admin/donations',  label: 'DONATIONS', icon: Package },
  { to: '/m/admin/orgs',       label: 'ORGS',      icon: Building2 },
  { to: '/m/admin/volunteers', label: 'COURIERS',  icon: Users },
  { to: '/m/admin/analytics',  label: 'ANALYTICS', icon: BarChart2 },
];

export const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  donor: {
    role: 'donor',
    kicker: 'College Central Mess',
    userName: 'Aayushi Sharma',
    initials: 'AS',
    base: '/m/donor',
    tabs: DONOR_TABS,
  },
  ngo: {
    role: 'ngo',
    kicker: 'Helping Hands Kitchen',
    userName: 'Raj Malhotra',
    initials: 'HH',
    base: '/m/ngo',
    tabs: NGO_TABS,
  },
  volunteer: {
    role: 'volunteer',
    kicker: 'Courier',
    userName: 'Aarav Sharma',
    initials: 'AS',
    base: '/m/volunteer',
    tabs: VOLUNTEER_TABS,
  },
  admin: {
    role: 'admin',
    kicker: 'FoodLink Platform',
    userName: 'Admin Controller',
    initials: 'AC',
    base: '/m/admin',
    tabs: ADMIN_TABS,
  },
};

/** Demo identities, mirrored from `data/mockData.ts`. */
export const DONOR_ID = 'u-donor-1';
export const VOLUNTEER_ID = 'v-1';
export const VOLUNTEER_NAME = 'Aarav Sharma';
