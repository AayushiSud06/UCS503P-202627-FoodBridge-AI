// @vitest-environment jsdom
/**
 * What the phone create-donation flow submits, and what it claims about the photo.
 *
 * It used to script a "vision read": a timer, a fixed list of readings, a "96%
 * confident" chip — and then publish every donation as "Vegetarian Meals" with
 * the description "Read from photo: dal makhani…", a 20:00 deadline and the
 * seeded pickup address "College Central Mess, Thapar University", whatever the
 * donor had actually photographed (P2-4 residue). Nothing in FoodLink reads a
 * photo; it is only resized and attached (D-56).
 *
 * So these tests hold two things: the screen says the photo is not read, and
 * `createDonation` receives exactly what the donor typed — no fixed value fills
 * a blank. `useApp` is stubbed so the draft can be inspected; `prepareDonationImage`
 * because jsdom has no canvas; `api.getMatches` because the done step asks for
 * the leading match.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { donation } from '../../test/fixtures';

const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';

const app = vi.hoisted(() => ({
  createDonation: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../context/AppContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../context/AppContext')>();
  return { ...actual, useApp: () => app };
});

vi.mock('../../lib/image', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/image')>();
  return { ...actual, prepareDonationImage: vi.fn(async () => PHOTO) };
});

vi.mock('../../lib/api', async importOriginal => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, api: { ...actual.api, getMatches: vi.fn(async () => []) } };
});

const { default: CreateDonationCamera } = await import('../CreateDonationCamera');

/** Every fixed value the scripted flow displayed or submitted. */
const FABRICATED = [
  'Thapar',
  'College Central Mess',
  'Read from photo',
  'dal makhani',
  'Dal makhani',
  'paneer bhurji',
  'Dish class',
  'Portion estimate',
  'Reading photo',
  'confident',
  'Vegetarian Meals',
];

function renderScreen() {
  const { container } = render(
    <MemoryRouter>
      <CreateDonationCamera />
    </MemoryRouter>,
  );
  const field = (id: string) => container.querySelector(`#${id}`) as HTMLInputElement;
  const type = (id: string, value: string) => fireEvent.change(field(id), { target: { value } });
  return { container, field, type };
}

function expectNothingFabricated(container: HTMLElement) {
  // innerHTML, so a placeholder or alt text counts as much as visible text.
  for (const value of FABRICATED) {
    expect(container.innerHTML, `screen still carries "${value}"`).not.toContain(value);
  }
}

async function attachPhoto(container: HTMLElement) {
  const input = container.querySelector('#m-food-image') as HTMLInputElement;
  const file = new File(['x'], 'tray.jpg', { type: 'image/jpeg' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('Photo attached');
}

function publish() {
  fireEvent.click(screen.getByRole('button', { name: /publish donation/i }));
}

beforeEach(() => {
  app.createDonation.mockReset();
  app.showToast.mockReset();
});

afterEach(cleanup);

describe('CreateDonationCamera — photo', () => {
  it('says the photo is not read, and scripts no reading of it', async () => {
    const { container } = renderScreen();

    expect(container.textContent).toMatch(/does not read or analyse it/);
    expect(container.textContent).not.toMatch(/estimates the dish|one photo is the whole form/i);
    expectNothingFabricated(container);

    await attachPhoto(container);

    // Straight to the donor's own form: no read step, no confidence, no readings.
    expect(container.textContent).toContain('Food name');
    expect(container.textContent).not.toMatch(/reading|estimat|recogni[sz]/i);
    expectNothingFabricated(container);
  });
});

describe('CreateDonationCamera — details', () => {
  it('starts the form empty, with no seeded address or description', () => {
    const { container, field } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /continue without a photo/i }));

    for (const id of ['m-food-name', 'm-quantity', 'm-pickup-deadline', 'm-location', 'm-description']) {
      expect(field(id), `#${id} missing`).not.toBeNull();
      expect(field(id).value, `#${id} is pre-filled`).toBe('');
    }
    expectNothingFabricated(container);
  });

  it('publishes nothing until the donor has entered the required details', () => {
    const { container } = renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /continue without a photo/i }));

    publish();

    expect(app.createDonation).not.toHaveBeenCalled();
    const text = container.textContent ?? '';
    expect(text).toContain('Food name is required');
    expect(text).toContain('Enter a valid quantity');
    expect(text).toContain('Pickup deadline is required');
    expect(text).toContain('Location is required');
  });

  it('submits exactly what the donor entered, photo included', async () => {
    const { container, type } = renderScreen();
    app.createDonation.mockResolvedValue(donation({ id: 314, quantity: 12, unit: 'Boxes' }));

    await attachPhoto(container);

    type('m-food-name', '  Paneer rolls ');
    type('m-category', 'Bakery');
    type('m-storage-type', 'Refrigerated');
    type('m-quantity', '12');
    type('m-unit', 'Boxes');
    type('m-pickup-deadline', '21:30');
    type('m-description', 'Sealed boxes, no nuts.');
    type('m-location', 'Gate 2, Leela Bhawan, Patiala');
    type('m-latitude', '30.3398');
    type('m-longitude', '76.3869');

    const before = Date.now();
    publish();

    await waitFor(() => expect(app.createDonation).toHaveBeenCalledTimes(1));
    const draft = app.createDonation.mock.calls[0][0];

    expect(draft).toEqual({
      foodName: 'Paneer rolls',
      category: 'Bakery',
      quantity: 12,
      unit: 'Boxes',
      storageType: 'Refrigerated',
      description: 'Sealed boxes, no nuts.',
      location: 'Gate 2, Leela Bhawan, Patiala',
      latitude: 30.3398,
      longitude: 76.3869,
      preparedAt: null,
      pickupDeadline: expect.any(String),
      imageUrl: PHOTO,
    });

    // The donor's time, as the next future instant — not a fixed 20:00.
    const deadline = new Date(draft.pickupDeadline);
    expect([deadline.getHours(), deadline.getMinutes()]).toEqual([21, 30]);
    expect(deadline.getTime()).toBeGreaterThan(before);

    await screen.findByRole('button', { name: /back to home/i });
  });

  it('leaves blank what the donor left blank', async () => {
    const { type } = renderScreen();
    app.createDonation.mockResolvedValue(donation());
    fireEvent.click(screen.getByRole('button', { name: /continue without a photo/i }));

    type('m-food-name', 'Dal and rice');
    type('m-quantity', '30');
    type('m-pickup-deadline', '07:15');
    type('m-location', 'Community hall, Model Town');

    publish();

    await waitFor(() => expect(app.createDonation).toHaveBeenCalledTimes(1));
    const draft = app.createDonation.mock.calls[0][0];

    expect(draft.description).toBe('');
    expect(draft.imageUrl).toBeNull();
    expect(draft.foodName).toBe('Dal and rice');
    expect(draft.location).toBe('Community hall, Model Town');
    // The selects keep the same visible defaults the desktop form starts with.
    expect(draft.category).toBe('Vegetarian');
    expect(draft.unit).toBe('Meals');
    expect(draft.storageType).toBe('Room Temperature');
  });
});
