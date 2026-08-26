import { Buff } from '@/types/buffs';

export interface BuffPruneResult {
  /** Same reference as the input when nothing expired, so React can skip the commit. */
  buffs: Buff[];
  expired: Buff[];
}

/** Split buffs into still-active and newly-expired. Permanent buffs (duration 0) never expire. */
export function pruneExpiredBuffs(buffs: Buff[], now: number): BuffPruneResult {
  const expired = buffs.filter(buff => buff.durationMs > 0 && now >= buff.expiresAt);

  if (expired.length === 0) return { buffs, expired };

  return { buffs: buffs.filter(buff => !expired.includes(buff)), expired };
}
