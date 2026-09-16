// @vitest-environment jsdom
/**
 * Whose identity the phone donor profile shows.
 *
 * Its header used to print a literal email, `aayushi@thapar.edu`, and the
 * initials "AS" over whichever donor had signed in (P2-4 residue). Both now
 * come from the signed-in account, as the kitchen and courier profiles already
 * did.
 *
 * `useAuth`/`useCurrentUser` are stubbed because identity is the input here.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '../../types';

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

const { default: DonorProfile } = await import('../DonorProfile');

function donor(overrides: Partial<User> = {}): User {
  return {
    id: '7',
    name: 'Asha Menon',
    email: 'asha@example.org',
    role: 'donor',
    avatarInitials: 'AM',
    organization: 'Hotel Rasoi',
    ...overrides,
  };
}

function renderProfile(user: User) {
  session.user = user;
  const { container } = render(
    <MemoryRouter>
      <DonorProfile />
    </MemoryRouter>,
  );
  const header = container.querySelector('section') as HTMLElement;
  return {
    container,
    avatar: header.querySelector('span')?.textContent ?? '',
    subtitle: header.querySelector('h2 + p')?.textContent ?? '',
  };
}

afterEach(() => {
  cleanup();
  session.user = null;
});

describe('DonorProfile (mobile)', () => {
  it("shows the signed-in donor's own email and initials", () => {
    const { avatar, subtitle } = renderProfile(donor());

    expect(subtitle).toBe('asha@example.org');
    expect(avatar).toBe('AM');
  });

  it('follows the account rather than a fixed identity', () => {
    const { avatar, subtitle } = renderProfile(
      donor({ id: '12', name: 'Kabir Singh', email: 'kabir@rotibank.in', avatarInitials: 'KS' }),
    );

    expect(subtitle).toBe('kabir@rotibank.in');
    expect(avatar).toBe('KS');
  });

  it('prints no seeded identity anywhere on the screen', () => {
    const { container } = renderProfile(donor());

    expect(container.innerHTML).not.toContain('aayushi');
    expect(container.innerHTML).not.toContain('thapar.edu');
    expect(container.querySelector('section span')?.textContent).not.toBe('AS');
  });
});
