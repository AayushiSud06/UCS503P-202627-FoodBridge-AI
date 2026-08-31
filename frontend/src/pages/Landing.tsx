import { Link } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Leaf, Heart, Users, ShieldCheck, Sparkles,
  BarChart2, Check, MapPin, Truck, CheckCircle2, FlaskConical, Rocket,
} from 'lucide-react';
import Navbar from '../components/Navbar';

const STATS = [
  { value: '1,240+', label: 'Meals redistributed' },
  { value: '32', label: 'Partner organizations' },
  { value: '56', label: 'Active volunteers' },
  { value: '84', label: 'Successful pickups' },
];

const HOW_IT_WORKS = [
  {
    title: 'Donate',
    icon: Leaf,
    desc: 'List surplus food with quantity, location, prep time, and a pickup window.',
    ring: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Match',
    icon: Sparkles,
    desc: 'Our matching engine weighs distance, capacity, and reliability to suggest a recipient.',
    ring: 'bg-clay-100 text-clay-700',
  },
  {
    title: 'Deliver',
    icon: Truck,
    desc: 'A nearby volunteer picks the food up and carries it to the recipient.',
    ring: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Track',
    icon: BarChart2,
    desc: 'Meals saved and community impact update in real time on every dashboard.',
    ring: 'bg-sky-100 text-sky-700',
  },
];

const ROLES = [
  {
    title: 'Donors',
    icon: Leaf,
    desc: 'Restaurants, mess halls, events and households with food to spare.',
    border: 'border-emerald-200/70 hover:border-emerald-400',
    iconBg: 'bg-emerald-600 text-white',
    path: '/donor',
  },
  {
    title: 'Recipients',
    icon: Heart,
    desc: 'NGOs and community kitchens looking for their next delivery.',
    border: 'border-clay-200/70 hover:border-clay-400',
    iconBg: 'bg-clay-600 text-white',
    path: '/ngo',
  },
  {
    title: 'Volunteers',
    icon: Users,
    desc: 'People nearby who can carry a donation the last mile.',
    border: 'border-sky-200/70 hover:border-sky-400',
    iconBg: 'bg-sky-600 text-white',
    path: '/volunteer',
  },
  {
    title: 'Administrators',
    icon: ShieldCheck,
    desc: 'Keeping the whole redistribution loop healthy and honest.',
    border: 'border-gray-300 hover:border-gray-500',
    iconBg: 'bg-gray-800 text-white',
    path: '/admin',
  },
];

const MATCH_REASONS = [
  'Quantity is highly compatible',
  'Recipient has sufficient capacity',
  'Pickup window is available',
  'Within preferred delivery distance',
  'Strong reliability history',
];

const ROADMAP = [
  {
    phase: 'Current prototype',
    icon: CheckCircle2,
    accent: 'text-emerald-700 bg-emerald-100',
    items: ['Role-based dashboards', 'Complete donation lifecycle', 'Rule-based donor-recipient matching', 'Central state management'],
    done: true,
  },
  {
    phase: 'Prototype 2',
    icon: FlaskConical,
    accent: 'text-clay-700 bg-clay-100',
    items: ['ML-assisted recipient ranking', 'Demand-aware redistribution', 'Volunteer assignment optimization', 'Route optimization'],
    done: false,
  },
  {
    phase: 'Advanced phase',
    icon: Rocket,
    accent: 'text-sky-700 bg-sky-100',
    items: ['AI food image categorization', 'NLP donation understanding', 'Community surplus heatmap', 'Recurring donor-recipient detection'],
    done: false,
  },
];

function Blob({ className, fill }: { className: string; fill: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true">
      <path
        fill={fill}
        d="M45.3,-58.4C59.5,-49.9,72.4,-37.7,76.9,-22.9C81.5,-8.1,77.7,9.3,69.6,23.7C61.6,38.1,49.3,49.5,35.4,58.6C21.6,67.6,6.1,74.3,-9.9,74.6C-25.9,74.9,-42.4,68.9,-54.6,58C-66.8,47.1,-74.7,31.4,-77.4,14.5C-80.1,-2.3,-77.6,-20.3,-68.7,-34.3C-59.8,-48.3,-44.5,-58.2,-29.4,-65.7C-14.2,-73.1,0.8,-78.1,15.9,-76.1C31,-74.1,45.3,-58.4,45.3,-58.4Z"
        transform="translate(100 100)"
      />
    </svg>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#FBF8F3]">
        <Blob className="absolute -top-32 -right-24 w-[32rem] h-[32rem] opacity-70" fill="#E3EAD3" />
        <Blob className="absolute -bottom-40 -left-32 w-[26rem] h-[26rem] opacity-60 rotate-45" fill="#FBE4D8" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="grid lg:grid-cols-[1fr,340px] gap-16 items-center">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-7">
                <span className="h-px w-9 bg-clay-500" />
                <span className="text-xs font-semibold tracking-[0.18em] uppercase text-clay-700">
                  Thapar University · UCS503P
                </span>
              </div>

              <h1 className="font-display text-5xl sm:text-6xl lg:text-[4.2rem] font-medium leading-[1.06] tracking-tight text-gray-900 mb-6">
                Good food, <span className="italic text-emerald-700">redirected</span>
                <br />— not wasted.
              </h1>

              <p className="text-lg text-gray-600 max-w-xl mb-10 leading-relaxed">
                FoodLink AI connects surplus food with verified community organizations and
                volunteers nearby — so a donation finds somewhere to go before it goes cold.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <Link to="/login" className="btn-primary px-6 py-3 text-base">
                  <Leaf size={18} />
                  Donate food
                </Link>
                <Link to="/login" className="inline-flex items-center gap-2 text-base font-semibold text-gray-800 hover:text-emerald-700 transition-colors group">
                  Find food near you
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Floating live-stat card */}
            <div className="hidden lg:block relative">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 rotate-[3deg] hover:rotate-0 transition-transform duration-300">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Live this term
                  </span>
                </div>
                <p className="font-display text-4xl font-semibold text-gray-900">1,240+</p>
                <p className="text-sm text-gray-500 mt-1 leading-snug">
                  meals redistributed across 32 partner NGOs
                </p>
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 text-xs font-medium text-emerald-700">
                  <ArrowUpRight size={14} />
                  18% more than last month
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Impact Stats ───────────────────────────────────────────────────── */}
      <section id="impact" className="bg-white border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y divide-x-0 lg:divide-y-0 lg:divide-x divide-gray-200">
            {STATS.map((s) => (
              <div key={s.label} className="text-center px-4 py-6 lg:py-0">
                <p className="font-display text-4xl lg:text-5xl font-semibold text-gray-900 mb-1.5">{s.value}</p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-[#FBF8F3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-xl mb-16">
            <p className="text-xs font-semibold text-clay-700 tracking-[0.18em] uppercase mb-3">How it works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-gray-900">
              From spare plate to shared meal, in four steps.
            </h2>
          </div>

          <div className="relative">
            <div className="hidden lg:block absolute top-9 left-0 right-0 h-px bg-gray-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8 relative">
              {HOW_IT_WORKS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative">
                    <div className={`relative z-10 w-[72px] h-[72px] rounded-full flex items-center justify-center mb-5 ring-8 ring-[#FBF8F3] ${step.ring}`}>
                      <Icon size={26} />
                    </div>
                    <p className="text-xs font-semibold text-gray-400 tracking-wider uppercase mb-1.5">
                      Step 0{i + 1}
                    </p>
                    <h3 className="text-lg font-display font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-[15rem]">{step.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Roles ────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-xs font-semibold text-clay-700 tracking-[0.18em] uppercase mb-3">Community</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-gray-900">
              One platform, four communities.
            </h2>
            <p className="text-gray-500 mt-3">
              FoodLink AI serves every participant in the food redistribution loop.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ROLES.map((role) => {
              const Icon = role.icon;
              return (
                <Link
                  key={role.title}
                  to={role.path}
                  className={`group block p-6 rounded-2xl border-2 bg-white ${role.border} transition-all hover:shadow-lg hover:-translate-y-1`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-5 ${role.iconBg}`}>
                    <Icon size={21} />
                  </div>
                  <h3 className="text-base font-display font-semibold text-gray-900 mb-2">
                    {role.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{role.desc}</p>
                  <div className="mt-4 flex items-center text-xs font-semibold text-gray-400 group-hover:text-gray-900 transition-colors">
                    Open dashboard <ArrowRight size={12} className="ml-1 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── AI Match Preview ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 bg-gray-900">
        <Blob className="absolute -bottom-48 -right-40 w-[34rem] h-[34rem] opacity-20" fill="#6b8f3f" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <span className="h-px w-9 bg-emerald-400" />
                <span className="text-xs font-semibold tracking-[0.18em] uppercase text-emerald-400">
                  Intelligent matching
                </span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-white mb-5">
                Matching, without the guesswork
              </h2>
              <p className="text-gray-300 mb-8 leading-relaxed max-w-md">
                FoodLink AI weighs donation characteristics, recipient capacity, distance, and
                reliability history to surface the best match automatically.
              </p>
              <div className="space-y-3.5">
                {['Distance & logistics awareness', 'Quantity compatibility scoring', 'Recipient capacity matching', 'Historical reliability signals'].map(f => (
                  <div key={f} className="flex items-center gap-3 text-sm text-gray-200">
                    <Check size={16} className="text-emerald-400 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs text-gray-500 italic">
                Currently rule-based · ML-assisted matching planned for Phase 2
              </p>
            </div>

            {/* Mock AI card */}
            <div className="bg-white rounded-2xl p-6 sm:p-7 text-gray-900 shadow-2xl">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-xs font-bold tracking-wider text-emerald-700 uppercase">Match analysis</span>
              </div>

              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="font-display font-semibold text-gray-900">Helping Hands NGO</h3>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={11} /> 1.8 km away
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-3xl font-semibold text-emerald-700">94%</p>
                  <p className="text-xs text-gray-500">Overall match</p>
                </div>
              </div>

              {[
                ['Distance score', 92],
                ['Quantity compatibility', 98],
                ['Recipient capacity', 95],
                ['Pickup availability', 90],
                ['Historical reliability', 94],
              ].map(([label, score]) => (
                <div key={label as string} className="flex items-center gap-3 mb-2.5">
                  <span className="text-xs text-gray-500 w-40 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-700 w-8 text-right">{score}%</span>
                </div>
              ))}

              <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
                {MATCH_REASONS.map(r => (
                  <div key={r} className="flex items-start gap-2">
                    <Check size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-xs text-gray-600">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roadmap ────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-16">
            <p className="text-xs font-semibold text-clay-700 tracking-[0.18em] uppercase mb-3">Roadmap</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-gray-900 mb-3">
              Where this is headed
            </h2>
            <p className="text-gray-500">The semester-long development arc for FoodLink AI.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {ROADMAP.map((phase) => {
              const Icon = phase.icon;
              return (
                <div key={phase.phase} className={`rounded-2xl border p-6 ${phase.done ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200'}`}>
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 ${phase.accent}`}>
                    <Icon size={14} />
                    {phase.phase}
                  </div>
                  <ul className="space-y-2.5">
                    {phase.items.map(item => (
                      <li key={item} className="flex items-start gap-2.5">
                        {phase.done ? (
                          <Check size={15} className="text-emerald-700 mt-0.5 shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 mt-0.5 shrink-0" />
                        )}
                        <span className={`text-sm ${phase.done ? 'text-emerald-900' : 'text-gray-600'}`}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 bg-emerald-800">
        <Blob className="absolute -top-24 -left-24 w-96 h-96 opacity-20" fill="#ffffff" />
        <div className="relative max-w-3xl mx-auto px-4 text-center text-white">
          <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-4">Ready to reduce food waste?</h2>
          <p className="text-emerald-100 mb-9 text-lg">
            Join the FoodLink AI community and start making an impact today.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-emerald-800 font-semibold rounded-full hover:bg-emerald-50 transition-colors text-base">
            Get started <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center">
                  <Leaf size={15} className="text-white" />
                </div>
                <span className="text-white font-display font-semibold">FoodLink AI</span>
              </div>
              <p className="text-sm">AI-assisted community food redistribution</p>
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
