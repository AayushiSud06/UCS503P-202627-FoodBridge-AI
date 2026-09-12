/**
 * The donation photo policy: clamp the long edge, keep the aspect ratio, step
 * the quality down until it fits, and refuse anything that is not an image.
 *
 * `lib/image.ts` takes its decode/encode pair as a parameter precisely so this
 * can be driven without a browser: jsdom implements neither
 * `createImageBitmap` nor `canvas.toDataURL`, so a test against the real pair
 * would assert nothing. What is stubbed here is exactly that platform seam —
 * the sizing arithmetic, the ladder, the cap and every refusal are the real
 * code.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ENCODE_ATTEMPTS,
  INCOMPRESSIBLE_MESSAGE,
  MAX_IMAGE_DATA_URL_LENGTH,
  MAX_IMAGE_EDGE_PX,
  MAX_SOURCE_BYTES,
  TOO_LARGE_MESSAGE,
  UNREADABLE_MESSAGE,
  fitWithin,
  prepareDonationImage,
  type DecodedImage,
  type ImageIo,
} from '../image';

/** A file of a stated size; the bytes themselves never reach the fake decoder. */
function sourceFile(bytes: number): Blob {
  return { size: bytes, type: 'image/jpeg' } as Blob;
}

/** A data URL of a chosen length, so the cap can be exercised exactly. */
function dataUrlOfLength(length: number): string {
  const prefix = 'data:image/jpeg;base64,';
  return prefix + 'A'.repeat(Math.max(0, length - prefix.length));
}

interface Encoded {
  width: number;
  height: number;
  quality: number;
}

/**
 * A decode/encode pair that records what it was asked to draw. `sizeFor` says
 * how long the resulting data URL is, which is what the ladder reacts to.
 */
function fakeIo(
  image: DecodedImage,
  sizeFor: (attempt: Encoded) => number = () => 1_000,
): ImageIo & { calls: Encoded[]; released: number; decodes: number } {
  const calls: Encoded[] = [];
  const io = {
    calls,
    released: 0,
    decodes: 0,
    async decode() {
      io.decodes += 1;
      return image;
    },
    async encode(_image: DecodedImage, width: number, height: number, quality: number) {
      const attempt = { width, height, quality };
      calls.push(attempt);
      return dataUrlOfLength(sizeFor(attempt));
    },
    release() {
      io.released += 1;
    },
  };
  return io;
}

describe('fitWithin', () => {
  it('clamps the long edge and keeps the aspect ratio', () => {
    // A 4:3 phone photo, landscape and portrait.
    expect(fitWithin(4032, 3024, 1280)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032, 1280)).toEqual({ width: 960, height: 1280 });
  });

  it('never upscales an image that already fits', () => {
    expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1280, 720, 1280)).toEqual({ width: 1280, height: 720 });
    expect(fitWithin(16, 16, 1280)).toEqual({ width: 16, height: 16 });
  });

  it('keeps at least one pixel on the short edge of an extreme ratio', () => {
    expect(fitWithin(4000, 3, 1280)).toEqual({ width: 1280, height: 1 });
  });

  it('leaves a degenerate size alone rather than dividing by zero', () => {
    expect(fitWithin(0, 0, 1280)).toEqual({ width: 0, height: 0 });
  });
});

describe('prepareDonationImage', () => {
  it('resizes a phone photo to the maximum edge and returns a data URL', async () => {
    const io = fakeIo({ width: 4032, height: 3024 });

    const prepared = await prepareDonationImage(sourceFile(4 * 1024 * 1024), io);

    expect(io.calls).toEqual([{ width: 1280, height: 960, quality: ENCODE_ATTEMPTS[0].quality }]);
    expect(prepared.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(prepared.length).toBeLessThanOrEqual(MAX_IMAGE_DATA_URL_LENGTH);
    // The decoded image is freed whichever way the call goes.
    expect(io.released).toBe(1);
  });

  it('re-encodes a small image at its own size instead of upscaling it', async () => {
    const io = fakeIo({ width: 640, height: 480 });

    await prepareDonationImage(sourceFile(80 * 1024), io);

    expect(io.calls).toEqual([{ width: 640, height: 480, quality: ENCODE_ATTEMPTS[0].quality }]);
  });

  it('steps down the ladder until the result fits inside the cap', async () => {
    // Anything still 1280 px wide comes back over the cap, so only the third
    // attempt — the first that also shrinks the image — is small enough.
    const stepping = fakeIo({ width: 4032, height: 3024 }, attempt =>
      attempt.width === 1280 ? MAX_IMAGE_DATA_URL_LENGTH + 1 : 5_000,
    );

    const prepared = await prepareDonationImage(sourceFile(6 * 1024 * 1024), stepping);

    expect(stepping.calls.map(c => [c.width, c.height, c.quality])).toEqual([
      [1280, 960, ENCODE_ATTEMPTS[0].quality],
      [1280, 960, ENCODE_ATTEMPTS[1].quality],
      [960, 720, ENCODE_ATTEMPTS[2].quality],
    ]);
    expect(prepared.length).toBeLessThanOrEqual(MAX_IMAGE_DATA_URL_LENGTH);
  });

  it('refuses a photo that will not compress small enough', async () => {
    const io = fakeIo({ width: 9000, height: 9000 }, () => MAX_IMAGE_DATA_URL_LENGTH + 1);

    await expect(prepareDonationImage(sourceFile(2 * 1024 * 1024), io)).rejects.toThrow(
      INCOMPRESSIBLE_MESSAGE,
    );
    expect(io.calls).toHaveLength(ENCODE_ATTEMPTS.length);
    expect(io.released).toBe(1);
  });

  it('rejects a file that is not a decodable image', async () => {
    const io: ImageIo = {
      // What `createImageBitmap` does with a renamed text file or a corrupt JPEG.
      decode: vi.fn(async () => {
        throw new Error('The source image could not be decoded.');
      }),
      encode: vi.fn(async () => dataUrlOfLength(100)),
    };

    await expect(prepareDonationImage(sourceFile(1024), io)).rejects.toThrow(UNREADABLE_MESSAGE);
    expect(io.encode).not.toHaveBeenCalled();
  });

  it('rejects a decoded image with no pixels', async () => {
    const io = fakeIo({ width: 0, height: 0 });

    await expect(prepareDonationImage(sourceFile(1024), io)).rejects.toThrow(UNREADABLE_MESSAGE);
    expect(io.calls).toEqual([]);
    expect(io.released).toBe(1);
  });

  it('refuses an enormous file before decoding it at all', async () => {
    const io = fakeIo({ width: 4032, height: 3024 });

    await expect(
      prepareDonationImage(sourceFile(MAX_SOURCE_BYTES + 1), io),
    ).rejects.toThrow(TOO_LARGE_MESSAGE);
    expect(io.decodes).toBe(0);
    expect(io.calls).toEqual([]);
  });

  it('starts from the documented maximum edge', () => {
    expect(ENCODE_ATTEMPTS[0].maxEdge).toBe(MAX_IMAGE_EDGE_PX);
  });
});
