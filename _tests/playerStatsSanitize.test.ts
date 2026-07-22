import { sanitizePlayerStatsUpdate } from '@/lib/playerStatsSanitize';

describe('sanitizePlayerStatsUpdate', () => {
  it('accepts only currentHealth, coerced to a clamped non-negative integer', () => {
    expect(sanitizePlayerStatsUpdate({ updates: { currentHealth: 42.9 } })).toEqual({ currentHealth: 42 });
    expect(sanitizePlayerStatsUpdate({ updates: { currentHealth: -5 } })).toEqual({ currentHealth: 0 });
    expect(sanitizePlayerStatsUpdate({ updates: { currentHealth: 1e9 } })).toEqual({ currentHealth: 100000 });
  });

  it('strips every other field, including dotted paths and operators', () => {
    const out = sanitizePlayerStatsUpdate({
      updates: { currentHealth: 50, coins: 1e9, level: 99, 'stats.battlesWon': 5, unlockedZones: ['castle-5'] },
    });
    expect(out).toEqual({ currentHealth: 50 });
  });

  it('rejects missing/garbage bodies', () => {
    expect(sanitizePlayerStatsUpdate(null)).toBeNull();
    expect(sanitizePlayerStatsUpdate({})).toBeNull();
    expect(sanitizePlayerStatsUpdate({ updates: {} })).toBeNull();
    expect(sanitizePlayerStatsUpdate({ updates: { currentHealth: 'lots' } })).toBeNull();
    expect(sanitizePlayerStatsUpdate({ updates: { currentHealth: NaN } })).toBeNull();
  });
});
