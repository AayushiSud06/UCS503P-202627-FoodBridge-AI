import type { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useApp } from '../context/AppContext';

/**
 * What a portal shows while its data is still arriving, or when it never did.
 *
 * Only the *first* load blocks. Refreshes after a write keep the current
 * screen on-screen — a spinner replacing the page every time someone accepts a
 * donation would be worse than a half-second of slightly stale numbers.
 */
export default function DataGate({ children }: { children: ReactNode }) {
  const { state, refresh } = useApp();
  const isFirstLoad = state.isLoading && state.donations.length === 0 && !state.loadError;

  if (state.loadError) {
    return (
      <div className="max-w-lg mx-auto mt-10 card p-6 text-center space-y-3">
        <AlertTriangle size={28} className="mx-auto text-amber-500" />
        <div>
          <h2 className="font-semibold text-gray-900">Could not load your data</h2>
          <p className="text-sm text-gray-500 mt-1">{state.loadError}</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-primary mx-auto">
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  if (isFirstLoad) return <Skeleton />;

  return <>{children}</>;
}

/** A quiet stand-in with roughly the shape of a dashboard, not a spinner. */
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <div className="h-7 w-64 bg-gray-200 rounded-lg" />
        <div className="h-4 w-80 bg-gray-100 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>
    </div>
  );
}
