import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Mail, Lock, ArrowRight, ShieldCheck, Users, Heart, Store } from 'lucide-react';
import type { UserRole } from '../types';

interface RoleOption {
  role: UserRole;
  label: string;
  icon: typeof Leaf;
  description: string;
  path: string;
  color: string;
  activeColor: string;
}

const ROLES: RoleOption[] = [
  {
    role: 'donor',
    label: 'Donor',
    icon: Store,
    description: 'I have surplus food to donate',
    path: '/donor',
    color: 'border-gray-200 hover:border-emerald-300 hover:bg-emerald-50',
    activeColor: 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200',
  },
  {
    role: 'ngo',
    label: 'Recipient',
    icon: Heart,
    description: 'I represent a recipient organization',
    path: '/ngo',
    color: 'border-gray-200 hover:border-clay-300 hover:bg-clay-50',
    activeColor: 'border-clay-500 bg-clay-50 ring-2 ring-clay-200',
  },
  {
    role: 'volunteer',
    label: 'Volunteer',
    icon: Users,
    description: 'I help with food pickup & delivery',
    path: '/volunteer',
    color: 'border-gray-200 hover:border-sky-300 hover:bg-sky-50',
    activeColor: 'border-sky-500 bg-sky-50 ring-2 ring-sky-200',
  },
  {
    role: 'admin',
    label: 'Admin',
    icon: ShieldCheck,
    description: 'I manage the platform',
    path: '/admin',
    color: 'border-gray-200 hover:border-gray-400 hover:bg-gray-50',
    activeColor: 'border-gray-600 bg-gray-50 ring-2 ring-gray-200',
  },
];

/**
 * Login Page
 * 
 * PROTOTYPE NOTE: Authentication is mocked. Role selection redirects directly to the
 * corresponding dashboard without any real token or session.
 * 
 * TODO: Replace the `handleSignIn` function with a real API call to the FastAPI auth endpoint
 * in a future sprint. The role-to-path mapping below will remain useful.
 */
export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('donor');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock auth delay
    setTimeout(() => {
      const role = ROLES.find(r => r.role === selectedRole);
      navigate(role?.path ?? '/donor');
    }, 800);
  };

  const handleQuickAccess = (role: RoleOption) => {
    navigate(role.path);
  };

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
          <h1 className="text-xl font-semibold text-gray-900">Welcome back</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue to your dashboard</p>
        </div>

        <div className="card p-6 sm:p-8">
          {/* Role Selector */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Continue as
            </p>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => {
                const Icon = role.icon;
                const isActive = selectedRole === role.role;
                return (
                  <button
                    key={role.role}
                    type="button"
                    onClick={() => setSelectedRole(role.role)}
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
          <form onSubmit={handleSignIn} className="space-y-4">
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
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="btn-signin"
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center py-3 text-sm mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight size={16} />
                </span>
              )}
            </button>
          </form>

          <div className="mt-5 pt-5 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400 mb-3">Or jump directly to a dashboard</p>
            <div className="flex gap-2 flex-wrap justify-center">
              {ROLES.map(role => (
                <button
                  key={role.role}
                  id={`quick-${role.role}`}
                  onClick={() => handleQuickAccess(role)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors font-medium"
                >
                  {role.label} →
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5">
          Prototype build · Authentication is mocked for demonstration purposes.
        </p>
      </div>
    </div>
  );
}
