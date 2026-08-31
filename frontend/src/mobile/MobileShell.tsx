import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, Package, BarChart2, User, type LucideIcon } from 'lucide-react';

export interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const DONOR_TABS: Tab[] = [
  { to: '/m/donor', label: 'HOME', icon: Home },
  { to: '/m/donor/listings', label: 'LISTINGS', icon: Package },
  { to: '/m/donor/impact', label: 'IMPACT', icon: BarChart2 },
  { to: '/m/donor/profile', label: 'PROFILE', icon: User },
];

interface Props {
  kicker: string;
  title: string;
  initials: string;
  tabs: Tab[];
}

export default function MobileShell({ kicker, title, initials, tabs }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <header className="m-head">
        <div>
          <div className="m-kicker">{kicker}</div>
          <h3 style={{ marginTop: 4 }}>{title}</h3>
        </div>
        <div
          style={{
            width: 38, height: 38, flex: 'none', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-text)', color: 'var(--color-bg)',
            fontWeight: 800, fontSize: 12,
          }}
        >
          {initials}
        </div>
      </header>

      <div className="m-body">
        <Outlet />
      </div>

      <nav className="m-tabs">
        {tabs.map(({ to, label, icon: Icon }) => (
          <button
            key={to}
            type="button"
            className="m-tab"
            aria-current={pathname === to ? 'page' : undefined}
            onClick={() => navigate(to)}
          >
            <Icon size={19} />
            {label}
          </button>
        ))}
      </nav>
    </>
  );
}
