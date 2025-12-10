import {
  calculateTotalEquipmentStats,
  calculateClickDamage,
  calculateMonsterDamage,
  calculateMonsterAttackInterval,
  calculateEffectiveAutoClickRate,
  type TotalEquipmentStats
} from '../src/utils/equipmentCalculations';
import type { EquippedItem } from '../src/contexts/EquipmentContext';

describe('equipmentCalculations', () => {
  describe('calculateClickDamage', () => {
    it('should calculate base damage without crit', () => {
      // Mock Math.random to prevent crit (return > 100)
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(1);

      const result = calculateClickDamage(1, 10, 0, 2.0);

      expect(result.damage).toBe(11); // 1 base + 10 bonus
      expect(result.isCrit).toBe(false);

      mockRandom.mockRestore();
    });

    it('should calculate crit damage when crit triggers', () => {
      // Mock Math.random to trigger crit (return < critChance)
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.01); // 1% roll

      const result = calculateClickDamage(1, 10, 50, 2.0);

      expect(result.damage).toBe(22); // (1 + 10) * 2.0 = 22
      expect(result.isCrit).toBe(true);

      mockRandom.mockRestore();
    });

    it('should cap crit chance at 100%', () => {
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% roll

      const result = calculateClickDamage(1, 10, 150, 2.0); // 150% crit chance

      expect(result.isCrit).toBe(true); // Should still crit

      mockRandom.mockRestore();
    });

    it('should apply custom crit multiplier', () => {
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const result = calculateClickDamage(1, 20, 100, 3.5); // 3.5x crit

      expect(result.damage).toBe(73); // floor((1 + 20) * 3.5) = 73
      expect(result.isCrit).toBe(true);

      mockRandom.mockRestore();
    });

    it('should floor crit damage', () => {
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const result = calculateClickDamage(1, 10, 100, 2.3);

      expect(result.damage).toBe(25); // floor((1 + 10) * 2.3) = 25

      mockRandom.mockRestore();
    });
  });

  describe('calculateMonsterDamage', () => {
    it('should return full damage with 0 defense', () => {
      const damage = calculateMonsterDamage(10, 0);
      expect(damage).toBe(10);
    });

    it('should reduce damage with defense (diminishing returns)', () => {
      // 10 defense → ~10.4% reduction
      const damage = calculateMonsterDamage(100, 10);
      expect(damage).toBeGreaterThanOrEqual(89);
      expect(damage).toBeLessThanOrEqual(91);
    });

    it('should provide ~50% reduction at 100 defense', () => {
      // 100 defense → ~47.9% reduction
      const damage = calculateMonsterDamage(100, 100);
      expect(damage).toBeGreaterThanOrEqual(51);
      expect(damage).toBeLessThanOrEqual(53);
    });

    it('should cap reduction at 80% (20% always gets through)', () => {
      // ∞ defense approaches 80% reduction
      const damage = calculateMonsterDamage(100, 10000);
      expect(damage).toBeGreaterThanOrEqual(20);
      expect(damage).toBeLessThanOrEqual(21);
    });

    it('should always deal at least 1 damage', () => {
      const damage = calculateMonsterDamage(1, 10000);
      expect(damage).toBe(1);
    });

    it('should round damage to nearest integer', () => {
      const damage = calculateMonsterDamage(7, 10);
      expect(Number.isInteger(damage)).toBe(true);
    });

    it('should follow diminishing returns curve', () => {
      // Test curve: each increment of defense gives less reduction
      const dmg10 = calculateMonsterDamage(100, 10);
      const dmg20 = calculateMonsterDamage(100, 20);
      const dmg30 = calculateMonsterDamage(100, 30);

      const reduction10to20 = dmg10 - dmg20;
      const reduction20to30 = dmg20 - dmg30;

      expect(reduction10to20).toBeGreaterThan(reduction20to30);
    });
  });

  describe('calculateMonsterAttackInterval', () => {
    it('should return base interval with 0 attack speed', () => {
      const interval = calculateMonsterAttackInterval(1000, 0);
      expect(interval).toBe(1000);
    });

    it('should slow monster attacks with attack speed', () => {
      // 50 attack speed → ~21.6% slowdown (1216ms)
      const interval = calculateMonsterAttackInterval(1000, 50);
      expect(interval).toBeGreaterThanOrEqual(1210);
      expect(interval).toBeLessThanOrEqual(1220);
    });

    it('should cap slowdown at 50% (max 1500ms for 1000ms base)', () => {
      // ∞ attack speed approaches 50% slowdown
      const interval = calculateMonsterAttackInterval(1000, 10000);
      expect(interval).toBeGreaterThanOrEqual(1495);
      expect(interval).toBeLessThanOrEqual(1500);
    });

    it('should follow diminishing returns curve', () => {
      const int10 = calculateMonsterAttackInterval(1000, 10);
      const int20 = calculateMonsterAttackInterval(1000, 20);
      const int30 = calculateMonsterAttackInterval(1000, 30);

      const gain10to20 = int20 - int10;
      const gain20to30 = int30 - int20;

      expect(gain10to20).toBeGreaterThan(gain20to30);
    });

    it('should round interval to nearest integer', () => {
      const interval = calculateMonsterAttackInterval(1000, 15);
      expect(Number.isInteger(interval)).toBe(true);
    });
  });

  describe('calculateEffectiveAutoClickRate', () => {
    it('should return 0 for 0 auto-click rate', () => {
      const rate = calculateEffectiveAutoClickRate(0);
      expect(rate).toBe(0);
    });

    it('should return 0 for negative auto-click rate', () => {
      const rate = calculateEffectiveAutoClickRate(-5);
      expect(rate).toBe(0);
    });

    it('should apply diminishing returns', () => {
      // 2 autoClickRate → 1.4 hits/sec (~70% efficiency)
      const rate2 = calculateEffectiveAutoClickRate(2);
      expect(rate2).toBeGreaterThanOrEqual(1.3);
      expect(rate2).toBeLessThanOrEqual(1.5);

      // 8 autoClickRate → 3.5 hits/sec (~43.75% efficiency)
      const rate8 = calculateEffectiveAutoClickRate(8);
      expect(rate8).toBeGreaterThanOrEqual(3.4);
      expect(rate8).toBeLessThanOrEqual(3.6);
    });

    it('should approach cap of 7 hits/sec at high values', () => {
      // ∞ autoClickRate approaches 7 hits/sec
      const rate = calculateEffectiveAutoClickRate(1000);
      expect(rate).toBeGreaterThanOrEqual(6.9);
      expect(rate).toBeLessThanOrEqual(7.0);
    });

    it('should follow diminishing returns curve', () => {
      const rate4 = calculateEffectiveAutoClickRate(4);
      const rate8 = calculateEffectiveAutoClickRate(8);
      const rate12 = calculateEffectiveAutoClickRate(12);

      const gain4to8 = rate8 - rate4;
      const gain8to12 = rate12 - rate8;

      expect(gain4to8).toBeGreaterThan(gain8to12);
    });
  });

  describe('calculateTotalEquipmentStats', () => {
    const createMockEquippedItem = (
      stats: Record<string, number>,
      tier: number = 1,
      isEmpowered: boolean = false,
      prefix?: any,
      suffix?: any
    ): EquippedItem => ({
      inventoryId: 'test-id',
      lootTableId: 'test-loot',
      slot: 'weapon',
      lootItem: {
        lootId: 'test-loot',
        name: 'Test Item',
        icon: '⚔️',
        description: 'Test',
        rarity: 'common',
        type: 'weapon',
        equipmentStats: stats
      },
      tier,
      crafted: false,
      isEmpowered,
      prefix,
      suffix
    });

    it('should return zero stats when no equipment', () => {
      const stats = calculateTotalEquipmentStats(null, null, null, null);

      expect(stats.damageBonus).toBe(0);
      expect(stats.critChance).toBe(0);
      expect(stats.defense).toBe(0);
      expect(stats.maxHpBonus).toBe(0);
      expect(stats.attackSpeed).toBe(0);
      expect(stats.coinBonus).toBe(0);
      expect(stats.healBonus).toBe(0);
      expect(stats.lifesteal).toBe(0);
      expect(stats.defensiveLifesteal).toBe(0);
      expect(stats.thorns).toBe(0);
      expect(stats.autoClickRate).toBe(0);
    });

    it('should sum stats from multiple equipped items', () => {
      const weapon = createMockEquippedItem({ damageBonus: 10 });
      const armor = createMockEquippedItem({ defense: 5 });
      const accessory1 = createMockEquippedItem({ critChance: 10 });
      const accessory2 = createMockEquippedItem({ maxHpBonus: 20 });

      const stats = calculateTotalEquipmentStats(weapon, armor, accessory1, accessory2);

      expect(stats.damageBonus).toBe(10);
      expect(stats.defense).toBe(5);
      expect(stats.critChance).toBe(10);
      expect(stats.maxHpBonus).toBe(20);
    });

    it('should apply tier scaling (T1 stats = base, T2 = 1.4x)', () => {
      const weapon = createMockEquippedItem({ damageBonus: 10 }, 2); // T2 = 1.4x

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.damageBonus).toBe(14); // ceil(10 * 1.4) = 14
    });

    it('should apply empowered bonus (+20%)', () => {
      const weapon = createMockEquippedItem({ damageBonus: 10 }, 1, true);

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.damageBonus).toBe(12); // ceil(10 * 1.2) = 12
    });

    it('should apply both tier scaling and empowered bonus', () => {
      const weapon = createMockEquippedItem({ damageBonus: 10 }, 2, true); // T2 + empowered

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.damageBonus).toBe(17); // ceil(ceil(10 * 1.4) * 1.2) = ceil(14 * 1.2) = 17
    });

    it('should keep lifesteal/autoClickRate precise (no ceiling)', () => {
      const weapon = createMockEquippedItem({ lifesteal: 5, autoClickRate: 1 }, 1, true);

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.lifesteal).toBe(6); // 5 * 1.2 = 6 (precise)
      expect(stats.autoClickRate).toBe(1.2); // 1 * 1.2 = 1.2 (precise)
    });

    it('should apply inscription bonuses', () => {
      const prefix = { type: 'damage' as const, value: 5, rarity: 'rare' };
      const suffix = { type: 'critical' as const, value: 10, rarity: 'epic' };
      const weapon = createMockEquippedItem({ damageBonus: 10 }, 1, false, prefix, suffix);

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.damageBonus).toBe(15); // 10 base + 5 prefix
      expect(stats.critChance).toBe(10); // 0 base + 10 suffix
    });

    it('should stack all modifiers correctly (tier + empowered + inscription)', () => {
      const prefix = { type: 'damage' as const, value: 8, rarity: 'legendary' };
      const weapon = createMockEquippedItem({ damageBonus: 10 }, 2, true, prefix);
      // ceil(10 * 1.4) = 14 (T2 scaling)
      // ceil(14 * 1.2) = 17 (empowered)
      // 17 + 8 = 25 (inscription)

      const stats = calculateTotalEquipmentStats(weapon, null, null, null);

      expect(stats.damageBonus).toBe(25);
    });

    it('should handle items without equipment stats', () => {
      const invalidItem: EquippedItem = {
        inventoryId: 'test',
        lootTableId: 'consumable',
        slot: 'weapon',
        lootItem: {
          lootId: 'consumable',
          name: 'Potion',
          icon: '🧪',
          description: 'Test',
          rarity: 'common' as const,
          type: 'consumable' as const
          // NO equipmentStats
        },
        tier: 1,
        crafted: false,
        isEmpowered: false
      };

      const stats = calculateTotalEquipmentStats(invalidItem, null, null, null);

      // Should not crash, just return 0 stats
      expect(stats.damageBonus).toBe(0);
    });

    it('should handle all inscription types', () => {
      const inscriptions = [
        { type: 'damage' as const, value: 5 },
        { type: 'critical' as const, value: 10 },
        { type: 'protection' as const, value: 8 },
        { type: 'vitality' as const, value: 15 },
        { type: 'haste' as const, value: 12 },
        { type: 'fortune' as const, value: 20 },
        { type: 'healing' as const, value: 3 },
        { type: 'lifesteal' as const, value: 2 },
        { type: 'defensiveLifesteal' as const, value: 1 },
        { type: 'thorns' as const, value: 4 },
        { type: 'autoclick' as const, value: 0.5 }
      ];

      let totalStats: TotalEquipmentStats = {
        damageBonus: 0,
        critChance: 0,
        defense: 0,
        maxHpBonus: 0,
        attackSpeed: 0,
        coinBonus: 0,
        healBonus: 0,
        lifesteal: 0,
        defensiveLifesteal: 0,
        thorns: 0,
        autoClickRate: 0
      };

      inscriptions.forEach((inscription, index) => {
        const item = createMockEquippedItem({}, 1, false, inscription);
        const stats = calculateTotalEquipmentStats(item, null, null, null);

        // Check that the corresponding stat was increased
        const statKeys = Object.keys(stats) as (keyof TotalEquipmentStats)[];
        const changedStats = statKeys.filter(key => stats[key] > 0);
        expect(changedStats.length).toBeGreaterThan(0);
      });
    });
  });
});
