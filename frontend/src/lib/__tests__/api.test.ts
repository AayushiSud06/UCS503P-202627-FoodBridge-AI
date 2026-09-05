// @vitest-environment jsdom
/**
 * The request plumbing every call in the app goes through.
 *
 * `fetch` is the one thing stubbed here, and only because it is the process
 * boundary — the backend already has 216 tests on the other side of it. The
 * token store, the error translation and the 401 path are the real code.
 *
 * jsdom is needed for `localStorage`, which is where the session token lives.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError, NetworkError, api, getToken, setToken, setUnauthorizedHandler,
} from '../api';

/** A `Response` good enough for the paths under test, without a real server. */
function respond(status: number, body: unknown): Response {
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(text),
  } as Response;
}

function stubFetch(response: Response | Error) {
  const fetchMock = vi.fn(() =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
  setUnauthorizedHandler(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  setUnauthorizedHandler(null);
});

describe('the session token', () => {
  it('survives being written and cleared', () => {
    setToken('abc123');
    expect(getToken()).toBe('abc123');

    setToken(null);
    expect(getToken()).toBeNull();
  });
});

describe('request', () => {
  it('attaches the bearer token to an authenticated call', async () => {
    setToken('abc123');
    const fetchMock = stubFetch(respond(200, []));

    await api.listDonations();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('does not attach it to the login call, where a 401 is just a wrong password', async () => {
    setToken('abc123');
    const fetchMock = stubFetch(respond(401, { detail: 'Incorrect email or password' }));

    await expect(api.login('asha@example.org', 'wrong')).rejects.toThrow(
      'Incorrect email or password',
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
    // Crucially, a failed sign-in must not evict a token that is still good.
    expect(getToken()).toBe('abc123');
  });

  it('drops the token and announces the expiry once on a 401', async () => {
    setToken('abc123');
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    stubFetch(respond(401, { detail: 'Not authenticated' }));

    await expect(api.me()).rejects.toBeInstanceOf(ApiError);

    expect(getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('flattens a Pydantic validation list into one readable sentence', async () => {
    stubFetch(
      respond(422, {
        detail: [
          { loc: ['body', 'pickupDeadline'], msg: 'Value error, must be in the future' },
          { loc: ['body', 'quantity'], msg: 'must be greater than 0' },
        ],
      }),
    );

    await expect(api.metrics()).rejects.toThrow(
      'Pickup Deadline: must be in the future. Quantity: must be greater than 0',
    );
  });

  it('names a dead backend as unreachable rather than as a 500', async () => {
    // A stopped backend arrives as a proxy error with no JSON body.
    stubFetch(respond(502, undefined));

    await expect(api.metrics()).rejects.toBeInstanceOf(NetworkError);
  });

  it('classifies a refusal by status so callers can tell them apart', async () => {
    stubFetch(respond(409, { detail: 'Donation is no longer available' }));

    let caught: unknown;
    try {
      await api.updateStatus(1, 'ACCEPTED');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as ApiError;
    expect(apiError.status).toBe(409);
    expect(apiError.isConflict).toBe(true);
    expect(apiError.isForbidden).toBe(false);
    // The server's own `detail` reaches the person, not "Request failed (409)".
    expect(apiError.message).toBe('Donation is no longer available');
  });

  it('reports a fetch that never reached the server as a network error', async () => {
    stubFetch(new TypeError('Failed to fetch'));

    await expect(api.metrics()).rejects.toBeInstanceOf(NetworkError);
  });
});
