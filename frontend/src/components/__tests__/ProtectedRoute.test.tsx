// @vitest-environment jsdom
/**
 * The route guard's three decisions.
 *
 * This is a UX affordance, not a security control — the server re-checks every
 * request. What it is responsible for is not flashing the login screen at
 * someone who is signed in, and sending a signed-in account to a portal it can
 * actually use instead of one that would fill with 403s.
 *
 * `useAuth` is the one thing stubbed, because identity is the input to the
 * decision under test. `HOME_PATH` stays the real map, so a change to where a
 * role lands is caught here rather than mocked away.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { User, UserRole } from '../../types';

const authState = vi.hoisted(() => ({
  current: { user: null as User | null, isLoading: false },
}));

vi.mock('../../context/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AuthContext')>();
  return { ...actual, useAuth: () => authState.current };
});

const { default: ProtectedRoute } = await import('../ProtectedRoute');

function signedInAs(role: UserRole): User {
  return { id: '1', name: 'Asha Menon', email: 'asha@example.org', role, avatarInitials: 'AM' };
}

function renderGuard(allow?: UserRole[]) {
  return render(
    <MemoryRouter initialEntries={['/ngo']}>
      <Routes>
        <Route element={<ProtectedRoute allow={allow} />}>
          <Route path="/ngo" element={<p>NGO portal</p>} />
        </Route>
        {/* Redirect destinations live outside the guard, as they do in the app. */}
        <Route path="/login" element={<p>Sign in</p>} />
        <Route path="/donor" element={<p>Donor home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  authState.current = { user: null, isLoading: false };
});

describe('ProtectedRoute', () => {
  it('holds the splash while a stored token is still being exchanged', () => {
    authState.current = { user: null, isLoading: true };

    renderGuard(['ngo']);

    // Rendering the login screen here would flash it at someone who is signed in.
    expect(screen.getByText('Restoring your session…')).toBeDefined();
    expect(screen.queryByText('Sign in')).toBeNull();
  });

  it('sends a signed-out visitor to the login screen', () => {
    authState.current = { user: null, isLoading: false };

    renderGuard(['ngo']);

    expect(screen.getByText('Sign in')).toBeDefined();
    expect(screen.queryByText('NGO portal')).toBeNull();
  });

  it("sends a signed-in account at the wrong portal to its own", () => {
    authState.current = { user: signedInAs('donor'), isLoading: false };

    renderGuard(['ngo']);

    expect(screen.getByText('Donor home')).toBeDefined();
    expect(screen.queryByText('Sign in')).toBeNull();
  });

  it('renders the portal for an allowed role', () => {
    authState.current = { user: signedInAs('ngo'), isLoading: false };

    renderGuard(['ngo']);

    expect(screen.getByText('NGO portal')).toBeDefined();
  });

  it('admits any signed-in account when no role list is given', () => {
    authState.current = { user: signedInAs('volunteer'), isLoading: false };

    renderGuard();

    expect(screen.getByText('NGO portal')).toBeDefined();
  });
});
