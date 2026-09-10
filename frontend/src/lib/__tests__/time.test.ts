/**
 * Deadline arithmetic.
 *
 * Every one of these takes an explicit `now`, so the suite does not depend on
 * when it runs. The urgency bands drive colour and sort order on every listing
 * screen; the roll-forward decides whether a late-evening pickup window is
 * accepted by the API at all.
 */

import { describe, expect, it } from 'vitest';
import { byUrgency, deadlineStatus, isPastDeadline, toFutureIso } from '../time';

const now = new Date('2026-09-05T12:00:00.000Z');

describe('deadlineStatus', () => {
  it('reports a passed deadline as overdue rather than as time remaining', () => {
    const status = deadlineStatus('2026-09-05T11:00:00.000Z', now);

    expect(status.urgency).toBe('expired');
    expect(status.label).toBe('Overdue');
    expect(status.minutesLeft).toBe(-60);
  });

  it('places the urgency bands at two and six hours', () => {
    // The boundaries themselves, because that is where an off-by-one lands.
    expect(deadlineStatus('2026-09-05T14:00:00.000Z', now).urgency).toBe('critical');
    expect(deadlineStatus('2026-09-05T14:01:00.000Z', now).urgency).toBe('soon');
    expect(deadlineStatus('2026-09-05T18:00:00.000Z', now).urgency).toBe('soon');
    expect(deadlineStatus('2026-09-05T18:01:00.000Z', now).urgency).toBe('ok');
  });

  it('switches to days once a deadline is more than a day out', () => {
    expect(deadlineStatus('2026-09-07T02:00:00.000Z', now).label).toBe('1d 14h left');
    expect(deadlineStatus('2026-09-05T15:30:00.000Z', now).label).toBe('3h 30m left');
  });

  it('keeps an unparseable deadline visible instead of dropping it', () => {
    const status = deadlineStatus('whenever', now);

    expect(status.minutesLeft).toBeNull();
    expect(status.label).toBe('by whenever');
    expect(status.urgency).toBe('ok');
  });
});

describe('isPastDeadline', () => {
  /**
   * The boundary instant is the whole point of this predicate existing beside
   * `deadlineStatus`. The server's rule is strictly-past — `pickup_deadline <
   * now`, the comparison `routers/admin.expire_overdue` sweeps on — so a
   * donation *at* its deadline is still collectable on both sides of the wire.
   */
  it('treats the deadline instant itself as not yet passed', () => {
    expect(isPastDeadline('2026-09-05T12:00:00.000Z', now)).toBe(false);
    expect(isPastDeadline('2026-09-05T12:00:00.001Z', now)).toBe(false);
    expect(isPastDeadline('2026-09-05T11:59:59.999Z', now)).toBe(true);
  });

  it('does not round to the minute the way the urgency bands do', () => {
    // 20 seconds past. `deadlineStatus` rounds `minutesLeft` to 0 and so calls
    // this "0m left"; the instants say the window has closed.
    const justPast = '2026-09-05T11:59:40.000Z';

    expect(deadlineStatus(justPast, now).urgency).not.toBe('expired');
    expect(isPastDeadline(justPast, now)).toBe(true);
  });

  it('keeps an unparseable deadline out of the past', () => {
    // Nothing is hidden on the strength of a date the client could not read.
    expect(isPastDeadline('whenever', now)).toBe(false);
    expect(isPastDeadline('', now)).toBe(false);
  });
});

describe('byUrgency', () => {
  it('sorts soonest first and sinks the unparseable to the bottom', () => {
    const deadlines = [
      '2026-09-05T18:00:00.000Z',
      'whenever',
      '2026-09-05T13:00:00.000Z',
    ];

    expect([...deadlines].sort((a, b) => byUrgency(a, b, now))).toEqual([
      '2026-09-05T13:00:00.000Z',
      '2026-09-05T18:00:00.000Z',
      'whenever',
    ]);
  });
});

describe('toFutureIso', () => {
  // `toFutureIso` builds the instant from local wall-clock hours, so these
  // assert the local hour and the ordering rather than a fixed UTC string —
  // otherwise the suite would only pass in one timezone.

  it('keeps a time still ahead on the same day', () => {
    const iso = toFutureIso('18:00', now);
    const parsed = new Date(iso!);

    expect(parsed.getHours()).toBe(18);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.toDateString()).toBe(now.toDateString());
  });

  it('rolls a time that has already passed to tomorrow', () => {
    // Posting at midday for collection "by 01:00" means tonight into tomorrow.
    // The API refuses a deadline in the past, so this is what makes it valid.
    const iso = toFutureIso('01:00', now);
    const parsed = new Date(iso!);

    expect(parsed.getHours()).toBe(1);
    expect(parsed.getTime()).toBeGreaterThan(now.getTime());
    expect(parsed.getTime() - now.getTime()).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('rejects a value that is not a time', () => {
    expect(toFutureIso('25:00', now)).toBeNull();
    expect(toFutureIso('tonight', now)).toBeNull();
  });
});
