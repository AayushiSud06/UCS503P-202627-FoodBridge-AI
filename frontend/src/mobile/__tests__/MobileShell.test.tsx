// @vitest-environment jsdom
/**
 * The line above every phone screen's title.
 *
 * It used to be a literal per portal: every donor's header read "College
 * Central Mess" and every kitchen's "Helping Hands Kitchen" — the seeded
 * accounts' organisations, printed over whoever had actually signed in. The
 * desktop portals stopped doing that in I-1; the phone shell did not (P2-4).
 *
 * The donor and kitchen portals are shared by many accounts, so the header now
 * names the signed-in account. The courier and admin portals keep their role
 * labels, which are true of every account that can open them.
 *
 * `useAuth`/`useCurrentUser` are stubbed because identity is the input here,
 * and `useApp` only so `DataGate` lets the shell render. `ROLE_CONFIG` stays
 * the real map, so a reintroduced literal fails here rather than being mocked.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User, UserRole } from '../../types';

const session = vi.hoisted(() => ({
  user: null as User | null,
}));

vi.mock('../../context/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({ user: session.user, isLoading: false, signOut: () => {} }),
    useCurrentUser: () => session.user,
  };
});

vi.mock('../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      state: { isLoading: false, donations: [], loadError: null },
      refresh: async () => {},
    }),
  };
});

const { default: MobileShell } = await import('../MobileShell');
const { ROLE_CONFIG } = await import('../nav');

/** The seeded organisations the header used to print for every account. */
const SEEDED_IDENTITIES = ['College Central Mess', 'Helping Hands Kitchen', 'Helping Hands'];

function account(role: UserRole, overrides: Partial<User> = {}): User {
  return {
    id: '7',
    name: 'Asha Menon',
    email: 'asha@example.org',
    role,
    avatarInitials: 'AM',
    ...overrides,
  };
}

function renderShell(role: UserRole, user: User) {
  session.user = user;
  const config = ROLE_CONFIG[role];
  const { container } = render(
    <MemoryRouter initialEntries={[config.base]}>
      <MobileShell config={config} />
    </MemoryRouter>,
  );
  return {
    kicker: container.querySelector('header p')?.textContent ?? '',
    text: container.textContent ?? '',
  };
}

afterEach(() => {
  cleanup();
  session.user = null;
});

describe('MobileShell header', () => {
  it.each(['donor', 'ngo'] as const)(
    "names the signed-in %s account's own organisation",
    role => {
      const { kicker } = renderShell(role, account(role, { organization: 'Roti Bank Patiala' }));
      expect(kicker).toBe('Roti Bank Patiala');
    },
  );

  it.each(['donor', 'ngo'] as const)(
    'falls back to the person when a %s account names no organisation',
    role => {
      expect(renderShell(role, account(role)).kicker).toBe('Asha Menon');

      cleanup();
      // A cleared organisation is stored as an empty string, not null.
      expect(renderShell(role, account(role, { organization: '' })).kicker).toBe('Asha Menon');
    },
  );

  it('keeps the role labels on the courier and admin portals', () => {
    expect(renderShell('volunteer', account('volunteer', { organization: 'Anything' })).kicker)
      .toBe('Courier');

    cleanup();
    expect(renderShell('admin', account('admin')).kicker).toBe('FoodLink Platform');
  });

  it.each(Object.keys(ROLE_CONFIG) as UserRole[])(
    'prints no seeded organisation on the %s portal',
    role => {
      const { text } = renderShell(role, account(role, { organization: 'Roti Bank Patiala' }));

      for (const seeded of SEEDED_IDENTITIES) {
        expect(text, `${role} header still prints "${seeded}"`).not.toContain(seeded);
      }
    },
  );

  it('carries no fixed identity for a portal many accounts share', () => {
    // The config itself, not only what one render shows: a literal here would
    // be printed over every donor or kitchen that signs in.
    expect(ROLE_CONFIG.donor.kicker).toBeUndefined();
    expect(ROLE_CONFIG.ngo.kicker).toBeUndefined();
  });
});
