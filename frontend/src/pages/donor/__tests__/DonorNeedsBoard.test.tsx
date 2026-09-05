// @vitest-environment jsdom
/**
 * The donor needs board's rendering contract.
 *
 * Two properties are worth holding here and they pull in opposite directions.
 *
 * The first is that a need actually reaches the reader: the organisation, its
 * verification state, the food, the quantity, who it feeds, whether it recurs,
 * and the operator's own notes. A board that silently drops a field is a board
 * a kitchen cannot rely on.
 *
 * The second is D-31, and it is why the negative assertions are here. Nothing
 * in the repository connects a requirement to a donation — `matching.py` never
 * reads the table, the schema has no relationship, and no endpoint fulfils a
 * need. So the page must not imply otherwise, and it must not print a figure it
 * did not receive. Both are one careless sentence away, and both would be
 * type-correct.
 *
 * `useRequirements` and `useLoadState` are stubbed because the board's input is
 * app state; the requirements themselves are built through the **real**
 * `toRequirement` adapter from the real `ApiRequirement` shape, so a wire
 * contract that drifts from the backend fails to compile here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { NGORequirement } from '../../../types';
import { requirement } from '../../../test/fixtures';

const board = vi.hoisted(() => ({
  requirements: [] as NGORequirement[],
  load: { isLoading: false, error: null as string | null, retry: async () => {} },
}));

vi.mock('../../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useRequirements: () => board.requirements,
    useLoadState: () => board.load,
  };
});

const { default: DonorNeedsBoard } = await import('../DonorNeedsBoard');

function renderBoard(requirements: NGORequirement[] = []) {
  board.requirements = requirements;
  const { container } = render(<DonorNeedsBoard />);
  return { container, text: container.textContent ?? '' };
}

afterEach(() => {
  cleanup();
  board.requirements = [];
  board.load = { isLoading: false, error: null, retry: async () => {} };
});

describe('DonorNeedsBoard', () => {
  it('renders the organisation, food, quantity and beneficiaries of a need', () => {
    const { text } = renderBoard([
      requirement({
        recipientName: 'Roti Bank Patiala',
        foodType: 'Cooked lunch',
        quantityNeeded: 250,
        unit: 'Meals',
        beneficiaryCount: 300,
        urgency: 'High',
      }),
    ]);

    expect(text).toContain('Roti Bank Patiala');
    expect(text).toContain('Cooked lunch');
    expect(text).toContain('250 Meals');
    expect(text).toContain('300');
    expect(text).toContain('High');
  });

  it('marks a need from a verified organisation as verified', () => {
    const { text } = renderBoard([requirement({ isVerified: true })]);
    expect(text).toContain('Verified organisation');
  });

  it('does not label an organisation verified when the server did not say so', () => {
    // The donor scope only serves verified organisations (D-44), so this should
    // not arise — but the badge must follow the field rather than the page.
    const { text } = renderBoard([requirement({ isVerified: false })]);
    expect(text).not.toContain('Verified organisation');
  });

  it('says when a need recurs, and stays quiet when it does not', () => {
    const { text: recurring } = renderBoard([requirement({ dailyRecurring: true })]);
    expect(recurring).toContain('Needed daily');

    cleanup();
    const { text: oneOff } = renderBoard([requirement({ dailyRecurring: false })]);
    expect(oneOff).not.toContain('Needed daily');
  });

  it('renders the operator notes as text when there are any', () => {
    const { container, text } = renderBoard([
      requirement({ notes: 'Please pack in <sealed> trays before 6 PM.' }),
    ]);

    // Rendered through React, so the angle brackets are text and not markup —
    // this field is operator-authored and now donor-facing.
    expect(text).toContain('Please pack in <sealed> trays before 6 PM.');
    expect(container.querySelector('sealed')).toBeNull();
  });

  it('omits the notes block entirely when a need has none', () => {
    const { text } = renderBoard([requirement({ notes: '', foodType: 'Dry rations' })]);
    expect(text).toContain('Dry rations');
    expect(text).not.toContain('💬');
  });

  it('omits the beneficiary figure rather than printing a bare zero', () => {
    // The field is optional on the NGO form and defaults to 0, which means
    // "not stated" — printing "~0 people" would be an invented reading.
    const { text } = renderBoard([requirement({ beneficiaryCount: 0 })]);
    expect(text).not.toContain('people');
    expect(text).not.toContain('BENEFICIARIES');
  });

  it('renders every need it is given, in the order the server returned them', () => {
    const { container } = renderBoard([
      requirement({ id: 1, foodType: 'Newest need' }),
      requirement({ id: 2, foodType: 'Older need' }),
      requirement({ id: 3, foodType: 'Oldest need' }),
    ]);

    const headings = Array.from(container.querySelectorAll('article h3')).map(h => h.textContent);
    expect(headings).toEqual(['Newest need', 'Older need', 'Oldest need']);
  });

  it('explains the empty board instead of inventing activity', () => {
    const { text } = renderBoard([]);

    expect(text).toContain('No open needs right now');
    expect(text).toContain('verified recipient organisation');
    expect(text).not.toMatch(/\b\d+ active needs?\b/);
  });

  it('shows a loading state while the first fetch is in flight', () => {
    board.load = { isLoading: true, error: null, retry: async () => {} };
    renderBoard([]);

    expect(screen.getByLabelText('Loading needs')).toBeTruthy();
    // Neither the empty state nor a count while the answer is unknown.
    expect(screen.queryByText('No open needs right now')).toBeNull();
  });

  it('reports a failed load and offers a retry', () => {
    board.load = { isLoading: false, error: 'Network request failed', retry: async () => {} };
    const { text } = renderBoard([]);

    expect(text).toContain('Could not load the needs board');
    expect(text).toContain('Network request failed');
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
  });

  it('counts only what it was actually given', () => {
    const { text } = renderBoard([requirement({ id: 1 }), requirement({ id: 2 })]);
    expect(text).toContain('Showing 2 active needs');
  });

  it('claims no commitment, fulfilment or automatic matching', () => {
    const { container, text } = renderBoard([
      requirement({ notes: 'Anything vegetarian helps.' }),
    ]);

    // Nothing connects a requirement to a donation anywhere in the system, so
    // nothing on this page may suggest that reading it, or donating, does.
    for (const claim of [
      /fulfil/i,
      /fulfill/i,
      /claim this/i,
      /reserved/i,
      /you have committed/i,
      /matched to your donation/i,
      /automatically/i,
    ]) {
      expect(text, `needs board implies ${claim}`).not.toMatch(claim);
    }

    // Read-only: no button or form on a need card.
    expect(container.querySelector('article button')).toBeNull();
    expect(container.querySelector('form')).toBeNull();
  });

  it('prints no platform statistic it was never given', () => {
    const { text } = renderBoard([requirement({ quantityNeeded: 120, beneficiaryCount: 140 })]);

    // The only numbers on the board are the ones on the needs themselves plus
    // the count of needs shown. Percentages, totals and "meals rescued" style
    // figures have no source on this page.
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/meals (rescued|saved|redistributed)/i);
    expect(text).not.toMatch(/needs (met|fulfilled)/i);
  });
});
