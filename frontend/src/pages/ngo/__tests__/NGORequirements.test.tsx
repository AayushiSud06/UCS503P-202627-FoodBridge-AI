// @vitest-environment jsdom
/**
 * The NGO requirements portal's lifecycle contract.
 *
 * The server keeps one lifecycle flag (D-29): retiring a need is
 * `isActive: false`, reopening it is `isActive: true`, and the row survives
 * both. Until Task 27 the flag was writable but unreadable — the listing was
 * active-only — so a retired need had no reader and reopening was API-only.
 * This page is that reader, and these are the three things it owes:
 *
 *  - a retired need is *visibly* retired, not silently mixed into the board;
 *  - reopening goes through the existing update path with `isActive: true`,
 *    not through a new endpoint or an invented status;
 *  - once it succeeds, the card moves.
 *
 * `useAllRequirements`, `useApp` and `useMyRecipient` are stubbed because the
 * page's input is app state. The requirements themselves are built through the
 * **real** `toRequirement` adapter from the real `ApiRequirement` shape, so a
 * wire contract that drifts from the backend fails to compile here.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { NGORequirement } from '../../../types';
import { requirement } from '../../../test/fixtures';

const portal = vi.hoisted(() => ({
  requirements: [] as NGORequirement[],
  reopenRequirement: vi.fn(async (_id: string) => {}),
  retireRequirement: vi.fn(async (_id: string) => {}),
  updateRequirement: vi.fn(),
  createRequirement: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useAllRequirements: () => portal.requirements,
    useMyRecipient: () => ({ id: '7' }),
    useApp: () => ({
      createRequirement: portal.createRequirement,
      updateRequirement: portal.updateRequirement,
      retireRequirement: portal.retireRequirement,
      reopenRequirement: portal.reopenRequirement,
      showToast: portal.showToast,
    }),
  };
});

const { default: NGORequirements } = await import('../NGORequirements');

/** A need belonging to the signed-in kitchen; `recipientId` matches the stub. */
function own(overrides: Parameters<typeof requirement>[0] = {}) {
  return requirement({ recipientId: 7, ...overrides });
}

function renderPortal(requirements: NGORequirement[] = []) {
  portal.requirements = requirements;
  const { container } = render(<NGORequirements />);
  return { container, text: container.textContent ?? '' };
}

beforeEach(() => {
  portal.reopenRequirement.mockClear();
  portal.retireRequirement.mockClear();
});

afterEach(() => {
  cleanup();
  portal.requirements = [];
});

describe('NGORequirements — retired needs', () => {
  it('distinguishes a retired need from an active one', () => {
    const { text } = renderPortal([
      own({ id: 1, foodType: 'Cooked lunch', isActive: true }),
      own({ id: 2, foodType: 'Dry rations', isActive: false }),
    ]);

    expect(text).toContain('Cooked lunch');
    expect(text).toContain('Dry rations');
    // The retired one is named as such, and says where it stands.
    expect(text).toContain('Retired requirements');
    expect(text).toContain('Off the demand board');
    // And the active one still says it is on the board.
    expect(text).toContain('Active on the demand board');
  });

  it('keeps the retired section out of the way when nothing is retired', () => {
    const { text } = renderPortal([own({ id: 1, isActive: true })]);

    expect(text).toContain('Active on the demand board');
    expect(text).not.toContain('Retired requirements');
    expect(text).not.toContain('Off the demand board');
  });

  it('offers reopen on a retired need and not on an active one', () => {
    renderPortal([own({ id: 1, isActive: true })]);
    expect(screen.queryByRole('button', { name: /reopen/i })).toBeNull();
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeTruthy();

    cleanup();
    renderPortal([own({ id: 2, isActive: false })]);
    expect(screen.getByRole('button', { name: /reopen/i })).toBeTruthy();
    // Retiring something already retired is not an action that exists.
    expect(screen.queryByRole('button', { name: /mark fulfilled/i })).toBeNull();
  });

  it('reopens through the shared update path, by id', async () => {
    renderPortal([own({ id: 42, isActive: false })]);

    fireEvent.click(screen.getByRole('button', { name: /reopen/i }));

    // `reopenRequirement` is `api.updateRequirement(id, { isActive: true })` —
    // the existing PATCH, not a second endpoint (D-29).
    await waitFor(() => expect(portal.reopenRequirement).toHaveBeenCalledWith('42'));
    expect(portal.retireRequirement).not.toHaveBeenCalled();
  });

  it('shows the reopened need on the active board once the reload lands', async () => {
    // The context re-reads the slice from the server after a write, so success
    // is the page re-rendering with the row now active — not a local patch.
    const { rerender } = render(<NGORequirements />);
    portal.requirements = [own({ id: 42, foodType: 'Dry rations', isActive: false })];
    rerender(<NGORequirements />);
    expect(screen.getByText('Retired requirements')).toBeTruthy();

    portal.requirements = [own({ id: 42, foodType: 'Dry rations', isActive: true })];
    rerender(<NGORequirements />);

    expect(screen.queryByText('Retired requirements')).toBeNull();
    expect(screen.getByText('Dry rations')).toBeTruthy();
    expect(screen.getByRole('button', { name: /mark fulfilled/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /reopen/i })).toBeNull();
  });

  it('retires an active need through the existing path', async () => {
    renderPortal([own({ id: 9, isActive: true })]);

    fireEvent.click(screen.getByRole('button', { name: /mark fulfilled/i }));

    await waitFor(() => expect(portal.retireRequirement).toHaveBeenCalledWith('9'));
    expect(portal.reopenRequirement).not.toHaveBeenCalled();
  });

  it('shows another organisation nothing, retired or otherwise', () => {
    // The server already scopes this list (D-44); the page's own filter is
    // defence in depth, and it has to hold for retired rows too.
    const { text } = renderPortal([
      own({ id: 1, foodType: 'My retired need', isActive: false }),
      requirement({ id: 2, recipientId: 99, foodType: 'Rival retired need', isActive: false }),
    ]);

    expect(text).toContain('My retired need');
    expect(text).not.toContain('Rival retired need');
  });

  it('does not invent a fulfilled state beside the two the server keeps', () => {
    const { text } = renderPortal([own({ id: 1, isActive: false })]);

    // "Mark fulfilled" is the *button* on an active card and is gone here;
    // a retired need must not claim to have been fulfilled, because the row
    // cannot tell a need that was met from one that simply lapsed (D-29).
    expect(text).not.toMatch(/\bfulfilled\b/i);
    expect(text).not.toMatch(/\bcompleted\b/i);
  });
});
