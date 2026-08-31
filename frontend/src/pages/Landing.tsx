import { Link } from 'react-router-dom';
import {
  ArrowRight, Leaf, Heart, Users, ShieldCheck, Zap,
  BarChart2, Check, MapPin, Clock
} from 'lucide-react';
import Navbar from '../components/Navbar';

const STATS = [
  { value: '1,240+', label: 'Meals Redistributed' },
  { value: '32', label: 'Partner Organizations' },
  { value: '56', label: 'Active Volunteers' },
  { value: '84', label: 'Successful Pickups' },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Donate',
    icon: Leaf,
    desc: 'List surplus food with quantity, location, preparation time, and pickup deadline.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    step: '02',
    title: 'Match',
    icon: Zap,
    desc: 'Our intelligent matching system identifies suitable recipient organizations.',
    color: 'bg-purple-50 text-purple-600',
  },
  {
    step: '03',
    title: 'Deliver',
    icon: MapPin,
    desc: 'Volunteers collect and deliver food to the selected organization.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    step: '04',
    title: 'Impact',
    icon: BarChart2,
    desc: 'Track meals redistributed and community impact in real time.',
    color: 'bg-amber-50 text-amber-600',
  },
];

const ROLES = [
  {
    title: 'Donors',
    icon: Leaf,
    desc: 'Restaurants, messes, events and communities with surplus food.',
    color: 'bg-emerald-50 border-emerald-100',
    iconBg: 'bg-emerald-100 text-emerald-600',
    path: '/donor',
  },
  {
    title: 'Recipients',
    icon: Heart,
    desc: 'NGOs and community kitchens that need food.',
    color: 'bg-rose-50 border-rose-100',
    iconBg: 'bg-rose-100 text-rose-600',
    path: '/ngo',
  },
  {
    title: 'Volunteers',
    icon: Users,
    desc: 'Community members helping with pickup and delivery.',
    color: 'bg-blue-50 border-blue-100',
    iconBg: 'bg-blue-100 text-blue-600',
    path: '/volunteer',
  },
  {
    title: 'Administrators',
    icon: ShieldCheck,
    desc: 'Monitor and manage the redistribution ecosystem.',
    color: 'bg-gray-50 border-gray-100',
    iconBg: 'bg-gray-100 text-gray-600',
    path: '/admin',
  },
];

const MATCH_REASONS = [
  'Quantity is highly compatible',
  'Recipient has sufficient capacity',
  'Pickup window is available',
  'Donation is within preferred distance',
  'Recipient has a strong reliability history',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white">
        {/* Subtle pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-800/50 border border-emerald-700/50 rounded-full text-sm text-emerald-300 font-medium mb-6">
              <Zap size={14} className="text-emerald-400" />
              AI-Assisted Food Redistribution Platform
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
              Turning Surplus Food Into{' '}
              <span className="text-emerald-400">Community Impact</span>
            </h1>

            <p className="text-lg text-emerald-100 max-w-2xl mb-10 leading-relaxed">
              FoodLink AI connects surplus food with verified community organizations and volunteers,
              making food redistribution faster, smarter, and more transparent.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-colors text-base">
                <Leaf size={18} />
                Donate Food
              </Link>
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-colors text-base">
                Find Food
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white" style={{
          clipPath: 'ellipse(100% 100% at 50% 100%)'
        }} />
      </section>

      {/* ── Impact Stats ───────────────────────────────────────────────────── */}
      <section id="impact" className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label} className="text-center p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p className="text-3xl lg:text-4xl font-extrabold text-emerald-700 mb-1">{s.value}</p>
                <p className="text-sm font-medium text-gray-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-emerald-600 tracking-wider uppercase mb-2">How It Works</p>
            <h2 className="text-3xl font-extrabold text-gray-900">
              Simple. Smart. Impactful.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.step} className="card p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.color}`}>
                      <Icon size={20} />
                    </div>
                    <span className="text-2xl font-extrabold text-gray-200">{step.step}</span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Community Roles ────────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-sm font-bold text-emerald-600 tracking-wider uppercase mb-2">Community</p>
            <h2 className="text-3xl font-extrabold text-gray-900">One Platform. Four Communities.</h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              FoodLink AI serves every participant in the food redistribution ecosystem.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <Link
                  key={role.title}
                  to={role.path}
                  className={`group block p-6 rounded-2xl border-2 ${role.color} hover:shadow-md transition-all`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${role.iconBg}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                    {role.title}
                  </h3>
                  <p className="text-sm text-gray-500">{role.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    Open Dashboard <ArrowRight size={12} className="ml-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI Match Preview ───────────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-gray-900 to-emerald-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-800/50 border border-emerald-700/50 rounded-full text-sm text-emerald-300 font-medium mb-6">
                <Zap size={14} className="text-emerald-400" />
                Intelligent Matching
              </div>
              <h2 className="text-3xl font-extrabold mb-4">
                AI-Powered Donor-Recipient Matching
              </h2>
              <p className="text-emerald-200 mb-6 leading-relaxed">
                FoodLink AI analyzes donation characteristics, recipient capacity, distance,
                and reliability history to surface the best matches — automatically.
              </p>
              <div className="space-y-3">
                {['Distance & logistics awareness', 'Quantity compatibility scoring', 'Recipient capacity matching', 'Historical reliability signals'].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-emerald-100">
                    <Check size={16} className="text-emerald-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <p className="mt-6 text-xs text-emerald-400 italic">
                Currently rule-based · ML-assisted matching planned for Phase 2
              </p>
            </div>

            {/* Mock AI card */}
            <div className="bg-white rounded-2xl p-6 text-gray-900 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-emerald-600 uppercase">AI Match Analysis</span>
              </div>

              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="font-bold text-gray-900">Helping Hands NGO</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Community Kitchen · 1.8 km away</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-extrabold text-emerald-600">94%</p>
                  <p className="text-xs text-gray-500">Overall Match</p>
                </div>
              </div>

              {[
                ['Distance Score', 92],
                ['Quantity Compatibility', 98],
                ['Recipient Capacity', 95],
                ['Pickup Availability', 90],
                ['Historical Reliability', 94],
              ].map(([label, score]) => (
                <div key={label as string} className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-gray-500 w-44 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}%</span>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                {MATCH_REASONS.map(r => (
                  <div key={r} className="flex items-start gap-2">
                    <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Intelligent Roadmap ────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">
              Intelligent Redistribution Roadmap
            </h2>
            <p className="text-gray-500">The semester-long development arc for FoodLink AI.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Phase 0 */}
            <div className="card p-5 border-emerald-200 bg-emerald-50">
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3">
                ✅ Current Prototype
              </div>
              <ul className="space-y-2">
                {['Role-based dashboards', 'Complete donation lifecycle', 'Rule-based donor-recipient matching', 'Central state management'].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-sm text-emerald-800">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Phase 2 */}
            <div className="card p-5">
              <div className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-3">
                🔬 Prototype 2
              </div>
              <ul className="space-y-2">
                {['ML-assisted recipient ranking', 'Demand-aware redistribution', 'Volunteer assignment optimization', 'Route optimization'].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-purple-400 mt-1 shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Advanced */}
            <div className="card p-5">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3">
                🚀 Advanced Phase
              </div>
              <ul className="space-y-2">
                {['AI food image categorization', 'NLP donation understanding', 'Community surplus heatmap', 'Recurring donor-recipient detection'].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-blue-400 mt-1 shrink-0" />
                    <span className="text-sm text-gray-600">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="py-16 bg-emerald-600">
        <div className="max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl font-extrabold mb-3">Ready to reduce food waste?</h2>
          <p className="text-emerald-100 mb-8">
            Join the FoodLink AI community and start making an impact today.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-7 py-3 bg-white text-emerald-700 font-bold rounded-xl hover:bg-emerald-50 transition-colors text-base">
            Get Started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Leaf size={15} className="text-white" />
                </div>
                <span className="text-white font-bold">FoodLink AI</span>
              </div>
              <p className="text-sm">AI-Assisted Community Food Redistribution</p>
              <p className="text-xs text-gray-600 mt-1">UCS503P Software Engineering · Thapar University</p>
            </div>

            <div className="flex flex-wrap gap-5 text-sm">
              {['About', 'How It Works', 'Contact', 'GitHub'].map(l => (
                <a key={l} href="#" className="hover:text-emerald-400 transition-colors">{l}</a>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-center text-xs text-gray-600">
            © 2024 FoodLink AI — Prototype 0. Built for UCS503P.
          </div>
        </div>
      </footer>
    </div>
  );
}
