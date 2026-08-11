import { calcDeathPenalty, buildVictoryStatMutation, buildDefeatStatMutation } from '@server/lib/battleOutcome';
import { initializeStreaks, getStreakForZone } from '@shared/streakHelpers';

describe('calcDeathPenalty', () => {
  it('is 10% floored, and safe on zero/negative/NaN', () => {
    expect(calcDeathPenalty(1000)).toEqual({ goldLost: 100 });
    expect(calcDeathPenalty(105)).toEqual({ goldLost: 10 });
    expect(calcDeathPenalty(0)).toEqual({ goldLost: 0 });
    expect(calcDeathPenalty(-50)).toEqual({ goldLost: 0 });
    expect(calcDeathPenalty(Number.NaN)).toEqual({ goldLost: 0 });
  });
});

describe('buildVictoryStatMutation', () => {
  const base = {
    coins: 500, experience: 40, level: 3, maxHealth: 110, baseDamage: 2,
    stats: { battlesWon: 7, battlesWonStreak: 0, battlesWonStreaks: initializeStreaks(), monstersDefeated: 0, bossesDefeated: 0, totalDamageDealt: 0, itemsCollected: 0, legendariesFound: 0 },
  };

  it('increments coins/xp via $inc and bumps the zone streak (no level-up)', () => {
    const m = buildVictoryStatMutation({
      playerStats: base, rewards: { xp: 15, coins: 8 },
      levelUp: { leveledUp: false, newLevel: 3, statIncreases: { maxHealth: 0, baseDamage: 0 } },
      equipmentMaxHpBonus: 20, biome: 'forest', tier: 1,
    }) as any;
    expect(m.$inc.coins).toBe(8);
    expect(m.$inc.experience).toBe(15);
    expect(m.$inc['stats.battlesWon']).toBe(1);
    expect(getStreakForZone(m.$set['stats.battlesWonStreaks'], 'forest', 1)).toBe(1);
  });

  it('on level-up: sets level/xp0/maxHealth/currentHealth(+equip)/baseDamage', () => {
    const m = buildVictoryStatMutation({
      playerStats: base, rewards: { xp: 200, coins: 8 },
      levelUp: { leveledUp: true, newLevel: 4, statIncreases: { maxHealth: 5, baseDamage: 1 } },
      equipmentMaxHpBonus: 20, biome: 'forest', tier: 1,
    }) as any;
    expect(m.$set.level).toBe(4);
    expect(m.$set.experience).toBe(0);
    expect(m.$set.maxHealth).toBe(115);
    expect(m.$set.currentHealth).toBe(135); // 115 + 20 equip
    expect(m.$set.baseDamage).toBe(3);
    expect(m.$inc.coins).toBe(8);
    expect(m.$inc.experience).toBeUndefined(); // xp not $inc'd on level-up
  });
});

describe('buildVictoryStatMutation purity', () => {
  it('does not mutate the input playerStats.stats.battlesWonStreaks object', () => {
    const streaks = initializeStreaks();
    const before = structuredClone(streaks);

    const input = {
      playerStats: {
        coins: 500, experience: 40, level: 3, maxHealth: 110, baseDamage: 2,
        stats: { battlesWon: 7, battlesWonStreak: 0, battlesWonStreaks: streaks, monstersDefeated: 0, bossesDefeated: 0, totalDamageDealt: 0, itemsCollected: 0, legendariesFound: 0 },
      },
      rewards: { xp: 15, coins: 8 },
      levelUp: { leveledUp: false, newLevel: 3, statIncreases: { maxHealth: 0, baseDamage: 0 } },
      equipmentMaxHpBonus: 20,
      biome: 'forest' as const,
      tier: 1 as const,
    };

    buildVictoryStatMutation(input);

    expect(streaks).toEqual(before);
  });
});

describe('buildDefeatStatMutation', () => {
  it('decrements coins by the penalty and resets the zone streak', () => {
    const streaks = initializeStreaks();
    const { goldLost, update } = buildDefeatStatMutation({ coins: 1000, stats: { battlesWonStreaks: streaks } as any, biome: 'desert', tier: 2 }) as any;
    expect(goldLost).toBe(100);
    expect(update.$inc.coins).toBe(-100);
    expect(getStreakForZone(update.$set['stats.battlesWonStreaks'], 'desert', 2)).toBe(0);
    expect(update.$set['stats.battlesWonStreak']).toBe(0);
  });

  it('omits $inc.coins when penalty is 0', () => {
    const { update } = buildDefeatStatMutation({ coins: 0, stats: { battlesWonStreaks: initializeStreaks() } as any, biome: 'desert', tier: 2 }) as any;
    expect(update.$inc?.coins).toBeUndefined();
  });

  it('does not mutate the input stats.battlesWonStreaks object', () => {
    const streaks = initializeStreaks();
    const before = structuredClone(streaks);

    buildDefeatStatMutation({ coins: 1000, stats: { battlesWonStreaks: streaks } as any, biome: 'desert', tier: 2 });

    expect(streaks).toEqual(before);
  });
});
