/**
 * Preparing a donation photo for the only place it can go.
 *
 * There is no upload endpoint and no object storage in this project: the
 * donation carries its photo as a base64 `data:` URL in `imageUrl`, which the
 * row then stores and every donation read returns inline. The server bounds
 * that at `schemas.MAX_IMAGE_URL_LENGTH` (256 KiB of characters, about a 190 KB
 * image) precisely because one donor's photo is otherwise priced into every
 * other account's next request.
 *
 * Both create-donation screens used to `readAsDataURL` the file as picked, so a
 * 1-5 MB phone photo was a 422 and the donation was simply not created — the
 * camera-first mobile flow failing on its own premise. The browser is the only
 * boundary that holds the actual bytes, so it is where the resizing belongs.
 *
 * The decode/encode pair is injectable so the policy above can be tested
 * without a real canvas: jsdom implements neither `createImageBitmap` nor
 * `toDataURL`. `browserImageIo` is the real one. See `DECISIONS.md` D-56.
 */

/** The long edge a stored photo is clamped to. */
export const MAX_IMAGE_EDGE_PX = 1280;

/** Mirrors `schemas.MAX_IMAGE_URL_LENGTH`; the server still enforces it. */
export const MAX_IMAGE_DATA_URL_LENGTH = 262_144;

/**
 * Refused before decoding, so a pathological file cannot be turned into
 * hundreds of megabytes of bitmap on the main thread. Comfortably above the
 * "up to 10 MB" the upload control already promises.
 */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

/**
 * Tried in order until one lands inside the cap. Dimensions come first and
 * quality second: a 1280 px JPEG at 0.72 is a good-looking web photo, and
 * dropping detail is less visible than dropping size. Deliberately a short,
 * fixed ladder rather than a search — four deterministic attempts are easy to
 * reason about and cheap at these sizes.
 */
export const ENCODE_ATTEMPTS: readonly { maxEdge: number; quality: number }[] = [
  { maxEdge: MAX_IMAGE_EDGE_PX, quality: 0.72 },
  { maxEdge: MAX_IMAGE_EDGE_PX, quality: 0.55 },
  { maxEdge: 960, quality: 0.55 },
  { maxEdge: 720, quality: 0.5 },
];

export const TOO_LARGE_MESSAGE =
  `That file is larger than ${Math.round(MAX_SOURCE_BYTES / (1024 * 1024))} MB. `
  + 'Choose a smaller photo.';

export const UNREADABLE_MESSAGE =
  'That file is not an image FoodLink can read. Try a JPG or PNG photo.';

export const INCOMPRESSIBLE_MESSAGE =
  'That photo could not be compressed small enough to attach. Try another one.';

/** What this module needs to know about a decoded image, and nothing more. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
}

export interface ImageIo {
  /** Decodes the bytes, or rejects if they are not a readable image. */
  decode(file: Blob): Promise<DecodedImage>;
  /** Draws the image at the given size and returns a `data:` URL. */
  encode(image: DecodedImage, width: number, height: number, quality: number): Promise<string>;
  /** Frees a decoded image, where the platform has something to free. */
  release?(image: DecodedImage): void;
}

/**
 * The largest box no bigger than `maxEdge` that keeps this aspect ratio.
 *
 * **Never upscales**: an image already inside the box is returned untouched, so
 * a small photo is re-encoded at its own size rather than being blown up into a
 * bigger, blurrier file.
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge || longest <= 0) return { width, height };

  const scale = maxEdge / longest;
  // At least one pixel each way: a 4000x3 panorama still has to have a height.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * A picked file as the `imageUrl` the donation API accepts.
 *
 * Resolves to a JPEG `data:` URL inside `MAX_IMAGE_DATA_URL_LENGTH`, or rejects
 * with a sentence written for the person who picked the file — which is what
 * both screens show, through `errorMessage`.
 */
export async function prepareDonationImage(
  file: Blob,
  io: ImageIo = browserImageIo,
): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(TOO_LARGE_MESSAGE);

  let image: DecodedImage;
  try {
    // The decode is the validation: a file that merely claims to be an image
    // through its extension or its MIME type fails here, which is why neither
    // is trusted on its own.
    image = await io.decode(file);
  } catch {
    throw new Error(UNREADABLE_MESSAGE);
  }

  if (!image || !(image.width > 0) || !(image.height > 0)) {
    io.release?.(image);
    throw new Error(UNREADABLE_MESSAGE);
  }

  try {
    for (const attempt of ENCODE_ATTEMPTS) {
      const { width, height } = fitWithin(image.width, image.height, attempt.maxEdge);
      const dataUrl = await io.encode(image, width, height, attempt.quality);
      if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) return dataUrl;
    }
  } finally {
    io.release?.(image);
  }

  throw new Error(INCOMPRESSIBLE_MESSAGE);
}

export const browserImageIo: ImageIo = {
  async decode(file) {
    // `createImageBitmap` decodes off the main thread and rejects on anything
    // it cannot parse, unlike an <img> element, which reports failure through
    // an event and keeps a zero-sized image around.
    return await createImageBitmap(file);
  },

  async encode(image, width, height, quality) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error(UNREADABLE_MESSAGE);

    // JPEG carries no alpha, so a transparent PNG would composite onto black.
    // Food photos are photographic and transparency is not part of this flow;
    // a white mat is the predictable answer (D-56).
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    // The source came from `decode` above, so it is a real `CanvasImageSource`;
    // the interface deliberately describes only the two fields this module uses.
    context.drawImage(image as unknown as CanvasImageSource, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  },

  release(image) {
    (image as { close?: () => void }).close?.();
  },
};
