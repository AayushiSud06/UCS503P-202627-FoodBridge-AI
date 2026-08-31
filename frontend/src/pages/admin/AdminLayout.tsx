import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Package, Building2, Users, BarChart2,
  Leaf, Menu, X, LogOut
} from 'lucide-react';
import ToastContainer from '../../components/ToastContainer';

const NAV_ITEMS = [
  { label: 'Overview',       path: '/admin',             icon: LayoutDashboard },
  { label: 'Donations',      path: '/admin/donations',   icon: Package },
  { label: 'Organizations',  path: '/admin/orgs',        icon: Building2 },
  { label: 'Volunteers',     path: '/admin/volunteers',  icon: Users },
  { label: 'Analytics',      path: '/admin/analytics',   icon: BarChart2 },
];

export default function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-gray-900 text-gray-100 shrink-0">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-gray-800">
          <div className="w-8 h-8 bg-emerald-700 rounded-full flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <div>
            <span className="text-base font-display font-semibold text-white">FoodLink <span className="text-emerald-400">AI</span></span>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== '/admin' && location.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">AD</div>
            <div>
              <p className="text-sm font-semibold text-white">Admin</p>
              <p className="text-xs text-gray-500">Platform Manager</p>
            </div>
          </div>
          <Link to="/login" className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 hover:text-red-400 hover:bg-gray-800 rounded-lg transition-colors">
            <LogOut size={16} /> Sign out
          </Link>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative w-64 bg-gray-900 flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-emerald-700 rounded-full flex items-center justify-center"><Leaf size={15} className="text-white" /></div>
                <span className="font-display font-semibold text-white">FoodLink <span className="text-emerald-400">AI</span></span>
              </div>
              <button onClick={() => setMobileOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                    <Icon size={18} />{item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-800">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-800"><Menu size={20} /></button>
          <span className="font-display font-semibold">FoodLink AI — Admin</span>
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-gray-300">AD</div>
        </div>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto"><Outlet /></main>
      </div>
      <ToastContainer />
    </div>
  );
}
