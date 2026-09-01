import type { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MobileShell from './MobileShell';
import { ROLE_CONFIG } from './nav';
import ToastContainer from '../components/ToastContainer';
import { useCurrentUser } from '../context/AuthContext';
import type { UserRole } from '../types';

import DonorHome from './DonorHome';
import DonorListings from './DonorListings';
import DonorImpact from './DonorImpact';
import DonorProfile from './DonorProfile';
import CreateDonationCamera from './CreateDonationCamera';

import NGOHome from './NGOHome';
import NGOAvailable from './NGOAvailable';
import NGOAccepted from './NGOAccepted';
import NGORequirements from './NGORequirements';
import NGOImpact from './NGOImpact';
import NGOProfile from './NGOProfile';

import VolunteerHome from './VolunteerHome';
import VolunteerTasks from './VolunteerTasks';
import VolunteerHistory from './VolunteerHistory';
import VolunteerImpact from './VolunteerImpact';
import VolunteerProfile from './VolunteerProfile';

import AdminHome from './AdminHome';
import AdminDonations from './AdminDonations';
import AdminOrgs from './AdminOrgs';
import AdminVolunteers from './AdminVolunteers';
import AdminAnalytics from './AdminAnalytics';

/** Where each role's phone portal lives. */
const MOBILE_HOME: Record<UserRole, string> = {
  donor: '/m/donor',
  ngo: '/m/ngo',
  volunteer: '/m/volunteer',
  admin: '/m/admin',
};

/**
 * Keeps a portal from rendering for an account that does not hold the role.
 * `/m` itself is a redirect: the account decides which portal opens, so there
 * is nothing to pick.
 */
function MobileRole({ allow, children }: { allow: UserRole; children: ReactNode }) {
  const user = useCurrentUser();
  if (user.role !== allow && user.role !== 'admin') {
    return <Navigate to={MOBILE_HOME[user.role]} replace />;
  }
  return <>{children}</>;
}

export default function MobileApp() {
  const user = useCurrentUser();

  return (
    <div className="m-app">
      <Routes>
        <Route index element={<Navigate to={MOBILE_HOME[user.role]} replace />} />

        <Route
          path="donor"
          element={
            <MobileRole allow="donor">
              <MobileShell config={ROLE_CONFIG.donor} />
            </MobileRole>
          }
        >
          <Route index element={<DonorHome />} />
          <Route path="listings" element={<DonorListings />} />
          <Route path="create" element={<CreateDonationCamera />} />
          <Route path="impact" element={<DonorImpact />} />
          <Route path="profile" element={<DonorProfile />} />
        </Route>

        <Route
          path="ngo"
          element={
            <MobileRole allow="ngo">
              <MobileShell config={ROLE_CONFIG.ngo} />
            </MobileRole>
          }
        >
          <Route index element={<NGOHome />} />
          <Route path="available" element={<NGOAvailable />} />
          <Route path="accepted" element={<NGOAccepted />} />
          <Route path="requirements" element={<NGORequirements />} />
          <Route path="impact" element={<NGOImpact />} />
          <Route path="profile" element={<NGOProfile />} />
        </Route>

        <Route
          path="volunteer"
          element={
            <MobileRole allow="volunteer">
              <MobileShell config={ROLE_CONFIG.volunteer} />
            </MobileRole>
          }
        >
          <Route index element={<VolunteerHome />} />
          <Route path="tasks" element={<VolunteerTasks />} />
          <Route path="history" element={<VolunteerHistory />} />
          <Route path="impact" element={<VolunteerImpact />} />
          <Route path="profile" element={<VolunteerProfile />} />
        </Route>

        <Route
          path="admin"
          element={
            <MobileRole allow="admin">
              <MobileShell config={ROLE_CONFIG.admin} />
            </MobileRole>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="donations" element={<AdminDonations />} />
          <Route path="orgs" element={<AdminOrgs />} />
          <Route path="volunteers" element={<AdminVolunteers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>

        <Route path="*" element={<Navigate to="/m" replace />} />
      </Routes>

      {/* Lifts the shared toast stack clear of the tab bar. */}
      <div className="m-toasts">
        <ToastContainer />
      </div>
    </div>
  );
}
