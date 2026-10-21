import type { Channel } from '../types';

const ADULT_HINTS = ['xxx', 'adult', '18+', '+18', 'porn', 'erot', 'for adult'];

/** Used by the parental lock to hide channels that look adult-only. */
export function isAdult(channel: Pick<Channel, 'name' | 'group' | 'tvgId'>): boolean {
  const haystack = `${channel.name} ${channel.group ?? ''} ${channel.tvgId ?? ''}`.toLowerCase();
  return ADULT_HINTS.some((hint) => haystack.includes(hint));
}
