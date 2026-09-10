// @vitest-environment jsdom
/**
 * What the admin Analytics page shows, and what it no longer shows.
 *
 * The removal: the page closed with `components/FutureIntelligenceSection.tsx`
 * — a *Future Intelligence Architecture* card badged *AI Innovation Roadmap*,
 * listing seven unbuilt services (a neural ranker, demand forecasting, vehicle
 * routing, a vision transformer, an LLM parser, a geospatial heatmap and a graph
 * neural network), each with a phase and an In Design / Planned status. Every
 * entry was labelled, which is why D-31 passed it twice; the product review
 * removed it anyway for D-48's reason, on the third and last of these surfaces.
 *
 * The card sat directly beneath the evaluation metrics D-01 exists to make
 * defensible — server-stamped, or a dash where the ledger cannot yet answer.
 * That adjacency is why the preservation half of this suite matters as much as
 * the absence half: the figures beside it are the honest ones, and a cleanup
 * must not take them with it.
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
const { default: AdminAnalytics } = await import('../AdminAnalytics');

const administrator: User = {
  id: '1',
  name: 'Priya Nair',
  email: 'priya@foodlink.test',
  role: 'admin',
  avatarInitials: 'PN',
  // No `entityId`: an admin account has neither a recipient nor a volunteer row.
};

/**
 * One completed donation carrying a frozen match score.
 *
 * An administrator is inside `_precise_distance_scope`, so `matchScore` really
 * does reach this reader (D-47) — which is what the average on this page is
 * computed from.
 */
const completedRun = apiDonation({
  id: 41,
  foodName: 'Vegetable biryani',
  category: 'Vegetarian',
  quantity: 40,
  unit: 'Meals',
  status: 'COMPLETED',
  matchScore: 83,
  recipientId: 7,
  recipientName: 'Helping Hands',
  events: [apiEvent('COMPLETED', '2026-09-05T13:30:00.000Z')],
});

function renderAnalytics(donations: unknown[] = [completedRun]) {
  auth.user = administrator;
  apiMock.listDonations.mockResolvedValue(donations);
  const { container } = render(
    <AppProvider>
      <AdminAnalytics />
    </AppProvider>,
  );
  return container;
}

beforeEach(() => {
  Object.values(apiMock).forEach(fn => fn.mockClear());
  apiMock.listDonations.mockResolvedValue([]);
  apiMock.metrics.mockResolvedValue(
    apiMetrics({
      totalMeals: 1240,
      completedDonations: 7,
      expiredDonations: 2,
      medianTimeToClaimMinutes: 34,
      medianHandoverMinutes: 95,
      rescueRatePercent: 88,
      expiryLossRatePercent: 4,
    }),
  );
});

afterEach(() => {
  cleanup();
  auth.user = null;
});

describe('the admin analytics page no longer carries a future-intelligence roadmap', () => {
  it('renders neither the section heading nor its roadmap badge', async () => {
    const container = renderAnalytics();

    await waitFor(() => expect(container.textContent).toContain('Rescue Rate'));
    expect(container.textContent).not.toContain('Future Intelligence Architecture');
    expect(container.textContent).not.toContain('AI Innovation Roadmap');
    expect(container.textContent).not.toContain('Prototype 1 (Current): Rule-Based Simulation');
    expect(container.textContent).not.toContain(
      'Planned AI/ML microservices designed to replace prototype heuristics',
    );
  });

  it('names none of the seven unbuilt services', async () => {
    // Each one, so a partial reintroduction fails too.
    const container = renderAnalytics();

    await waitFor(() => expect(container.textContent).toContain('Rescue Rate'));
    for (const title of [
      'ML-Based Recipient Ranking',
      'Demand-Aware Redistribution',
      'Volunteer Assignment & Route Optimization',
      'AI Food Image Categorization',
      'NLP-Based Donation Understanding',
      'Community Surplus/Demand Heatmap',
      'Recurring Donor-Recipient Partnerships',
    ]) {
      expect(container.textContent).not.toContain(title);
    }
  });

  it('carries no phase, status or category label from the roadmap', async () => {
    // 'Analytics' was a roadmap category too, and is deliberately not asserted
    // here — it is also the page's own title, which stays.
    const container = renderAnalytics();

    await waitFor(() => expect(container.textContent).toContain('Rescue Rate'));
    for (const label of [
      'Phase 2',
      'Advanced Phase',
      'In Design',
      'Planned',
      'Machine Learning',
      'Computer Vision',
      'Optimization',
      'NLP',
    ]) {
      expect(container.textContent).not.toContain(label);
    }
  });
});

describe('the analytics themselves are intact', () => {
  it('still renders all four evaluation metrics from the server figures', async () => {
    const container = renderAnalytics();

    await waitFor(() => expect(container.textContent).toContain('Total Meals Redistributed'));
    for (const label of ['Median Time to Claim', 'Median Handover', 'Rescue Rate']) {
      expect(container.textContent).toContain(label);
    }
    // The values, through the real adapter and the page's own formatters.
    expect(container.textContent).toContain('1,240');
    expect(container.textContent).toContain('7 completed donations');
    expect(container.textContent).toContain('34 min');
    expect(container.textContent).toContain('1h 35m');
    expect(container.textContent).toContain('88%');
    expect(container.textContent).toContain('4% expired unclaimed');
  });

  it('still renders both charts and the derived figures beneath them', async () => {
    const container = renderAnalytics();

    await waitFor(() =>
      expect(container.textContent).toContain('Weekly Redistribution Volume (Meals)'),
    );
    // Every weekday axis label survives.
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(container.textContent).toContain(day);
    }
    expect(container.textContent).toContain('meals this week');
    expect(container.textContent).toContain('Food Category Distribution');
    expect(container.textContent).toContain('Vegetarian');
    expect(container.textContent).toContain('Expired unclaimed');
    expect(container.textContent).toContain('Avg match compatibility');
    // Averaged over the donations that carry a frozen score.
    expect(container.textContent).toContain('83%');
  });

  it('still shows the category empty state rather than an invented breakdown', async () => {
    const container = renderAnalytics([]);

    await waitFor(() => expect(container.textContent).toContain('No donations listed yet.'));
    expect(container.textContent).toContain('Food Category Distribution');
  });

  it('still prints a dash where the ledger cannot answer yet', async () => {
    // D-01/D-31: an unmeasured metric is a dash, never a placeholder number.
    apiMock.metrics.mockResolvedValue(apiMetrics());
    const container = renderAnalytics([]);

    await waitFor(() => expect(container.textContent).toContain('Median Time to Claim'));
    expect(container.textContent).toContain('—');
    expect(container.textContent).toContain('Completed before deadline');
  });
});
