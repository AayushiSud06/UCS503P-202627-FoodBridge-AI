import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight, Leaf } from 'lucide-react';

import MobileShell from './MobileShell';
import { ROLE_CONFIG } from './nav';
import ToastContainer from '../components/ToastContainer';

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

const ROLES = [
  { to: '/m/donor', kicker: 'Donor', name: 'College Central Mess', blurb: 'List surplus food in one photo and watch it get matched.' },
  { to: '/m/ngo', kicker: 'Recipient', name: 'Helping Hands Kitchen', blurb: 'Browse what is available nearby and accept the best match.' },
  { to: '/m/volunteer', kicker: 'Courier', name: 'Aarav Sharma', blurb: 'Claim a pickup and move it through to delivery.' },
  { to: '/m/admin', kicker: 'Administrator', name: 'FoodLink Platform', blurb: 'Watch throughput, organisations and couriers across the platform.' },
];

function RolePicker() {
  const navigate = useNavigate();
  return (
    <>
      <header className="m-head">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center">
              <Leaf size={15} className="text-white" />
            </span>
            <span className="font-display font-semibold text-gray-900">
              FoodLink <span className="text-emerald-600">AI</span>
            </span>
          </div>
          <h1 className="mt-3 text-2xl font-display font-semibold text-gray-900 leading-tight">
            Who are you
            <br />
            signing in as?
          </h1>
        </div>
      </header>

      <div className="m-body">
        {ROLES.map(r => (
          <button
            key={r.to}
            type="button"
            onClick={() => navigate(r.to)}
            className="w-full text-left flex items-start gap-3 px-5 py-4 bg-white border-b border-gray-100 active:bg-gray-50"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wider text-emerald-700">
                {r.kicker}
              </span>
              <span className="block mt-1 font-display font-semibold text-lg text-gray-900 leading-snug">
                {r.name}
              </span>
              <span className="block mt-1 text-sm text-gray-500 leading-relaxed">{r.blurb}</span>
            </span>
            <ChevronRight size={18} className="text-gray-300 shrink-0 mt-6" />
          </button>
        ))}

        <p className="px-5 py-5 text-sm text-gray-500 leading-relaxed">
          Stands in for login. Every role reads and writes the same store as the desktop portals, so
          a donation listed here shows up there immediately.
        </p>
      </div>
    </>
  );
}

export default function MobileApp() {
  return (
    <div className="m-app">
      <Routes>
        <Route index element={<RolePicker />} />

        <Route path="donor" element={<MobileShell config={ROLE_CONFIG.donor} />}>
          <Route index element={<DonorHome />} />
          <Route path="listings" element={<DonorListings />} />
          <Route path="create" element={<CreateDonationCamera />} />
          <Route path="impact" element={<DonorImpact />} />
          <Route path="profile" element={<DonorProfile />} />
        </Route>

        <Route path="ngo" element={<MobileShell config={ROLE_CONFIG.ngo} />}>
          <Route index element={<NGOHome />} />
          <Route path="available" element={<NGOAvailable />} />
          <Route path="accepted" element={<NGOAccepted />} />
          <Route path="requirements" element={<NGORequirements />} />
          <Route path="impact" element={<NGOImpact />} />
          <Route path="profile" element={<NGOProfile />} />
        </Route>

        <Route path="volunteer" element={<MobileShell config={ROLE_CONFIG.volunteer} />}>
          <Route index element={<VolunteerHome />} />
          <Route path="tasks" element={<VolunteerTasks />} />
          <Route path="history" element={<VolunteerHistory />} />
          <Route path="impact" element={<VolunteerImpact />} />
          <Route path="profile" element={<VolunteerProfile />} />
        </Route>

        <Route path="admin" element={<MobileShell config={ROLE_CONFIG.admin} />}>
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
