import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Repeat } from 'lucide-react';
import type { RoleConfig } from './nav';

/**
 * Chrome shared by every mobile portal: a header carrying the signed-in
 * identity, a scrolling body, and a tab bar mirroring the desktop sidebar.
 */
export default function MobileShell({ config }: { config: RoleConfig }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const active =
    config.tabs.find(t => t.to !== config.base && pathname.startsWith(t.to)) ??
    config.tabs[0];

  return (
    <>
      <header className="m-head items-center">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 truncate">
            {config.kicker}
          </p>
          <h1 className="mt-0.5 text-xl font-display font-semibold text-gray-900 truncate">
            {active.label.charAt(0) + active.label.slice(1).toLowerCase()}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/m')}
            aria-label="Switch role"
            className="w-9 h-9 rounded-full border border-gray-300 text-gray-500 flex items-center justify-center active:bg-gray-100"
          >
            <Repeat size={15} />
          </button>
          <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
            {config.initials}
          </span>
        </div>
      </header>

      <div className="m-body">
        <Outlet />
      </div>

      <nav className="m-tabs">
        {config.tabs.map(({ to, label, icon: Icon }) => {
          const isActive = to === active.to;
          return (
            <button
              key={to}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => navigate(to)}
              className={isActive ? 'm-tab m-tab-active' : 'm-tab'}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 1.9} />
              {label}
            </button>
          );
        })}
      </nav>
    </>
  );
}
