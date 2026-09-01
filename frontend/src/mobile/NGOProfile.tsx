import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, LogOut, ShieldCheck, Clock } from 'lucide-react';
import { useMyRecipient } from '../context/AppContext';
import { useAuth, useCurrentUser } from '../context/AuthContext';
import { MSection, MDetail, MToggle } from './parts';

export default function NGOProfile() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const me = useMyRecipient();
  const { signOut } = useAuth();
  // Notification preferences have no server-side home yet, so they stay local.
  const [prefs, setPrefs] = useState({ pushMatches: true, onlyMatching: false, digest: true });
  const toggle = (k: keyof typeof prefs) => setPrefs(p => ({ ...p, [k]: !p[k] }));

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <section className="flex items-center gap-4 px-5 py-5 bg-white border-b border-gray-200">
        <span className="w-14 h-14 shrink-0 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg font-bold">
          {user.avatarInitials}
        </span>
        <div className="min-w-0">
          <h2 className="font-display font-semibold text-lg text-gray-900 truncate">
            {me?.name ?? user.organization ?? user.name}
          </h2>
          <p className="text-sm text-gray-500 truncate">{user.name}</p>
          {me?.isVerified ? (
            <span className="mt-1.5 m-chip bg-emerald-50 text-emerald-700">
              <ShieldCheck size={12} />
              Verified recipient
            </span>
          ) : (
            <span className="mt-1.5 m-chip bg-amber-50 text-amber-700">
              <Clock size={12} />
              Awaiting verification
            </span>
          )}
        </div>
      </section>

      {me && !me.isVerified && (
        <p className="px-5 py-3.5 text-sm text-amber-800 bg-amber-50 border-b border-amber-100 leading-relaxed">
          An administrator has to vouch for your organisation before it can accept donations. You
          can browse and post requirements in the meantime.
        </p>
      )}

      <MSection title="Organisation" />
      <MDetail label="Type" value={me?.type ?? '—'} />
      <MDetail label="Location" value={me?.location ?? 'Not set'} />
      <MDetail label="Daily capacity" value={me ? `${me.capacity} meals` : '—'} />
      <MDetail label="Reliability" value={me ? `${me.reliabilityScore}%` : '—'} />
      <MDetail label="Donations accepted" value={me?.acceptedDonations ?? 0} />
      <MDetail label="Contact" value={me?.phone ?? '—'} />
      <MDetail label="Email" value={user.email} />

      <MSection title="Notifications" />
      <MToggle
        label="Push new matches"
        checked={prefs.pushMatches}
        onChange={() => toggle('pushMatches')}
      />
      <MToggle
        label="Only alert above 85% match"
        checked={prefs.onlyMatching}
        onChange={() => toggle('onlyMatching')}
      />
      <MToggle label="Weekly intake digest" checked={prefs.digest} onChange={() => toggle('digest')} />

      <div className="p-5 space-y-2.5">
        <button type="button" className="m-btn-secondary" onClick={() => navigate('/m/ngo/impact')}>
          <BarChart2 size={16} />
          Intake impact
        </button>
        <button type="button" className="m-btn-secondary" onClick={handleSignOut}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </>
  );
}
