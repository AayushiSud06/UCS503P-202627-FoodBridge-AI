/**
 * Pickup-deadline helpers.
 *
 * Deadlines arrive from the API as ISO instants. Food is time-critical, so the
 * UI is organised around how much time is left rather than around totals —
 * these helpers turn a deadline into something sortable and legible.
 *
 * The clock-string form ("8:00 PM") is still parsed, because a bare time is
 * what a person types and what the older screens display. An ISO instant is
 * preferred wherever one is available: it can tell tomorrow morning from this
 * morning, which a clock string cannot.
 */

export type Urgency = 'expired' | 'critical' | 'soon' | 'ok';

/**
 * Parse an ISO instant, or "8:00 PM" / "11:30 AM" / "18:45" as a time on the
 * same day as `now`.
 */
export function parseDeadline(deadline: string, now: Date = new Date()): Date | null {
  if (!deadline) return null;

  // ISO first — that is what the API sends, and it carries a real date.
  if (/\d{4}-\d{2}-\d{2}T/.test(deadline)) {
    const parsed = new Date(deadline);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = deadline.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export interface DeadlineStatus {
  /** Minutes until the deadline; negative once passed. Null if unparseable. */
  minutesLeft: number | null;
  label: string;
  urgency: Urgency;
}

export function deadlineStatus(deadline: string, now: Date = new Date()): DeadlineStatus {
  const parsed = parseDeadline(deadline, now);
  if (!parsed) return { minutesLeft: null, label: `by ${deadline}`, urgency: 'ok' };

  const minutesLeft = Math.round((parsed.getTime() - now.getTime()) / 60000);

  if (minutesLeft < 0) {
    return { minutesLeft, label: 'Overdue', urgency: 'expired' };
  }

  const hours = Math.floor(minutesLeft / 60);
  const mins = minutesLeft % 60;
  // Deadlines can now sit days out, where "38h 12m left" reads worse than "1d 14h".
  const label =
    hours >= 24
      ? `${Math.floor(hours / 24)}d ${hours % 24}h left`
      : hours > 0
        ? `${hours}h ${mins}m left`
        : `${mins}m left`;

  if (minutesLeft <= 120) return { minutesLeft, label, urgency: 'critical' };
  if (minutesLeft <= 360) return { minutesLeft, label, urgency: 'soon' };
  return { minutesLeft, label, urgency: 'ok' };
}

/** Sort key: soonest deadline first, unparseable last. */
export function byUrgency(a: string, b: string, now: Date = new Date()): number {
  const left = deadlineStatus(a, now).minutesLeft;
  const right = deadlineStatus(b, now).minutesLeft;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

/**
 * A deadline as a wall clock ("8:00 PM"), for the places that print the time
 * itself rather than the time remaining. Falls back to the raw string so a
 * value that was never an instant still renders as whatever it was.
 */
export function formatClock(value: string | undefined, now: Date = new Date()): string {
  if (!value) return '—';
  const parsed = parseDeadline(value, now);
  if (!parsed) return value;

  const time = parsed.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // Only say which day when it is not today, so the common case stays terse.
  const sameDay = parsed.toDateString() === now.toDateString();
  if (sameDay) return time;

  const day = parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${day}, ${time}`;
}

/** A timestamp as a short relative phrase: "12m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';

  const minutes = Math.round((now.getTime() - then) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Turn a `<input type="time">` value ("20:00") into an absolute instant.
 *
 * The API takes a real datetime and refuses one in the past, but a person
 * posting surplus at 9pm for collection by 1am means *tonight into tomorrow*,
 * not thirteen hours ago. A time that has already passed today therefore rolls
 * to tomorrow rather than being rejected.
 */
export function toFutureIso(time: string, now: Date = new Date()): string | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) return null;

  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);
  if (result.getTime() <= now.getTime()) result.setDate(result.getDate() + 1);
  return result.toISOString();
}

/** The same conversion without the roll-forward, for times already past. */
export function toIsoToday(time: string, now: Date = new Date()): string | null {
  const parsed = parseDeadline(time, now);
  return parsed ? parsed.toISOString() : null;
}

export const URGENCY_STYLES: Record<Urgency, { rail: string; text: string; chip: string }> = {
  expired:  { rail: 'bg-red-400',     text: 'text-red-700',     chip: 'bg-red-50 text-red-700' },
  critical: { rail: 'bg-clay-500',    text: 'text-clay-700',    chip: 'bg-clay-50 text-clay-700' },
  soon:     { rail: 'bg-amber-400',   text: 'text-amber-700',   chip: 'bg-amber-50 text-amber-700' },
  ok:       { rail: 'bg-emerald-300', text: 'text-gray-500',    chip: 'bg-gray-100 text-gray-600' },
};
