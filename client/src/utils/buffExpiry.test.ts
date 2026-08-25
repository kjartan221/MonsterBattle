import { describe, test, expect } from 'vitest';
import { pruneExpiredBuffs } from './buffExpiry';
import { Buff, BuffType, BuffSource } from '@/types/buffs';

function makeBuff(overrides: Partial<Buff> = {}): Buff {
  return {
    buffId: 'buff_1',
    buffType: BuffType.DAMAGE_BOOST,
    value: 5,
    duration: 10,
    appliedAt: 1_000,
    expiresAt: 11_000,
    source: BuffSource.SPELL,
    ...overrides,
  };
}

describe('pruneExpiredBuffs', () => {
  test('returns the same array reference when the list is empty', () => {
    const buffs: Buff[] = [];

    const result = pruneExpiredBuffs(buffs, 50_000);

    expect(result.buffs).toBe(buffs);
    expect(result.expired).toEqual([]);
  });

  test('returns the same array reference when nothing has expired', () => {
    const buffs = [makeBuff({ expiresAt: 11_000 }), makeBuff({ buffId: 'buff_2', expiresAt: 12_000 })];

    const result = pruneExpiredBuffs(buffs, 5_000);

    expect(result.buffs).toBe(buffs);
    expect(result.expired).toEqual([]);
  });

  test('drops expired buffs and reports them', () => {
    const live = makeBuff({ buffId: 'live', expiresAt: 20_000 });
    const dead = makeBuff({ buffId: 'dead', expiresAt: 9_000, name: 'Rage' });

    const result = pruneExpiredBuffs([live, dead], 10_000);

    expect(result.buffs).toEqual([live]);
    expect(result.expired).toEqual([dead]);
  });

  test('treats a buff as expired exactly at its expiry timestamp', () => {
    const buff = makeBuff({ expiresAt: 10_000 });

    const result = pruneExpiredBuffs([buff], 10_000);

    expect(result.buffs).toEqual([]);
    expect(result.expired).toEqual([buff]);
  });

  test('never expires permanent buffs, whose duration is 0', () => {
    const permanent = makeBuff({ duration: 0, expiresAt: Infinity });
    const buffs = [permanent];

    const result = pruneExpiredBuffs(buffs, Number.MAX_SAFE_INTEGER);

    expect(result.buffs).toBe(buffs);
    expect(result.expired).toEqual([]);
  });
});
