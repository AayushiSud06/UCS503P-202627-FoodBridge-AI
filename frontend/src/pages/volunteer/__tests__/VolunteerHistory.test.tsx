// @vitest-environment jsdom
/**
 * What reaches a courier's Volunteer History, and what does not.
 *
 * The defect: this log filtered on `COMPLETED` alone, but `COMPLETED` is the
 * **kitchen's** confirmation of receipt (`TRANSITION_ROLES[COMPLETED]` is
 * `{ngo, admin}`). The furthest state a courier can drive is `DELIVERED`
 * — held on the server by `test_volunteer_delivery_history.py` — so marking a run
 * delivered erased it from the whole portal: it left `VolunteerTasks`' active
 * list (`ACCEPTED`/`VOLUNTEER_ASSIGNED`/`PICKED_UP`) and arrived in neither this
 * log nor that page's completed section, until a kitchen confirmed receipt some
 * unbounded time later.
 *
 * The backend was never at fault — a courier's read scope carries every donation
 * with their `volunteer_id`, whatever its state — so these tests feed the real
 * wire shapes through the real provider and adapters and assert on the two
 * screens, which is where the filter lives.
 *
 * Held here: the pre-completion state, the just-delivered run, the confirmed run
 * beside it, and the ownership filter that keeps one courier's run out of
 * another's history.
 *
 * Only `api` and the two identity hooks are stubbed.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User } from '../../../types';
import { apiDonation, apiEvent, apiMetrics } from '../../../test/fixtures';

/** The signed-in courier's `Volunteer.id`, which is what `entityId` carries. */
const ME = 5;
const SOMEONE_ELSE = 9;

const auth = vi.hoisted(() => ({ user: null as User | null }));

const apiMock = vi.hoisted(() => ({
  listDonations: vi.fn(async () => [] as unknown[]),
  listRequirements: vi.fn(async () => []),
  listRecipients: vi.fn(async () => []),
  listVolunteers: vi.fn(async () => []),
  myVolunteer: vi.fn(async () => null),
  metrics: vi.fn(async () => apiMetrics()),
  updateStatus: vi.fn(),
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
    useCurrentUser: () => auth.user as User,
  };
});

const { AppProvider } = await import('../../../context/AppContext');
const { default: VolunteerHistory } = await import('../VolunteerHistory');
const { default: VolunteerTasks } = await import('../VolunteerTasks');

const courier: User = {
  id: '3',
  name: 'Aarav Sharma',
  email: 'aarav@example.org',
  role: 'volunteer',
  avatarInitials: 'AS',
  entityId: String(ME),
};

/** A run belonging to this courier, at the given stage. */
function myRun(id: number, status: string, foodName: string, extra: object = {}) {
  return apiDonation({
    id,
    foodName,
    status: status as never,
    volunteerId: ME,
    volunteerName: 'Aarav Sharma',
    recipientId: 7,
    recipientName: 'Helping Hands',
    ...extra,
  });
}

function renderScreen(donations: unknown[], child: ReactNode) {
  auth.user = courier;
  apiMock.listDonations.mockResolvedValue(donations);
  const { container } = render(<AppProvider>{child}</AppProvider> as ReactNode);
  return container;
}

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockClear());
  apiMock.listDonations.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.user = null;
});

describe('Volunteer History', () => {
  it('records a run the courier has marked delivered', async () => {
    // The regression. This is the state the courier's own last action produces,
    // and the log used to be empty here.
    const container = renderScreen(
      [
        myRun(1, 'DELIVERED', 'Vegetable biryani', {
          events: [apiEvent('DELIVERED', '2026-09-05T13:30:00.000Z')],
        }),
      ],
      <VolunteerHistory />,
    );

    await waitFor(() => expect(container.textContent).toContain('Vegetable biryani'));
    expect(container.textContent).not.toContain('No completed deliveries yet');
    // The badge still says which of the two states it is, so a run awaiting the
    // kitchen's confirmation is not presented as confirmed.
    expect(container.textContent).toContain('Delivered');
    // And the timestamp comes off the real event through the real adapter.
    expect(container.textContent).not.toContain('Not recorded');
  });

  it('keeps recording a run once the kitchen has confirmed receipt', async () => {
    const container = renderScreen(
      [myRun(1, 'COMPLETED', 'Dal and rice')],
      <VolunteerHistory />,
    );

    await waitFor(() => expect(container.textContent).toContain('Dal and rice'));
  });

  it('shows a delivered run and an earlier confirmed one together', async () => {
    const container = renderScreen(
      [
        myRun(1, 'COMPLETED', 'Last week run'),
        myRun(2, 'DELIVERED', 'Today run'),
      ],
      <VolunteerHistory />,
    );

    await waitFor(() => expect(container.textContent).toContain('Last week run'));
    expect(container.textContent).toContain('Today run');
  });

  it('leaves a run still in progress out of the log', async () => {
    // History is finished work. A claimed or collected run belongs to the tasks
    // screen, and widening the filter must not have swept those in.
    const container = renderScreen(
      [
        myRun(1, 'VOLUNTEER_ASSIGNED', 'Claimed not collected'),
        myRun(2, 'PICKED_UP', 'In the van'),
      ],
      <VolunteerHistory />,
    );

    await waitFor(() => expect(container.textContent).toContain('No completed deliveries yet'));
    expect(container.textContent).not.toContain('Claimed not collected');
    expect(container.textContent).not.toContain('In the van');
  });

  it("keeps another courier's delivered run out of this courier's history", async () => {
    const container = renderScreen(
      [
        myRun(1, 'DELIVERED', 'My run'),
        apiDonation({
          id: 2,
          foodName: 'Not my run',
          status: 'DELIVERED',
          volunteerId: SOMEONE_ELSE,
          volunteerName: 'Meera Kapoor',
        }),
        apiDonation({
          id: 3,
          foodName: 'Also not my run',
          status: 'COMPLETED',
          volunteerId: SOMEONE_ELSE,
        }),
      ],
      <VolunteerHistory />,
    );

    await waitFor(() => expect(container.textContent).toContain('My run'));
    expect(container.textContent).not.toContain('Not my run');
    expect(container.textContent).not.toContain('Also not my run');
  });
});

describe('the Pickup Tasks page', () => {
  it('moves a delivered run out of Active and into Recently Completed', async () => {
    // The same defect on the page the courier is standing on when they finish:
    // the run left Active and reached neither section.
    const container = renderScreen(
      [
        myRun(1, 'PICKED_UP', 'Still carrying'),
        myRun(2, 'DELIVERED', 'Just dropped off'),
      ],
      <VolunteerTasks />,
    );

    await waitFor(() => expect(container.textContent).toContain('Still carrying'));
    expect(container.textContent).toContain('Recently Completed');
    expect(container.textContent).toContain('Just dropped off');
    // One active task, not two — the delivered run is no longer one.
    expect(container.textContent).toContain('1 active task');
  });

  it("does not list another courier's finished run as recently completed", async () => {
    const container = renderScreen(
      [
        apiDonation({
          id: 1,
          foodName: 'Not my run',
          status: 'DELIVERED',
          volunteerId: SOMEONE_ELSE,
        }),
      ],
      <VolunteerTasks />,
    );

    await waitFor(() => expect(container.textContent).toContain("You're all caught up!"));
    expect(container.textContent).not.toContain('Recently Completed');
  });
});
