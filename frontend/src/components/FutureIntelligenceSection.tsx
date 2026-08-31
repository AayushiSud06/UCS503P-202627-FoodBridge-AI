import { Sparkles, Brain, Cpu, Map, Camera, MessageSquare, Flame, Repeat, CheckCircle } from 'lucide-react';

interface FutureFeature {
  title: string;
  category: 'Machine Learning' | 'Computer Vision' | 'Optimization' | 'NLP' | 'Analytics';
  description: string;
  icon: typeof Sparkles;
  phase: 'Phase 2' | 'Advanced Phase';
  status: 'In Design' | 'Planned';
  badgeColor: string;
}

const FUTURE_FEATURES: FutureFeature[] = [
  {
    title: 'ML-Based Recipient Ranking',
    category: 'Machine Learning',
    description: 'Neural ranker trained on historical delivery reliability, kitchen capacity, dietary preferences, and intake speed.',
    icon: Brain,
    phase: 'Phase 2',
    status: 'In Design',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    title: 'Demand-Aware Redistribution',
    category: 'Analytics',
    description: 'Real-time forecasting of food demand across community shelters and kitchens based on demographic census and weather signals.',
    icon: Cpu,
    phase: 'Phase 2',
    status: 'Planned',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    title: 'Volunteer Assignment & Route Optimization',
    category: 'Optimization',
    description: 'Vehicle routing algorithm (VRP) calculating optimal pickup-dropoff sequences for multi-order volunteer dispatches.',
    icon: Map,
    phase: 'Phase 2',
    status: 'In Design',
    badgeColor: 'bg-purple-100 text-purple-700 border-purple-200',
  },
  {
    title: 'AI Food Image Categorization',
    category: 'Computer Vision',
    description: 'Zero-shot vision transformer extracting meal type, approximate portion volume, and freshness grade from uploaded photos.',
    icon: Camera,
    phase: 'Advanced Phase',
    status: 'Planned',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    title: 'NLP-Based Donation Understanding',
    category: 'NLP',
    description: 'Large language model parsing informal WhatsApp/SMS descriptions into structured quantity, allergens, and pickup deadlines.',
    icon: MessageSquare,
    phase: 'Advanced Phase',
    status: 'Planned',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    title: 'Community Surplus/Demand Heatmap',
    category: 'Analytics',
    description: 'Geospatial heatmap visualizing food surplus generation hubs vs. acute hunger hot-spots across the municipal district.',
    icon: Flame,
    phase: 'Advanced Phase',
    status: 'Planned',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    title: 'Recurring Donor-Recipient Partnerships',
    category: 'Machine Learning',
    description: 'Graph neural network detecting consistent supply-demand patterns to establish automated recurring scheduled food links.',
    icon: Repeat,
    phase: 'Advanced Phase',
    status: 'Planned',
    badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
  },
];

export default function FutureIntelligenceSection() {
  return (
    <div className="card p-6 border-purple-100 bg-gradient-to-br from-white via-purple-50/20 to-teal-50/30">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-bold mb-2">
            <Sparkles size={13} className="text-purple-600" />
            AI Innovation Roadmap
          </div>
          <h2 className="text-xl font-bold text-gray-900">Future Intelligence Architecture</h2>
          <p className="text-sm text-gray-500 mt-1">
            Planned AI/ML microservices designed to replace prototype heuristics in subsequent development phases.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg">
          <CheckCircle size={14} className="text-emerald-600" />
          <span>Prototype 1 (Current): Rule-Based Simulation</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {FUTURE_FEATURES.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className="bg-white rounded-xl p-4 border border-gray-200/80 hover:border-purple-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <Icon size={18} />
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${feat.badgeColor}`}>
                  {feat.phase}
                </span>
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">{feat.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{feat.description}</p>
              <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[11px]">
                <span className="text-gray-400 font-medium">{feat.category}</span>
                <span className="text-purple-700 font-semibold">{feat.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
