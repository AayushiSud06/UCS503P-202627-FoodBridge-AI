import { Zap } from 'lucide-react';

interface MatchScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

function getScoreColor(score: number) {
  if (score >= 90) return { ring: 'text-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Excellent Match' };
  if (score >= 75) return { ring: 'text-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', label: 'Good Match' };
  return { ring: 'text-gray-400', bg: 'bg-gray-50', text: 'text-gray-500', label: 'Fair Match' };
}

export default function MatchScore({ score, size = 'md', showLabel = true }: MatchScoreProps) {
  const colors = getScoreColor(score);
  
  const sizeConfig = {
    sm: { container: 'w-14 h-14', text: 'text-sm font-bold', icon: 14, labelSize: 'text-xs' },
    md: { container: 'w-20 h-20', text: 'text-xl font-bold', icon: 16, labelSize: 'text-xs' },
    lg: { container: 'w-28 h-28', text: 'text-3xl font-bold', icon: 20, labelSize: 'text-sm' },
  }[size];

  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`relative ${sizeConfig.container} flex items-center justify-center`}>
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e7e5e4" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={`${colors.ring} transition-all duration-700`}
          />
        </svg>
        <div className="relative text-center">
          <p className={`${sizeConfig.text} ${colors.ring}`}>{score}%</p>
        </div>
      </div>
      {showLabel && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap ${colors.bg}`}>
          <Zap size={sizeConfig.icon - 2} className={colors.text} />
          <span className={`${sizeConfig.labelSize} font-semibold ${colors.text}`}>
            AI MATCH
          </span>
        </div>
      )}
    </div>
  );
}
