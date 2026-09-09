// @vitest-environment jsdom
/**
 * The sign-in screen's contracts, held across a visual redesign.
 *
 * Task 30 rebuilt this page's presentation and removed two things that made it
 * read as a demonstration rather than a product: the block explaining the
 * seeded password, and the role tiles' habit of silently typing a seeded
 * account into the form. The credentials themselves are unchanged and still
 * documented in `docs/authentication.md`; they simply no longer appear in the
 * interface.
 *
 * What is asserted here is behaviour, not layout — the roles stay selectable,
 * the typed credentials are what `signIn` receives, validation and error
 * states still show, and registration is still one click away — so the page
 * stays free to be restyled again while a reintroduced demo credential, or a
 * broken submit, fails here.
 *
 * `useAuth` is the one thing stubbed, because identity is the boundary this
 * screen talks across. `errorMessage` and `HOME_PATH` stay real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { User } from '../../types';

const auth = vi.hoisted(() => ({
  state: {
    user: null as User | null,
    isLoading: false,
    expiredMessage: null as string | null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    clearExpiredMessage: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock('../../context/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...actual, useAuth: () => auth.state };
});

const { default: Login } = await import('../Login');

/** The seeded demo accounts the page used to fill in on a role click. */
const SEEDED = ['aayushi@thapar.edu', 'raj@helpinghands.org', 'aarav@thapar.edu', 'admin@foodlink.ai'];

function renderLogin() {
  const { container } = render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

  const byId = <T extends HTMLElement>(id: string) => container.querySelector(`#${id}`) as T | null;
  const require_ = <T extends HTMLElement>(id: string): T => {
    const found = byId<T>(id);
    if (!found) throw new Error(`#${id} is not on the page`);
    return found;
  };

  return {
    container,
    text: () => container.textContent ?? '',
    byId,
    email: () => require_<HTMLInputElement>('email'),
    password: () => require_<HTMLInputElement>('password'),
    submit: () => require_<HTMLButtonElement>('btn-signin'),
    type: (field: HTMLInputElement, value: string) =>
      fireEvent.change(field, { target: { value } }),
  };
}

beforeEach(() => {
  auth.state.user = null;
  auth.state.expiredMessage = null;
  auth.state.signIn.mockReset().mockResolvedValue(undefined);
  auth.state.signUp.mockReset().mockResolvedValue(undefined);
  auth.state.clearExpiredMessage.mockReset();
});

afterEach(cleanup);

describe('Login', () => {
  it('renders the sign-in screen', () => {
    const page = renderLogin();

    expect(page.text()).toContain('Welcome back');
    expect(page.byId('email')).not.toBeNull();
    expect(page.byId('password')).not.toBeNull();
    expect(page.submit().textContent).toContain('Sign In');
  });

  it('sends nobody to a dashboard', () => {
    const page = renderLogin();

    expect(page.text()).toContain('Sign in to continue to your side of the handover');
    expect(page.text()).not.toContain('Sign in to continue to your dashboard');
    expect(page.text()).not.toMatch(/dashboard/i);
  });

  it('names no demo account and prints no password', () => {
    const page = renderLogin();

    expect(page.text()).not.toMatch(/demo/i);
    expect(page.text()).not.toContain('foodlink123');
    for (const address of SEEDED) {
      expect(page.container.innerHTML, `the page still carries "${address}"`).not.toContain(address);
    }
  });

  it('keeps every role selectable, and fills in nothing when one is picked', () => {
    const page = renderLogin();

    page.type(page.email(), 'someone@example.org');

    for (const role of ['donor', 'ngo', 'volunteer', 'admin']) {
      const tile = page.byId<HTMLButtonElement>(`role-${role}`);
      expect(tile, `the ${role} role is not offered`).not.toBeNull();

      fireEvent.click(tile!);
      expect(tile!.getAttribute('aria-pressed')).toBe('true');

      // Picking a role used to overwrite both fields with a seeded account.
      expect(page.email().value).toBe('someone@example.org');
      expect(page.password().value).toBe('');
    }
  });

  it('signs in with exactly what was typed', async () => {
    const page = renderLogin();

    page.type(page.email(), 'asha@example.org');
    page.type(page.password(), 'not-the-seed');
    fireEvent.click(page.submit());

    await waitFor(() => expect(auth.state.signIn).toHaveBeenCalledTimes(1));
    expect(auth.state.signIn).toHaveBeenCalledWith('asha@example.org', 'not-the-seed');
  });

  it('refuses an empty form without calling the API', async () => {
    const page = renderLogin();

    fireEvent.click(page.submit());

    await waitFor(() =>
      expect(page.text()).toContain('Enter your email address and password.'),
    );
    expect(auth.state.signIn).not.toHaveBeenCalled();
  });

  it('shows the reason a sign-in was rejected', async () => {
    auth.state.signIn.mockRejectedValue(new Error('Incorrect email or password.'));
    const page = renderLogin();

    page.type(page.email(), 'asha@example.org');
    page.type(page.password(), 'wrong');
    fireEvent.click(page.submit());

    await waitFor(() => expect(page.text()).toContain('Incorrect email or password.'));
    expect(page.byId('login-error')).not.toBeNull();
  });

  it('lets a new visitor switch to registration and back', () => {
    const page = renderLogin();

    fireEvent.click(page.byId<HTMLButtonElement>('btn-switch-signup')!);

    expect(page.text()).toContain('Create your account');
    expect(page.byId('name')).not.toBeNull();
    // The API refuses a self-registered administrator, so the tile is not offered.
    expect(page.byId('role-admin')).toBeNull();

    fireEvent.click(page.byId<HTMLButtonElement>('btn-switch-signin')!);

    expect(page.text()).toContain('Welcome back');
    expect(page.byId('role-admin')).not.toBeNull();
  });

  it('registers under the role that was selected', async () => {
    const page = renderLogin();

    fireEvent.click(page.byId<HTMLButtonElement>('btn-switch-signup')!);
    fireEvent.click(page.byId<HTMLButtonElement>('role-volunteer')!);
    page.type(page.byId<HTMLInputElement>('name')!, 'Asha Menon');
    page.type(page.email(), 'asha@example.org');
    page.type(page.password(), 'long-enough-password');
    fireEvent.click(page.submit());

    await waitFor(() => expect(auth.state.signUp).toHaveBeenCalledTimes(1));
    expect(auth.state.signUp).toHaveBeenCalledWith({
      name: 'Asha Menon',
      email: 'asha@example.org',
      password: 'long-enough-password',
      role: 'volunteer',
      organization: null,
    });
  });

  it('explains a session that ended on its own', () => {
    auth.state.expiredMessage = 'Your session expired. Please sign in again.';
    const page = renderLogin();

    expect(page.text()).toContain('Your session expired. Please sign in again.');
  });
});
