import { type LucideIcon } from 'lucide-react';

interface ImpactCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle: string;
  icon: LucideIcon;
  color?: 'emerald' | 'blue' | 'purple' | 'amber' | 'rose' | 'teal';
  trend?: string;
  equivalent?: string;
}

const COLOR_MAP = {
  emerald: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    iconBg: 'bg-emerald-100 text-emerald-600',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-100',
    iconBg: 'bg-blue-100 text-blue-600',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-800',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-100',
    iconBg: 'bg-purple-100 text-purple-600',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-800',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    iconBg: 'bg-amber-100 text-amber-600',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-800',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-100',
    iconBg: 'bg-rose-100 text-rose-600',
    text: 'text-rose-700',
    badge: 'bg-rose-100 text-rose-800',
  },
  teal: {
    bg: 'bg-teal-50',
    border: 'border-teal-100',
    iconBg: 'bg-teal-100 text-teal-600',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-800',
  },
};

export default function ImpactCard({
  title,
  value,
  unit,
  subtitle,
  icon: Icon,
  color = 'emerald',
  trend,
  equivalent,
}: ImpactCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div className={`card p-5 border ${c.border} hover:shadow-md transition-shadow relative overflow-hidden`}>
      {/* Background soft glow */}
      <div className={`absolute top-0 right-0 w-24 h-24 rounded-full ${c.bg} -mr-8 -mt-8 opacity-60 pointer-events-none`} />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.iconBg} shrink-0`}>
          <Icon size={22} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${c.badge}`}>
            {trend}
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && <span className="text-sm font-semibold text-gray-500">{unit}</span>}
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">{subtitle}</p>

        {equivalent && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <span className="text-base">🌱</span>
            <span>{equivalent}</span>
          </div>
        )}
      </div>
    </div>
  );
}
