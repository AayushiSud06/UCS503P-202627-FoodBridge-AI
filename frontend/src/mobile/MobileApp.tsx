import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import './modernist.css';

import MobileShell, { DONOR_TABS } from './MobileShell';
import DonorHome from './DonorHome';
import DonorListings from './DonorListings';
import DonorImpact from './DonorImpact';
import DonorProfile from './DonorProfile';
import CreateDonationCamera from './CreateDonationCamera';
import NGOFeed from './NGOFeed';
import VolunteerTask from './VolunteerTask';

const ROLES: { to: string; kicker: string; name: string; blurb: string }[] = [
  { to: '/m/donor', kicker: 'Donor', name: 'College Central Mess', blurb: 'List surplus food in one photo and watch it get matched.' },
  { to: '/m/ngo', kicker: 'Recipient', name: 'Helping Hands Kitchen', blurb: 'Browse what is available nearby and accept the best match.' },
  { to: '/m/volunteer', kicker: 'Courier', name: 'Aarav Sharma', blurb: 'One active pickup, one action at a time.' },
];

function RolePicker() {
  const navigate = useNavigate();
  return (
    <>
      <header className="m-head">
        <div>
          <div className="m-kicker">FoodLink AI</div>
          <h3 style={{ marginTop: 4 }}>Who are you<br />signing in as?</h3>
        </div>
      </header>
      <div className="m-body">
        {ROLES.map(r => (
          <button key={r.to} type="button" className="m-row" onClick={() => navigate(r.to)} style={{ padding: '18px' }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="m-label">{r.kicker}</span>
              <span style={{ display: 'block', fontWeight: 800, fontSize: 19, lineHeight: 1.2, marginTop: 3 }}>{r.name}</span>
              <span className="m-muted" style={{ display: 'block', marginTop: 4 }}>{r.blurb}</span>
            </span>
            <ChevronRight size={18} style={{ marginTop: 22, flex: 'none', color: 'rgba(32,30,29,.4)' }} />
          </button>
        ))}
        <p className="m-muted" style={{ padding: 18 }}>
          Stands in for login. Every role reads and writes the same store as the desktop portals.
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
        <Route
          path="donor"
          element={<MobileShell kicker="College Central Mess" title="Good afternoon, Aayushi" initials="AS" tabs={DONOR_TABS} />}
        >
          <Route index element={<DonorHome />} />
          <Route path="listings" element={<DonorListings />} />
          <Route path="impact" element={<DonorImpact />} />
          <Route path="profile" element={<DonorProfile />} />
        </Route>
        <Route path="donor/create" element={<CreateDonationCamera />} />
        <Route path="ngo" element={<NGOFeed />} />
        <Route path="volunteer" element={<VolunteerTask />} />
        <Route path="*" element={<Navigate to="/m" replace />} />
      </Routes>
    </div>
  );
}
