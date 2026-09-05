import {
  AlertTriangle, ClipboardList, RefreshCw, Repeat, ShieldCheck, Users,
} from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { useLoadState, useRequirements } from '../../context/AppContext';
import { timeAgo } from '../../lib/time';
import type { NGORequirement } from '../../types';

/**
 * Standing demand, read-only, for donors.
 *
 * This is a notice board and nothing more. A requirement is not a claim on
 * anybody's donation: the matcher has never read the `requirements` table
 * (`ARCHITECTURE.md` — *Requirements are not an input*), there is no
 * requirement-to-donation relationship in the schema, and nothing here creates,
 * reserves or promises one. The page therefore states what a kitchen has asked
 * for and stops — no "fulfil this need" button, no count of needs met, no
 * suggestion that posting surplus answers a particular line on the board.
 *
 * The server decides what is on it. Since D-44 `GET /api/requirements` scopes by
 * role, so a donor receives active needs from **verified** organisations only —
 * the same gate the matcher applies — platform-wide and in newest-first order.
 * That order is preserved here rather than re-sorted, so the board a donor reads
 * is the one the API returned.
 */

const URGENCY_CHIP: Record<NGORequirement['urgency'], string> = {
  High: 'bg-clay-50 text-clay-700 border-clay-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-teal-50 text-teal-700 border-teal-200',
};

export default function DonorNeedsBoard() {
  const requirements = useRequirements();
  const { isLoading, error, retry } = useLoadState();

  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10 card p-6 text-center space-y-3">
        <AlertTriangle size={28} className="mx-auto text-amber-500" />
        <div>
          <h2 className="font-semibold text-gray-900">Could not load the needs board</h2>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
        </div>
        <button type="button" onClick={() => void retry()} className="btn-primary mx-auto">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Needs Board</h1>
        <p className="text-gray-500 mt-1 max-w-2xl">
          What verified recipient organisations have said they need. It is a standing record
          of demand, not a queue of requests assigned to you — reading it does not commit you
          to anything, and posting a donation does not attach it to a need. Donations are
          ranked separately, on distance, quantity, capacity, pickup window and reliability.
        </p>
      </header>

      {isLoading ? (
        <BoardSkeleton />
      ) : requirements.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No open needs right now"
          description="No verified recipient organisation has an active requirement posted at the moment. Needs appear here as organisations post them."
        />
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Showing {requirements.length} active {requirements.length === 1 ? 'need' : 'needs'},
            newest first.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {requirements.map(req => (
              <NeedCard key={req.id} requirement={req} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NeedCard({ requirement: req }: { requirement: NGORequirement }) {
  const posted = timeAgo(req.createdAt);

  return (
    <article className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${URGENCY_CHIP[req.urgency]}`}
        >
          {req.urgency} Priority
        </span>
        {req.dailyRecurring && (
          <span className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Repeat size={12} /> Needed daily
          </span>
        )}
      </div>

      <div>
        <h3 className="font-bold text-gray-900 text-base">{req.foodType}</h3>
        <p className="text-xs text-gray-500 flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
          <span>{req.ngoName}</span>
          {/* The board is verified-only, so this is a statement of what the
              organisation is rather than a filter the reader has to apply. */}
          {req.isVerified && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <ShieldCheck size={13} /> Verified organisation
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl text-xs">
        <div>
          <span className="text-gray-400 font-medium">QUANTITY NEEDED</span>
          <p className="font-bold text-gray-900 text-sm mt-0.5">
            {req.quantityNeeded} {req.unit}
          </p>
        </div>
        {/* Beneficiaries are optional on the form and default to zero, so a
            zero here means "not stated" rather than "nobody". */}
        {req.beneficiaryCount > 0 && (
          <div>
            <span className="text-gray-400 font-medium">BENEFICIARIES</span>
            <p className="font-bold text-gray-900 text-sm mt-0.5 flex items-center gap-1">
              <Users size={14} className="text-emerald-600" /> ~{req.beneficiaryCount} people
            </p>
          </div>
        )}
      </div>

      {/* Operator-authored free text, rendered as text. */}
      {req.notes && (
        <p className="text-xs text-gray-600 bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100">
          {req.notes}
        </p>
      )}

      {posted && (
        <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-100">
          Posted {posted}
        </p>
      )}
    </article>
  );
}

/** The board's own shape while it loads, matching `DataGate`'s approach. */
function BoardSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse" aria-busy="true" aria-label="Loading needs">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-44 bg-gray-100 rounded-2xl border border-gray-200" />
      ))}
    </div>
  );
}
