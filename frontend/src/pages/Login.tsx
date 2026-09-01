import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Leaf, Mail, Lock, ArrowRight, ShieldCheck, Users, Heart, Store, AlertCircle, User as UserIcon,
  Building2,
} from 'lucide-react';
import type { UserRole } from '../types';
import { HOME_PATH, errorMessage, useAuth } from '../context/AuthContext';

interface RoleOption {
  role: UserRole;
  label: string;
  icon: typeof Leaf;
  description: string;
  color: string;
  activeColor: string;
  /** Seed account for this role, so a demo does not start with a password hunt. */
  demoEmail?: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'donor',
    label: 'Donor',
    icon: Store,
    description: 'I have surplus food to donate',
    color: 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50',
    activeColor: 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200',
    demoEmail: 'aayushi@thapar.edu',
  },
  {
    role: 'ngo',
    label: 'Recipient',
    icon: Heart,
    description: 'I represent a recipient organization',
    color: 'border-gray-200 hover:border-clay-300 hover:bg-clay-50',
    activeColor: 'border-clay-500 bg-clay-50 ring-2 ring-clay-200',
    demoEmail: 'raj@helpinghands.org',
  },
  {
    role: 'volunteer',
    label: 'Volunteer',
    icon: Users,
    description: 'I help with food pickup & delivery',
    color: 'border-gray-200 hover:border-sky-300 hover:bg-sky-50',
    activeColor: 'border-sky-500 bg-sky-50 ring-2 ring-sky-200',
    demoEmail: 'aarav@thapar.edu',
  },
  {
    role: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    description: 'I manage the platform',
    color: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    activeColor: 'border-gray-600 bg-gray-50 ring-2 ring-gray-200',
    demoEmail: 'admin@foodlink.ai',
  },
];

/** Roles a visitor may sign themselves up as. Administrators are appointed. */
const SIGNUP_ROLES = ROLES.filter(r => r.role !== 'admin');

const DEMO_PASSWORD = 'foodlink123';

type Mode = 'signin' | 'signup';

/**
 * Login / registration.
 *
 * The role tiles no longer decide where you land — the account does. In
 * sign-in they fill the matching demo account, and in sign-up they choose the
 * role being registered. `admin` is absent from sign-up because the API
 * refuses it: administrators are created from the command line or by another
 * administrator, never by a stranger filling in a form.
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, expiredMessage, clearExpiredMessage } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    // In sign-in the tiles are a shortcut to the seeded demo accounts.
    if (mode === 'signin' && role.demoEmail) {
      setEmail(role.demoEmail);
      setPassword(DEMO_PASSWORD);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    clearExpiredMessage();
    if (next === 'signup') {
      setEmail('');
      setPassword('');
      if (selectedRole === 'admin') setSelectedRole('donor');
    }
  };

  const visibleRoles = mode === 'signup' ? SIGNUP_ROLES : ROLES;

  return (
    <div className="min-h-screen bg-[#FBF8F3] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 bg-emerald-700 rounded-full flex items-center justify-center shadow-md">
              <Leaf size={20} className="text-white" />
            </div>
            <span className="text-2xl font-display font-semibold text-gray-900">
              FoodLink <span className="text-emerald-700">AI</span>
            </span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'signin'
              ? 'Sign in to continue to your dashboard'
              : 'Join FoodLink to give or receive surplus food'}
          </p>
        </div>

        <div className="card p-6 sm:p-8">
          {/* Session ended elsewhere — say so before they wonder why they are here. */}
          {expiredMessage && (
            <div
              role="status"
              className="mb-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5"
            >
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-800">{expiredMessage}</p>
            </div>
          )}

          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {mode === 'signin' ? 'Continue as' : 'I am signing up as'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {visibleRoles.map((role) => {
                const Icon = role.icon;
                const isActive = selectedRole === role.role;
                return (
                  <button
                    key={role.role}
                    type="button"
                    onClick={() => pickRole(role)}
                    className={`flex items-center gap-2.5 p-3 rounded-lg border-2 text-left transition-all ${isActive ? role.activeColor : role.color}`}
                    id={`role-${role.role}`}
                  >
                    <Icon size={18} className={isActive ? 'text-gray-700' : 'text-gray-400'} />
                    <div>
                      <p className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-gray-600'}`}>
                        {role.label}
                      </p>
                      <p className="text-xs text-gray-400 hidden sm:block leading-tight">{role.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
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
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="••••••••"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
              </div>
              {mode === 'signup' && (
                <p className="mt-1.5 text-xs text-gray-400">At least 8 characters.</p>
              )}
            </div>

            {error && (
              <div
                role="alert"
                id="login-error"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              id="btn-signin"
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 text-sm mt-2 disabled:opacity-60"
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

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            {mode === 'signin' ? (
              <p className="text-xs text-gray-500">
                New here?{' '}
                <button
                  type="button"
                  id="btn-switch-signup"
                  onClick={() => switchMode('signup')}
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
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
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Sign in instead
                </button>
              </p>
            )}
          </div>
        </div>

        {mode === 'signin' && (
          <p className="text-center text-xs text-gray-400 mt-5">
            Demo accounts use the password <code className="text-gray-500">{DEMO_PASSWORD}</code> ·
            pick a role above to fill one in.
          </p>
        )}
      </div>
    </div>
  );
}
