// @vitest-environment jsdom
/**
 * The one screen anyone sees before signing in — and the one screen with no
 * data source of its own. `GET /api/metrics` is behind `get_current_user`, so
 * every platform figure this page ever printed was a literal wearing a
 * measurement's clothes: `1,240+` meals, `32` partner NGOs, `18% more than
 * last month`, under a pulsing dot captioned "Live this term".
 *
 * This suite is D-31 held at that boundary. It asserts the **absence** of the
 * invented figures and of the real-time claim, plus the handful of anchors the
 * rest of the interface depends on (`#impact`, which the navbar links to). It
 * deliberately does not assert on layout, so the page stays free to be
 * redesigned while a reintroduced number still fails here.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../Landing';

/** The exact strings the health audit found, verbatim. */
const FABRICATED = [
  '1,240+',
  '32 partner NGOs',
  '18% more than last month',
  'Live this term',
  'Meals redistributed',
  'Partner organizations',
  'Active volunteers',
  'Successful pickups',
];

function renderLanding() {
  const { container } = render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
  return { container, text: container.textContent ?? '' };
}

afterEach(cleanup);

describe('Landing', () => {
  it('prints none of the invented platform figures', () => {
    const { text } = renderLanding();

    for (const claim of FABRICATED) {
      expect(text, `landing page still prints "${claim}"`).not.toContain(claim);
    }
  });

  it('claims nothing updates in real time', () => {
    const { text } = renderLanding();

    // There is no polling, no SSE and no WebSocket anywhere in the project.
    expect(text).not.toMatch(/real[\s-]?time/i);
    expect(text).not.toMatch(/\blive\b/i);
  });

  it('keeps the impact section the navbar links to, explaining how counting works', () => {
    const { container, text } = renderLanding();

    expect(container.querySelector('#impact')).not.toBeNull();
    expect(text).toContain('Server-stamped');
    expect(text).toContain('Verified recipients');
    // Says why no total is shown rather than leaving the absence unexplained.
    expect(text).toContain('only shown to signed-in accounts');
  });

  it('labels the sample match analysis as an example, not a reading', () => {
    const { text } = renderLanding();

    // The card's numbers are illustrative; the criteria behind them are real.
    expect(text).toContain('Example match analysis');
    expect(text).toContain('Illustrative sample');
  });
});
