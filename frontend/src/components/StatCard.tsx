import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}

const colorMap = {
  emerald: {
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  blue: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  amber: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'text-purple-600',
    badge: 'bg-purple-100 text-purple-700',
  },
  rose: {
    bg: 'bg-rose-50',
    icon: 'text-rose-600',
    badge: 'bg-rose-100 text-rose-700',
  },
};

export default function StatCard({
  label, value, icon: Icon, trend, color = 'emerald'
}: StatCardProps) {
  const colors = colorMap[color];
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
          <p className="font-display text-3xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <p className="text-xs text-emerald-600 font-medium mt-1">{trend}</p>
          )}
        </div>
        <div className={`w-11 h-11 ${colors.bg} rounded-xl flex items-center justify-center shrink-0 ml-4`}>
          <Icon size={22} className={colors.icon} />
        </div>
      </div>
    </div>
  );
}
