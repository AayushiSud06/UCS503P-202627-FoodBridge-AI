import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Leaf, Mail, Lock, ArrowRight, ShieldCheck, Users, Heart, Store, AlertCircle, User as UserIcon,
  Building2, Eye, EyeOff,
} from 'lucide-react';
import type { UserRole } from '../types';
import { HOME_PATH, errorMessage, useAuth } from '../context/AuthContext';

interface RoleOption {
  role: UserRole;
  label: string;
  icon: typeof Leaf;
  description: string;
}

const ROLES: RoleOption[] = [
  { role: 'donor', label: 'Donor', icon: Store, description: 'I have surplus food to donate' },
  { role: 'ngo', label: 'Recipient', icon: Heart, description: 'I represent a recipient organization' },
  { role: 'volunteer', label: 'Volunteer', icon: Users, description: 'I help with food pickup & delivery' },
  { role: 'admin', label: 'Admin', icon: ShieldCheck, description: 'I manage the platform' },
];

/** Roles a visitor may sign themselves up as. Administrators are appointed. */
const SIGNUP_ROLES = ROLES.filter(r => r.role !== 'admin');

/**
 * The three steps a donation passes through, worded as the public page words
 * them. Nothing here is a figure or a total — this screen has no data source
 * of its own, and asserts none.
 */
const STEPS = [
  { n: '01', title: 'Donate', desc: 'Surplus is listed with a quantity, a location and a pickup window.' },
  { n: '02', title: 'Match', desc: 'Five published criteria rank the verified organizations nearby.' },
  { n: '03', title: 'Deliver', desc: 'A volunteer carries it the last mile; the server stamps every step.' },
];

type Mode = 'signin' | 'signup';

/**
 * Login / registration.
 *
 * The role tiles do not decide where you land — the account does, through
 * `HOME_PATH`. They choose the role being registered in sign-up, and a choice
 * made in sign-in carries over if the visitor switches. `admin` is absent from
 * sign-up because the API refuses it: administrators are created from the
 * command line or by another administrator, never by a stranger filling in a
 * form.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, expiredMessage, clearExpiredMessage } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Where they were headed before being bounced to the login screen.
  const from = (location.state as { from?: string } | null)?.from;

  // Already signed in (or just signed in): go to the portal for the role.
  useEffect(() => {
    if (user) navigate(from ?? HOME_PATH[user.role], { replace: true });
  }, [user, from, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    clearExpiredMessage();

    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Enter your name.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'signin') {
        await signIn(email, password);
      } else {
        await signUp({
          name: name.trim(),
          email: email.trim(),
          password,
          role: selectedRole as Exclude<UserRole, 'admin'>,
          organization: organization.trim() || null,
        });
      }
      // The redirect happens in the effect above, once `user` lands.
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickRole = (role: RoleOption) => {
    setSelectedRole(role.role);
    setError(null);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setShowPassword(false);
    clearExpiredMessage();
    if (next === 'signup') {
      setEmail('');
      setPassword('');
      if (selectedRole === 'admin') setSelectedRole('donor');
    }
  };

  const visibleRoles = mode === 'signup' ? SIGNUP_ROLES : ROLES;
  const activeRole = visibleRoles.find(r => r.role === selectedRole) ?? visibleRoles[0];

  return (
    <div className="min-h-screen bg-[#FBF8F3] flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl">
        <div className="card overflow-hidden rounded-3xl lg:grid lg:grid-cols-[0.9fr,1fr]">

          {/* ── Brand panel ─────────────────────────────────────────────────
              Desktop only. The wordmark moves inline above the heading below
              `lg`, so a phone never loses it. */}
          <aside className="hidden lg:flex flex-col justify-between bg-emerald-800 p-10 xl:p-12 text-emerald-50">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50/15 ring-1 ring-emerald-50/25">
                  <Leaf size={18} className="text-emerald-50" />
                </span>
                <span className="font-display text-xl font-semibold tracking-tight">
                  FoodLink <span className="text-emerald-200">AI</span>
                </span>
              </div>

              <h2 className="mt-14 font-display text-4xl font-medium leading-[1.1] tracking-tight text-emerald-50">
                Good food,
                <br />
                <span className="italic text-emerald-200">redirected</span>.
              </h2>
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-emerald-100/80">
                Surplus matched to verified community organizations — and to the volunteers
                who can carry it there.
              </p>
            </div>

            <dl className="mt-14 border-t border-emerald-50/15">
              {STEPS.map(step => (
                <div key={step.n} className="flex gap-4 border-b border-emerald-50/15 py-4">
                  <dt className="w-5 shrink-0 pt-0.5 font-display text-xs text-emerald-300">{step.n}</dt>
                  <dd className="min-w-0">
                    <p className="text-sm font-semibold text-emerald-50">{step.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-100/70">{step.desc}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </aside>

          {/* ── Form column ─────────────────────────────────────────────── */}
          <div className="p-6 sm:p-9 lg:flex lg:flex-col lg:justify-center lg:p-10">
            <div className="mb-7 flex items-center gap-2.5 lg:hidden">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 shadow-sm">
                <Leaf size={18} className="text-white" />
              </span>
              <span className="font-display text-xl font-semibold text-gray-900">
                FoodLink <span className="text-emerald-700">AI</span>
              </span>
            </div>

            <h1 className="font-display text-[1.7rem] sm:text-3xl font-medium text-gray-900">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              {mode === 'signin'
                ? 'Sign in to continue to your side of the handover'
                : 'Join FoodLink to give or receive surplus food'}
            </p>

            {/* Session ended elsewhere — say so before they wonder why they are here. */}
            {expiredMessage && (
              <div
                role="status"
                className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="text-xs text-amber-800">{expiredMessage}</p>
              </div>
            )}

            {/* Role selector */}
            <div className="mt-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                {mode === 'signin' ? 'Continue as' : 'I am signing up as'}
              </p>
              <div className="mt-2.5 flex gap-2">
                {visibleRoles.map((role) => {
                  const Icon = role.icon;
                  const isActive = selectedRole === role.role;
                  return (
                    <button
                      key={role.role}
                      type="button"
                      onClick={() => pickRole(role)}
                      aria-pressed={isActive}
                      className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl border px-1.5 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                        isActive
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                          : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                      id={`role-${role.role}`}
                    >
                      <Icon size={17} className={isActive ? 'text-emerald-700' : 'text-gray-400'} />
                      <span className="w-full truncate text-center text-[11px] font-semibold leading-none">
                        {role.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-xs text-gray-500">{activeRole.description}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <>
                  <div>
                    <label htmlFor="name" className="label">Your name</label>
                    <div className="relative">
                      <UserIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="input-field pl-9"
                        placeholder="Priya Singh"
                        autoComplete="name"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="organization" className="label">
                      {selectedRole === 'ngo' ? 'Organisation name' : 'Organisation'}
                      {selectedRole === 'volunteer' && (
                        <span className="font-normal text-gray-400"> (optional)</span>
                      )}
                    </label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        id="organization"
                        type="text"
                        value={organization}
                        onChange={e => setOrganization(e.target.value)}
                        className="input-field pl-9"
                        placeholder={
                          selectedRole === 'ngo' ? 'Helping Hands Community Kitchen' : 'College Central Mess'
                        }
                        autoComplete="organization"
                      />
                    </div>
                    {selectedRole === 'ngo' && (
                      <p className="mt-1.5 text-xs text-gray-400">
                        Your kitchen starts unverified. An administrator vouches for it before it
                        can accept donations.
                      </p>
                    )}
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="label">Email address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input-field pl-9"
                    placeholder="you@example.com"
                    autoComplete="email"
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input-field pl-9 pr-11"
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    aria-describedby={error ? 'login-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <p className="mt-1.5 text-xs text-gray-400">At least 8 characters.</p>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  id="login-error"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
                >
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <button
                id="btn-signin"
                type="submit"
                disabled={isSubmitting}
                className="btn-primary mt-2 w-full justify-center py-3 text-sm disabled:opacity-60"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {mode === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-100 pt-5 text-center">
              {mode === 'signin' ? (
                <p className="text-xs text-gray-500">
                  New here?{' '}
                  <button
                    type="button"
                    id="btn-switch-signup"
                    onClick={() => switchMode('signup')}
                    className="rounded font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    Create an account
                  </button>
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    id="btn-switch-signin"
                    onClick={() => switchMode('signin')}
                    className="rounded font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    Sign in instead
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
