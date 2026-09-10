// @vitest-environment jsdom
/**
 * What the admin Platform Overview shows, and what it no longer shows.
 *
 * The removal: the dashboard closed with an *Intelligence Roadmap* card — three
 * phase blocks naming an ML-assisted ranker, route optimisation, food-image
 * categorisation and NLP. D-31 permitted it, because every phase carried a
 * label and a done/not-done marker, and the product review removed it anyway
 * for the reason D-48 gives one screen along: this page is a platform operator's
 * control panel, and a roadmap of unbuilt phases is not something they can act
 * on from here.
 *
 * The absence assertions are the point — a reintroduced roadmap should fail a
 * test rather than a review. The presence assertions are the guard on the other
 * side: a cleanup must not quietly become a deletion, so the metrics, the
 * charts, the activity feed and the donations table are all pinned here too.
 *
 * Only `api` and the two identity hooks are stubbed; the provider, the adapters
 * and the page are real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/react';
import type { User } from '../../../types';
import { apiDonation, apiEvent, apiMetrics } from '../../../test/fixtures';

const auth = vi.hoisted(() => ({ user: null as User | null }));

const apiMock = vi.hoisted(() => ({
  listDonations: vi.fn(async () => [] as unknown[]),
  listRequirements: vi.fn(async () => []),
  listRecipients: vi.fn(async () => []),
  listVolunteers: vi.fn(async () => []),
  myVolunteer: vi.fn(async () => null),
  metrics: vi.fn(async () => apiMetrics()),
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
const { default: AdminDashboard } = await import('../AdminDashboard');

const administrator: User = {
  id: '1',
  name: 'Priya Nair',
  email: 'priya@foodlink.test',
  role: 'admin',
  avatarInitials: 'PN',
  // No `entityId`: an admin account has neither a recipient nor a volunteer row.
};

/** One completed donation with a real event, so the feed and the table fill. */
const completedRun = apiDonation({
  id: 41,
  foodName: 'Vegetable biryani',
  donorOrganization: 'Hotel Rasoi',
  quantity: 40,
  unit: 'Meals',
  status: 'COMPLETED',
  recipientId: 7,
  recipientName: 'Helping Hands',
  events: [apiEvent('COMPLETED', '2026-09-05T13:30:00.000Z')],
});

function renderDashboard(donations: unknown[] = [completedRun]) {
  auth.user = administrator;
  apiMock.listDonations.mockResolvedValue(donations);
  const { container } = render(
    <AppProvider>
      <AdminDashboard />
    </AppProvider>,
  );
  return container;
}

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockClear());
  apiMock.listDonations.mockResolvedValue([]);
  apiMock.metrics.mockResolvedValue(
    apiMetrics({
      totalDonations: 12,
      completedDonations: 5,
      totalOrganizations: 3,
      totalVolunteers: 4,
    }),
  );
});

afterEach(() => {
  cleanup();
  auth.user = null;
});

describe('the admin dashboard no longer carries an intelligence roadmap', () => {
  it('does not render the Intelligence Roadmap section', async () => {
    const container = renderDashboard();

    await waitFor(() => expect(container.textContent).toContain('Platform Overview'));
    expect(container.textContent).not.toContain('Intelligence Roadmap');
  });

  it('names none of the roadmap phases', async () => {
    const container = renderDashboard();

    await waitFor(() => expect(container.textContent).toContain('Platform Overview'));
    for (const phase of ['Current Prototype', 'Prototype 2', 'Advanced Phase']) {
      expect(container.textContent).not.toContain(phase);
    }
  });

  it('claims none of the unbuilt capabilities the roadmap listed', async () => {
    // Each of the nine, so a partial reintroduction fails too. The four that
    // carry the actual claim — a learned ranker, requirement-aware
    // redistribution, routing and vision — are the ones D-05, D-33 and D-44
    // each record the system does not have.
    const container = renderDashboard();

    await waitFor(() => expect(container.textContent).toContain('Platform Overview'));
    for (const claim of [
      'Rule-based donor-recipient matching',
      'Complete donation lifecycle',
      'Role-based dashboards',
      'ML-assisted recipient ranking',
      'Demand-aware redistribution',
      'Volunteer route optimization',
      'AI food image categorization',
      'NLP donation understanding',
      'Community heatmap',
    ]) {
      expect(container.textContent).not.toContain(claim);
    }
  });
});

describe('the rest of the admin dashboard is intact', () => {
  it('still renders every metric card from the server figures', async () => {
    const container = renderDashboard();

    await waitFor(() => expect(container.textContent).toContain('Total Donations'));
    for (const label of [
      'Organizations',
      'Volunteers',
      'Meals Redistributed',
      'Completed',
      'Active Donations',
      'Successful Pickups',
    ]) {
      expect(container.textContent).toContain(label);
    }
    // The values come off `GET /api/metrics` through the real adapter, so an
    // empty page and a rendered one are distinguishable.
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('5');
  });

  it('still renders both charts and the activity feed', async () => {
    const container = renderDashboard();

    await waitFor(() =>
      expect(container.textContent).toContain('Meals Redistributed — This Week'),
    );
    expect(container.textContent).toContain('Food Categories');
    expect(container.textContent).toContain('Vegetarian');
    expect(container.textContent).toContain('Recent Activity');
    // Folded out of the donation's own status event by `toActivity`.
    expect(container.textContent).toContain('Redistribution complete');
  });

  it('still lists every donation in the platform table', async () => {
    const container = renderDashboard();

    await waitFor(() => expect(container.textContent).toContain('All Donations'));
    expect(container.textContent).toContain('Vegetable biryani');
    expect(container.textContent).toContain('Hotel Rasoi');
    expect(container.textContent).toContain('Helping Hands');
    expect(container.textContent).toContain('COMPLETED');
  });
});
