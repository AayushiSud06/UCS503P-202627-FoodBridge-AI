import { Check, Info, Sparkles, ShieldCheck, Clock, MapPin, Package, Building2 } from 'lucide-react';
import type { MatchAnalysis } from '../types';
import MatchScore from './MatchScore';

interface MatchAnalysisProps {
  analysis: MatchAnalysis;
  recipientName: string;
  foodName?: string;
  quantity?: number;
  unit?: string;
}

/** The same 90/75 boundaries `ScoreRow` colours by, said in words. */
function compatibilityLabel(score: number): string {
  if (score >= 90) return 'Excellent Compatibility';
  if (score >= 75) return 'Good Compatibility';
  if (score >= 50) return 'Fair Compatibility';
  return 'Low Compatibility';
}

function ScoreRow({
  label,
  score,
  icon: Icon,
  description,
}: {
  label: string;
  score: number;
  icon: typeof MapPin;
  description: string;
}) {
  const barColor = score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-amber-400' : 'bg-rose-400';
  const badgeColor = score >= 90 ? 'text-emerald-700 bg-emerald-50' : score >= 75 ? 'text-amber-700 bg-amber-50' : 'text-rose-700 bg-rose-50';

  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-white border border-gray-200 flex items-center justify-center text-gray-500">
            <Icon size={13} />
          </div>
          <span className="text-xs font-semibold text-gray-800">{label}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
          {score}%
        </span>
      </div>

      <div className="w-full h-1.5 bg-gray-200/80 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-700`}
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-[11px] text-gray-500">{description}</p>
    </div>
  );
}

export default function MatchAnalysisPanel({
  analysis,
  recipientName,
  foodName,
  quantity,
  unit,
}: MatchAnalysisProps) {
  return (
    <div className="card p-6 space-y-6 border-emerald-100">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-bold tracking-wider text-emerald-600 uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              <Sparkles size={11} className="text-emerald-500" />
              AI Match Analysis
            </span>
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
              <Info size={10} /> Rule-Based Model
            </span>
          </div>
          <h3 className="text-lg font-bold text-gray-900">{recipientName}</h3>
          {foodName && (
            <p className="text-xs text-gray-500 mt-0.5">
              Matching for <strong>{quantity} {unit}</strong> of <strong>{foodName}</strong>
            </p>
          )}
        </div>
        <div className="text-right">
          <MatchScore score={analysis.overallScore} size="lg" />
          <p className="text-[11px] font-semibold text-emerald-700 mt-1">
            {compatibilityLabel(analysis.overallScore)}
          </p>
        </div>
      </div>

      {/* Multi-Dimensional Scoring Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ScoreRow
          label="Distance & Logistics"
          score={analysis.distanceScore}
          icon={MapPin}
          description="Logistical proximity reduces volunteer travel time"
        />
        <ScoreRow
          label="Quantity Compatibility"
          score={analysis.quantityScore}
          icon={Package}
          description="Donation size matches recipient batch serving capacity"
        />
        <ScoreRow
          label="Recipient Capacity"
          score={analysis.capacityScore}
          icon={Building2}
          description="Cold storage and immediate consumption bandwidth"
        />
        <ScoreRow
          label="Pickup Availability"
          score={analysis.pickupAvailabilityScore}
          icon={Clock}
          description="Recipient intake volunteers ready before deadline"
        />
      </div>

      {/* Historical Reliability */}
      <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-950">Verified Recipient Organization</p>
            <p className="text-[11px] text-emerald-700">Historical intake reliability rating: {analysis.reliabilityScore}%</p>
          </div>
        </div>
      </div>

      {/* Why This Match Explanation */}
      {analysis.reasons.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
            Why this match was selected by FoodLink AI:
          </p>
          <ul className="space-y-2">
            {analysis.reasons.map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                <Check size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Architecture Note */}
      <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-[11px] text-purple-900 leading-relaxed">
        <strong className="font-semibold text-purple-950">ML Architecture Roadmap:</strong> Currently scored via multi-attribute utility theory (MAUT). Phase 2 integrates FastAPI PyTorch endpoint with gradient-boosted ranker and distance matrix optimization.
      </div>
    </div>
  );
}
