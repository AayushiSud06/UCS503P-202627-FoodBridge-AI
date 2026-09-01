import { useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAction } from '../lib/hooks';

/**
 * Change-your-own-password, shared by all three profile pages.
 *
 * Every account can reach one: an administrator-created account starts on a
 * password somebody else chose, and without this the first thing such an
 * account does is share a credential it cannot rotate.
 */
export default function PasswordCard() {
  const { changePassword } = useAuth();
  const { run, isBusy } = useAction();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (next.length < 8) {
      setError('The new password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }

    const done = await run('password', () => changePassword(current, next), {
      success: { message: 'Password changed', subtitle: 'Use it the next time you sign in.' },
      errorTitle: 'Could not change your password',
    });
    if (done !== null) {
      setCurrent('');
      setNext('');
      setConfirm('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4">
      <h2 className="section-title border-b border-gray-100 pb-3 flex items-center gap-2">
        <KeyRound size={16} className="text-gray-400" />
        Password
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="current-password" className="label">Current password</label>
          <input
            id="current-password"
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            className="input-field"
            autoComplete="current-password"
          />
        </div>
        <div>
          <label htmlFor="new-password" className="label">New password</label>
          <input
            id="new-password"
            type="password"
            value={next}
            onChange={e => setNext(e.target.value)}
            className="input-field"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label htmlFor="confirm-password" className="label">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="input-field"
            autoComplete="new-password"
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="submit"
        className="btn-secondary disabled:opacity-60"
        disabled={isBusy || !current || !next}
      >
        <Save size={15} /> {isBusy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}
