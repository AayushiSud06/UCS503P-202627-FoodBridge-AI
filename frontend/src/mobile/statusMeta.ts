import type { DonationStatus } from '../types';

/**
 * The desktop app codes the eight statuses with eight hues. Modernist is mono,
 * so mobile re-codes them by urgency instead:
 *   accent  = something is moving / needs you
 *   outline = open, nobody has claimed it
 *   neutral = closed
 */
export type MonoTag = 'accent' | 'outline' | 'neutral';

export const STATUS_MOBILE: Record<DonationStatus, { label: string; tag: MonoTag }> = {
  AVAILABLE:          { label: 'Open',            tag: 'outline' },
  MATCHED:            { label: 'Matched',         tag: 'accent'  },
  ACCEPTED:           { label: 'Accepted',        tag: 'accent'  },
  VOLUNTEER_ASSIGNED: { label: 'Courier on way',  tag: 'accent'  },
  PICKED_UP:          { label: 'In transit',      tag: 'accent'  },
  DELIVERED:          { label: 'Delivered',       tag: 'accent'  },
  COMPLETED:          { label: 'Completed',       tag: 'neutral' },
  CANCELLED:          { label: 'Cancelled',       tag: 'neutral' },
};

export const CLOSED: DonationStatus[] = ['COMPLETED', 'CANCELLED'];
