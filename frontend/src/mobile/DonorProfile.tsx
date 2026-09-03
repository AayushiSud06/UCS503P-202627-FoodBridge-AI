import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldCheck } from 'lucide-react';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { MSection, MDetail } from './parts';

export default function DonorProfile() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { signOut } = useAuth();

  const details: [string, string][] = [
    ['Organisation', user.organization ?? '—'],
    ['Email', user.email],
    ['Account', `#${user.id}`],
  ];

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          AS
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">{user.name}</h2>
          <p className="text-sm text-gray-500 truncate">aayushi@thapar.edu</p>
          <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
            <ShieldCheck size={12} />
            Verified donor
          </span>
        </div>
      </section>

      <MSection title="Organisation" />
      {details.map(([k, v]) => (
        <MDetail key={k} label={k} value={v} />
      ))}

      <div className="p-5">
        <button type="button" className="m-btn-secondary" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
