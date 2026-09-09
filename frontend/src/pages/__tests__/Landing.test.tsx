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
 *
 * Task 29 added the second boundary: this is a public product page, not a
 * coursework submission. The academic identifiers, the semester roadmap and the
 * four self-returning footer links are gone, and the assertions below keep them
 * gone without freezing the copy that replaced them.
 */

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Landing from '../Landing';

/** Academic identification, removed from the public page in Task 29. */
const ACADEMIC = [
  'Thapar University',
  'UCS503P',
  'Prototype 0',
  'university prototype',
];

/** The semester roadmap's unbuilt phases, removed in Task 29. */
const ROADMAP_ITEMS = [
  'Prototype 2',
  'Advanced phase',
  'ML-assisted recipient ranking',
  'AI food image categorization',
  'NLP donation understanding',
  'Community surplus heatmap',
];

/** The four footer links that pointed at `#` — the same page, scrolled up. */
const DEAD_FOOTER_LINKS = ['About', 'How It Works', 'Contact', 'GitHub'];

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

  it('identifies no university, course or prototype number', () => {
    const { text } = renderLanding();

    for (const label of ACADEMIC) {
      expect(text, `landing page still prints "${label}"`).not.toContain(label);
    }
  });

  it('shows no roadmap of unbuilt phases', () => {
    const { text } = renderLanding();

    expect(text).not.toContain('Where this is headed');
    expect(text).not.toMatch(/\bRoadmap\b/i);
    for (const item of ROADMAP_ITEMS) {
      expect(text, `landing page still promises "${item}"`).not.toContain(item);
    }
  });

  it('carries no dead links — every anchor goes somewhere real', () => {
    const { container } = renderLanding();

    for (const label of DEAD_FOOTER_LINKS) {
      expect(
        [...container.querySelectorAll('footer a')].map(a => a.textContent?.trim()),
        `footer still links "${label}"`,
      ).not.toContain(label);
    }

    // No link on the page may point at itself, which is what `href="#"` did.
    for (const a of container.querySelectorAll('a[href]')) {
      expect(a.getAttribute('href'), 'self-returning link').not.toBe('#');
    }
  });

  it('claims no AI capability in the footer', () => {
    const { container } = renderLanding();
    const footer = container.querySelector('footer');

    expect(footer).not.toBeNull();
    expect(footer?.textContent ?? '').not.toMatch(/AI[\s-]?assisted/i);
  });

  it('keeps the hero, its CTAs and the sections the navbar anchors to', () => {
    const { container, text } = renderLanding();

    // Hero headline and the product description underneath it.
    expect(text).toContain('Good food,');
    expect(text).toContain('not wasted.');
    expect(text).toContain('connects surplus food with verified community organizations');

    // Both hero CTAs still resolve to the real sign-in route.
    const hrefs = [...container.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
    expect(hrefs.filter(h => h === '/login').length).toBeGreaterThanOrEqual(2);

    // The card beside the hero, and the two anchors the navbar links to.
    expect(text).toContain('How a handover is recorded');
    expect(container.querySelector('#how-it-works')).not.toBeNull();
    expect(container.querySelector('#impact')).not.toBeNull();
  });
});
