import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, Package, BarChart2, User, Menu, X, Leaf
} from 'lucide-react';
import { useState } from 'react';
import Sidebar from '../../components/Sidebar';
import ToastContainer from '../../components/ToastContainer';

const NAV_ITEMS = [
  { label: 'Dashboard',      path: '/donor',          icon: LayoutDashboard },
  { label: 'My Donations',   path: '/donor/donations', icon: Package },
  { label: 'Create Donation', path: '/donor/create',   icon: PlusCircle },
  { label: 'Impact',         path: '/donor/impact',    icon: BarChart2 },
  { label: 'Profile',        path: '/donor/profile',   icon: User },
];

export default function DonorLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar
        items={NAV_ITEMS}
        userName="Aayushi Sharma"
        userRole="Donor"
        userInitials="AS"
        basePath="/donor"
      />

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-700 rounded-full flex items-center justify-center">
                  <Leaf size={15} className="text-white" />
                </div>
                <span className="font-display font-semibold text-gray-900">FoodLink <span className="text-emerald-600">AI</span></span>
              </div>
              <button onClick={() => setMobileOpen(false)}>
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  >
                    <Icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100">
            <Menu size={20} />
          </button>
          <span className="font-display font-semibold text-gray-900">FoodLink AI</span>
          <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold">AS</div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
