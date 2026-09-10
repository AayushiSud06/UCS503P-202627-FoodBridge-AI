// @vitest-environment jsdom
/**
 * What reaches the NGO's Available Donations page, and what does not.
 *
 * The page used to define "available" by status alone, so a donation whose
 * pickup deadline had passed sat in the list with an Accept button — the server
 * had not retired it, because the expiry sweep that would is unscheduled
 * (`TASKS.md` -> *Backlog -> E*). The server is now the boundary
 * (`routers/donations._open_to_recipients`, `test_available_donations_deadline.py`);
 * `useAvailableDonations` is the client saying the same thing, for the case the
 * server cannot reach — a deadline passing while the page sits open, since this
 * slice is refetched on a write rather than on a timer.
 *
 * Three things are asserted:
 *
 *  - an overdue open donation is not offered, and the count follows the list;
 *  - the boundary instant is still open, matching the server's strictly-past
 *    comparison, which is why the clock is frozen here;
 *  - **`useDonations` is untouched.** Every history surface — the accepted list,
 *    the timeline, the donor's own listings — reads that hook, so the narrowing
 *    has to be confined to the new selector.
 *
 * Only `api` and the two identity hooks are stubbed. The provider, the adapters,
 * the selector and the page are the real code, and the donations are built
 * through the real `toDonation` adapter from the real `ApiDonation` shape.
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { User } from '../../../types';
import { apiDonation, apiMetrics } from '../../../test/fixtures';

/** The instant every deadline below is expressed relative to. */
const NOW = new Date('2026-09-05T12:00:00.000Z');

const auth = vi.hoisted(() => ({ user: null as User | null }));

const apiMock = vi.hoisted(() => ({
  listDonations: vi.fn(async () => [] as unknown[]),
  listRequirements: vi.fn(async () => []),
  listRecipients: vi.fn(async () => []),
  listVolunteers: vi.fn(async () => []),
  myVolunteer: vi.fn(async () => null),
  metrics: vi.fn(async () => apiMetrics()),
  updateDonationStatus: vi.fn(),
}));

vi.mock('../../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('../../../context/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({ user: auth.user }),
    // Stubbed as well as `useAuth`, because the real one closes over the real
    // `useAuth` inside its own module and so would look for a provider.
    useCurrentUser: () => auth.user as User,
  };
});

const { AppProvider, useAvailableDonations, useDonations } = await import(
  '../../../context/AppContext'
);
const { default: NGOAvailableDonations } = await import('../NGOAvailableDonations');

const kitchen: User = {
  id: '1',
  name: 'Kitchen Lead',
  email: 'lead@example.org',
  role: 'ngo',
  avatarInitials: 'KL',
  entityId: '7',
};

/** A deadline `minutes` from the frozen clock; negative for the past. */
function deadline(minutes: number): string {
  return new Date(NOW.getTime() + minutes * 60_000).toISOString();
}

/** Prints both selectors, so one render answers both questions. */
function Probe() {
  const all = useDonations();
  const available = useAvailableDonations();
  return (
    <>
      <span data-testid="all">{all.map(d => d.foodName).join('|')}</span>
      <span data-testid="available">{available.map(d => d.foodName).join('|')}</span>
    </>
  );
}

function renderWith(donations: unknown[], child: ReactNode) {
  auth.user = kitchen;
  apiMock.listDonations.mockResolvedValue(donations);
  const { container } = render(
    <MemoryRouter>
      <AppProvider>{child}</AppProvider>
    </MemoryRouter> as ReactNode,
  );
  return container;
}

const readable = (testId: string) => screen.getByTestId(testId).textContent ?? '';

beforeAll(() => {
  // Only `Date` is faked, so Testing Library's own waiting still runs on real
  // timers. The frozen clock is what makes the boundary case assertable.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockClear());
  apiMock.listDonations.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.user = null;
});

describe('the available-donations selector', () => {
  it('offers an open donation inside its collection window', async () => {
    renderWith(
      [apiDonation({ id: 1, foodName: 'Still collectable', pickupDeadline: deadline(90) })],
      <Probe />,
    );

    await waitFor(() => expect(readable('all')).toContain('Still collectable'));
    expect(readable('available')).toBe('Still collectable');
  });

  it('does not offer an open donation whose deadline has passed', async () => {
    renderWith(
      [
        apiDonation({ id: 1, foodName: 'Open', pickupDeadline: deadline(90) }),
        apiDonation({ id: 2, foodName: 'Overdue', pickupDeadline: deadline(-30) }),
        apiDonation({
          id: 3,
          foodName: 'Overdue and matched',
          status: 'MATCHED',
          pickupDeadline: deadline(-1),
        }),
      ],
      <Probe />,
    );

    await waitFor(() => expect(readable('all')).toContain('Overdue'));
    expect(readable('available')).toBe('Open');
  });

  it('still offers a donation at the deadline instant itself', async () => {
    // Strictly past is overdue — the same boundary the server sweeps on, so the
    // two do not disagree about the one instant a deadline actually names.
    renderWith(
      [
        apiDonation({ id: 1, foodName: 'On the boundary', pickupDeadline: deadline(0) }),
        apiDonation({ id: 2, foodName: 'One second past', pickupDeadline: deadline(-1 / 60) }),
      ],
      <Probe />,
    );

    await waitFor(() => expect(readable('all')).toContain('On the boundary'));
    expect(readable('available')).toBe('On the boundary');
  });

  it('leaves every history surface the whole slice it always had', async () => {
    // `useDonations` is what the accepted list, the timeline and the donor's own
    // listings read. An overdue donation this kitchen accepted is its record,
    // and narrowing the offer must not narrow that.
    renderWith(
      [
        apiDonation({ id: 1, foodName: 'Overdue and unclaimed', pickupDeadline: deadline(-30) }),
        apiDonation({
          id: 2,
          foodName: 'Overdue and ours',
          status: 'ACCEPTED',
          recipientId: 7,
          pickupDeadline: deadline(-30),
        }),
        apiDonation({
          id: 3,
          foodName: 'Delivered last week',
          status: 'COMPLETED',
          recipientId: 7,
          pickupDeadline: deadline(-10_000),
        }),
      ],
      <Probe />,
    );

    await waitFor(() => expect(readable('all')).toContain('Overdue and unclaimed'));
    expect(readable('all')).toBe(
      'Overdue and unclaimed|Overdue and ours|Delivered last week',
    );
    // None of the three is an offer, and the accepted one is not lost.
    expect(readable('available')).toBe('');
  });
});

describe('the Available Donations page', () => {
  it('lists what is collectable and counts only that', async () => {
    const container = renderWith(
      [
        apiDonation({ id: 1, foodName: 'Vegetable pulao', pickupDeadline: deadline(120) }),
        apiDonation({ id: 2, foodName: 'Yesterday rotis', pickupDeadline: deadline(-120) }),
      ],
      <NGOAvailableDonations />,
    );

    await waitFor(() => expect(container.textContent).toContain('Vegetable pulao'));
    expect(container.textContent).not.toContain('Yesterday rotis');
    expect(container.textContent).toContain('1 donation available for pickup');
  });

  it('says nothing is available when every open donation is overdue', async () => {
    const container = renderWith(
      [apiDonation({ id: 1, foodName: 'Yesterday rotis', pickupDeadline: deadline(-120) })],
      <NGOAvailableDonations />,
    );

    await waitFor(() => expect(container.textContent).toContain('No available donations'));
    expect(container.textContent).not.toContain('Yesterday rotis');
    expect(container.textContent).toContain('0 donations available for pickup');
  });
});
