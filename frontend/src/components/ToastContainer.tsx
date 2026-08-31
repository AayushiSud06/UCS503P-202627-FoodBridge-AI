import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Toast } from '../context/AppContext';

const ICON_MAP = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLOR_MAP = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  error: 'border-red-300 bg-red-50 text-red-800',
  info: 'border-blue-300 bg-blue-50 text-blue-800',
};

const ICON_COLOR_MAP = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useApp();
  const Icon = ICON_MAP[toast.type];

  return (
    <div
      className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg max-w-sm toast-enter ${COLOR_MAP[toast.type]}`}
      role="alert"
    >
      <Icon size={20} className={`shrink-0 mt-0.5 ${ICON_COLOR_MAP[toast.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.message}</p>
        {toast.subtitle && (
          <p className="text-xs opacity-75 mt-0.5">{toast.subtitle}</p>
        )}
      </div>
      <button
        onClick={() => dismissToast(toast.id)}
        className="opacity-60 hover:opacity-100 transition-opacity shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { state } = useApp();

  if (state.toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {state.toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastItem toast={toast} />
        </div>
      ))}
    </div>
  );
}
