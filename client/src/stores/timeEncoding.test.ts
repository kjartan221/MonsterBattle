import { describe, test, expect } from 'vitest';
import type { MonsterDebuff } from '@/components/battle/effect-indicators/MonsterDebuffIndicators';
import { buffDurationMs } from '@/utils/buffDuration';
import { pruneExpiredBuffs } from '@/utils/buffExpiry';
import type { Buff } from '@/types/buffs';
import { BuffType, BuffSource } from '@/types/buffs';

/**
 * The scheduler reads absolute millisecond deadlines and nothing else. The one place that
 * invariant can be broken is the seconds→milliseconds conversion applied to server payloads
 * in BattlePage (consumable buffs and spell buffs) — both sides are `number`, so a missing
 * ×1000 typechecks. These tests exercise that conversion through the code that performs it.
 */
describe('time encoding', () => {
  test('a server duration in seconds becomes milliseconds, not a pass-through', () => {
    // The failure mode: `durationMs: duration` instead of `durationMs: duration * 1000`.
    expect(buffDurationMs(30)).toBe(30_000);
    expect(buffDurationMs(30)).not.toBe(30);
  });

  test('a converted 30s buff outlives a 5000ms monster debuff', () => {
    // What test 3 used to only assert about its own literals. Drop the ×1000 and a "30 second"
    // buff expires 4.97s BEFORE a 5 second debuff — this comparison catches that.
    const now = 1_000_000;
    const buffExpiry = now + buffDurationMs(30);

    const debuff: MonsterDebuff = {
      id: 'd1', type: 'poison', damageAmount: 3, damageType: 'flat',
      duration: 5_000, startTime: now, expiresAt: now + 5_000, tickInterval: 1_000,
    };

    expect(buffExpiry).toBeGreaterThan(debuff.expiresAt);
  });

  test('a converted 30s buff survives expiry pruning 29s in, and is pruned at 31s', () => {
    // Routes the conversion through the real consumer: an unconverted duration would make the
    // buff already expired on the first prune.
    const now = 1_000_000;
    const durationMs = buffDurationMs(30);
    const buff: Buff = {
      buffId: 'b1', buffType: BuffType.DAMAGE_BOOST, value: 5,
      durationMs, appliedAt: now, expiresAt: now + durationMs,
      source: BuffSource.SPELL,
    };

    expect(pruneExpiredBuffs([buff], now + 29_000).expired).toHaveLength(0);
    expect(pruneExpiredBuffs([buff], now + 31_000).expired).toHaveLength(1);
  });
});
