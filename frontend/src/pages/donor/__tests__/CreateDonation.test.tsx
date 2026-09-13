// @vitest-environment jsdom
/**
 * What the desktop create-donation screen claims, and what it fills in.
 *
 * Three things on this screen were not true of the product (P2-4):
 *
 * - a "Future Intelligence Feature" callout promising computer vision that
 *   would recognise dishes, estimate portions and score freshness — nothing in
 *   the repository reads a photo except to resize it (D-56);
 * - a subtitle promising "intelligent AI matching", when the ranking is a
 *   published weighted sum (D-05);
 * - a *Quick Demo Preset* button that overwrote the form with a seeded donation
 *   at "College Central Mess, Thapar University", with that same address as the
 *   location placeholder.
 *
 * These are absence assertions in the Landing suite's style, plus a check that
 * the form a donor actually uses is still all there. `useApp` is stubbed
 * because nothing here submits.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({ createDonation: vi.fn(), showToast: vi.fn() }),
  };
});

const { default: CreateDonation } = await import('../CreateDonation');

/** The seeded identity the preset and the placeholder carried. */
const SEEDED = ['Thapar', 'College Central Mess'];

function renderPage() {
  const { container } = render(
    <MemoryRouter>
      <CreateDonation />
    </MemoryRouter>,
  );
  return { container, text: container.textContent ?? '' };
}

afterEach(cleanup);

describe('CreateDonation', () => {
  it('promises no future intelligence or image recognition', () => {
    const { text } = renderPage();

    expect(text).not.toContain('Future Intelligence');
    expect(text).not.toMatch(/computer vision/i);
    expect(text).not.toMatch(/recogni[sz]e dish/i);
    expect(text).not.toMatch(/score freshness/i);
  });

  it('does not describe the matcher as AI or machine learning', () => {
    const { text } = renderPage();

    // The ranking is a transparent weighted sum (D-05).
    expect(text).not.toMatch(/\bAI\b/);
    expect(text).not.toMatch(/intelligen/i);
    expect(text).not.toMatch(/machine learning|\bML\b/i);
  });

  it('offers no demo preset to fill the form with', () => {
    const { container } = renderPage();

    const buttons = [...container.querySelectorAll('button')].map(b => b.textContent ?? '');
    for (const label of buttons) {
      expect(label, 'demo control still rendered').not.toMatch(/demo|preset|quick.?fill/i);
    }
  });

  it('carries no seeded identity, in text or in any attribute', () => {
    const { container } = renderPage();

    // innerHTML, so a placeholder or title counts as much as visible text.
    for (const seeded of SEEDED) {
      expect(container.innerHTML, `create page still carries "${seeded}"`).not.toContain(seeded);
    }
  });

  it('keeps the form a donor fills in, starting empty', () => {
    const { container, text } = renderPage();

    for (const id of [
      'food-name', 'category', 'storage-type', 'quantity', 'unit', 'prepared-at',
      'pickup-deadline', 'location', 'latitude', 'longitude', 'description', 'food-image',
    ]) {
      expect(container.querySelector(`#${id}`), `#${id} missing`).not.toBeNull();
    }

    expect((container.querySelector('#food-name') as HTMLInputElement).value).toBe('');
    expect((container.querySelector('#location') as HTMLInputElement).value).toBe('');

    expect(container.querySelector('#btn-submit-donation')?.textContent).toBe('Create Donation');
    expect(text).toContain('Use my location');
    expect(text).toContain('Upload food photo');
    // The honest description of what listing does stays.
    expect(text).toContain('scores nearby verified organisations');
  });
});
