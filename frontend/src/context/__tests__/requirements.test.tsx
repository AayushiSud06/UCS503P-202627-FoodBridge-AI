// @vitest-environment jsdom
/**
 * Where retired requirements are allowed to reach, and where they are not.
 *
 * Task 27 gave a retired need a reader (D-29), and the risk it introduced is
 * that the reader is a *shared* one: `state.requirements` feeds the NGO portal
 * and the donor needs board from the same slice, so a careless widening would
 * have put retired rows on `/donor/needs` — which D-44 says is a board of what
 * is open now, from verified organisations only.
 *
 * Two independent things keep that from happening, and both are asserted here:
 *
 *  1. the request. `includeInactive` is only ever sent for an `ngo` account, so
 *     a donor's slice never contains an inactive row to begin with. (The server
 *     refuses the flag for a donor regardless — `test_requirement_reads.py` —
 *     which is the boundary; this is the client not asking for it.)
 *  2. the selector. `useRequirements` — what every board renders, the donor
 *     needs board included — is the active ones. `useAllRequirements` is the
 *     opt-in that the NGO portal alone uses.
 *
 * `api` and `useAuth` are stubbed; the provider, the adapters and the selectors
 * are the real code.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { User } from '../../types';
import { apiMetrics, apiRequirement } from '../../test/fixtures';

const auth = vi.hoisted(() => ({ user: null as User | null }));

const apiMock = vi.hoisted(() => ({
  listDonations: vi.fn(async () => []),
  listRequirements: vi.fn(async (_params?: { includeInactive?: boolean }) => [] as unknown[]),
  listRecipients: vi.fn(async () => []),
  listVolunteers: vi.fn(async () => []),
  myVolunteer: vi.fn(async () => null),
  metrics: vi.fn(async () => apiMetrics()),
  updateRequirement: vi.fn(async () => apiRequirement()),
}));

vi.mock('../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, api: apiMock };
});

vi.mock('../AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../AuthContext')>();
  return { ...actual, useAuth: () => ({ user: auth.user }) };
});

const { AppProvider, useAllRequirements, useRequirements } = await import('../AppContext');
const { default: DonorNeedsBoard } = await import('../../pages/donor/DonorNeedsBoard');

function account(role: User['role']): User {
  return {
    id: '1',
    name: 'Test Account',
    email: 'test@example.org',
    role,
    avatarInitials: 'TA',
    entityId: role === 'ngo' ? '7' : undefined,
  };
}

/** Prints both selectors, so one render answers both questions. */
function Probe() {
  const active = useRequirements();
  const all = useAllRequirements();
  return (
    <>
      <span data-testid="active">{active.map(r => r.foodType).join('|')}</span>
      <span data-testid="all">{all.map(r => r.foodType).join('|')}</span>
    </>
  );
}

function renderAs(role: User['role'], requirements: unknown[]) {
  auth.user = account(role);
  apiMock.listRequirements.mockResolvedValue(requirements);
  render(
    <AppProvider>
      <Probe />
    </AppProvider> as ReactNode,
  );
}

const readable = (testId: string) => screen.getByTestId(testId).textContent ?? '';

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockClear());
  apiMock.listRequirements.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  auth.user = null;
});

describe('the requirements slice', () => {
  it('asks for retired needs on behalf of a kitchen', async () => {
    renderAs('ngo', []);

    await waitFor(() => expect(apiMock.listRequirements).toHaveBeenCalled());
    expect(apiMock.listRequirements).toHaveBeenCalledWith({ includeInactive: true });
  });

  it('does not ask for them on behalf of a donor', async () => {
    renderAs('donor', []);

    await waitFor(() => expect(apiMock.listRequirements).toHaveBeenCalled());
    expect(apiMock.listRequirements).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('does not ask for them on behalf of a courier or an administrator', async () => {
    renderAs('volunteer', []);
    await waitFor(() => expect(apiMock.listRequirements).toHaveBeenCalled());
    expect(apiMock.listRequirements).toHaveBeenCalledWith({ includeInactive: false });

    cleanup();
    apiMock.listRequirements.mockClear();

    renderAs('admin', []);
    await waitFor(() => expect(apiMock.listRequirements).toHaveBeenCalled());
    expect(apiMock.listRequirements).toHaveBeenCalledWith({ includeInactive: false });
  });

  it('keeps retired needs out of the board every screen renders', async () => {
    renderAs('ngo', [
      apiRequirement({ id: 1, foodType: 'Still open', isActive: true }),
      apiRequirement({ id: 2, foodType: 'Retired', isActive: false }),
    ]);

    await waitFor(() => expect(readable('all')).toContain('Still open'));
    // The donor needs board reads `useRequirements`, so this is the assertion
    // that a retired need cannot appear on `/donor/needs`.
    expect(readable('active')).toBe('Still open');
    // The portal's opt-in still gets both, newest-first order preserved.
    expect(readable('all')).toBe('Still open|Retired');
  });

  it('leaves a donor with the active board it always had', async () => {
    // Belt and braces: even if an inactive row somehow reached a donor's
    // slice, the selector every board renders would not show it.
    renderAs('donor', [
      apiRequirement({ id: 1, foodType: 'Open need', isActive: true }),
      apiRequirement({ id: 2, foodType: 'Retired need', isActive: false }),
    ]);

    await waitFor(() => expect(readable('all')).toContain('Open need'));
    expect(readable('active')).toBe('Open need');
  });
});

describe('the donor needs board, end to end', () => {
  /**
   * The board rendered through the real provider rather than a stubbed hook,
   * because the property worth holding spans both: what was fetched and what
   * the page then shows. Only `api` and `useAuth` are stubbed.
   */
  function renderBoardAs(role: User['role'], requirements: unknown[]) {
    auth.user = account(role);
    apiMock.listRequirements.mockResolvedValue(requirements);
    const { container } = render(
      <AppProvider>
        <DonorNeedsBoard />
      </AppProvider> as ReactNode,
    );
    return container;
  }

  it('shows a donor the open needs and none of the retired ones', async () => {
    const container = renderBoardAs('donor', [
      apiRequirement({ id: 1, foodType: 'Cooked lunch', isActive: true }),
      apiRequirement({ id: 2, foodType: 'Dry rations', isActive: false }),
    ]);

    await waitFor(() => expect(container.textContent).toContain('Cooked lunch'));
    expect(container.textContent).not.toContain('Dry rations');
    // And the count follows the board rather than the payload.
    expect(container.textContent).toContain('Showing 1 active need');
  });

  it('says the board is empty when every need on it has been retired', async () => {
    const container = renderBoardAs('donor', [
      apiRequirement({ id: 1, foodType: 'Cooked lunch', isActive: false }),
    ]);

    await waitFor(() => expect(container.textContent).toContain('No open needs right now'));
    expect(container.textContent).not.toContain('Cooked lunch');
  });
});
