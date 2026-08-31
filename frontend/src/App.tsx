import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';

// Public Pages
import Landing from './pages/Landing';
import Login from './pages/Login';

// Donor
import DonorLayout from './pages/donor/DonorLayout';
import DonorDashboard from './pages/donor/DonorDashboard';
import DonorDonations from './pages/donor/DonorDonations';
import CreateDonation from './pages/donor/CreateDonation';
import DonationDetails from './pages/donor/DonationDetails';
import DonorImpact from './pages/donor/DonorImpact';
import DonorProfile from './pages/donor/DonorProfile';

// NGO
import NGOLayout from './pages/ngo/NGOLayout';
import NGODashboard from './pages/ngo/NGODashboard';
import NGOAvailableDonations from './pages/ngo/NGOAvailableDonations';
import NGOAcceptedDonations from './pages/ngo/NGOAcceptedDonations';
import NGORequirements from './pages/ngo/NGORequirements';
import NGOImpact from './pages/ngo/NGOImpact';
import NGOProfile from './pages/ngo/NGOProfile';

// Volunteer
import VolunteerLayout from './pages/volunteer/VolunteerLayout';
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard';
import VolunteerTasks from './pages/volunteer/VolunteerTasks';
import VolunteerHistory from './pages/volunteer/VolunteerHistory';
import VolunteerImpact from './pages/volunteer/VolunteerImpact';
import VolunteerProfile from './pages/volunteer/VolunteerProfile';

// Admin
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDonations from './pages/admin/AdminDonations';
import AdminOrganizations from './pages/admin/AdminOrganizations';
import AdminVolunteers from './pages/admin/AdminVolunteers';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import MobileApp from './mobile/MobileApp';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          {/* Donor Portal */}
          <Route path="/donor" element={<DonorLayout />}>
            <Route index element={<DonorDashboard />} />
            <Route path="donations" element={<DonorDonations />} />
            <Route path="donations/:id" element={<DonationDetails />} />
            <Route path="create" element={<CreateDonation />} />
            <Route path="impact" element={<DonorImpact />} />
            <Route path="profile" element={<DonorProfile />} />
          </Route>

          {/* NGO / Recipient Portal */}
          <Route path="/ngo" element={<NGOLayout />}>
            <Route index element={<NGODashboard />} />
            <Route path="available" element={<NGOAvailableDonations />} />
            <Route path="available/:id" element={<NGOAvailableDonations />} />
            <Route path="accepted" element={<NGOAcceptedDonations />} />
            <Route path="requirements" element={<NGORequirements />} />
            <Route path="impact" element={<NGOImpact />} />
            <Route path="profile" element={<NGOProfile />} />
          </Route>

          {/* Volunteer Courier Portal */}
          <Route path="/volunteer" element={<VolunteerLayout />}>
            <Route index element={<VolunteerDashboard />} />
            <Route path="tasks" element={<VolunteerTasks />} />
            <Route path="history" element={<VolunteerHistory />} />
            <Route path="impact" element={<VolunteerImpact />} />
            <Route path="profile" element={<VolunteerProfile />} />
          </Route>

          {/* Platform Administrator */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="donations" element={<AdminDonations />} />
            <Route path="orgs" element={<AdminOrganizations />} />
            <Route path="volunteers" element={<AdminVolunteers />} />
            <Route path="analytics" element={<AdminAnalytics />} />
          </Route>
	
 	 {/* Mobile web */}
          <Route path="/m/*" element={<MobileApp />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
