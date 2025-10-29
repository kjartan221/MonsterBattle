import { MonsterBuff, MonsterBuffType } from '@/lib/types';
import { Tier } from '@/lib/biome-config';

/**
 * Generate random buffs for a monster based on tier
 *
 * Rules:
 * - Tier 1: No buffs
 * - Tier 2: 40% chance for 1 buff (weakened: Shield 30% HP, Fast 90s)
 * - Tier 3: 60% chance for 1 buff, 20% chance for 2 buffs (Shield 50% HP, Fast 60s)
 * - Tier 4: 70% chance for 1 buff, 30% chance for 2 buffs
 * - Tier 5: 80% chance for 1 buff, 40% chance for 2 buffs
 * - Bosses: No buffs except in Tier 5
 *
 * Note: Shield reduces player damage by 25%, can be removed with consumables (e.g. Acid Bottle)
 */
export function generateMonsterBuffs(tier: Tier, monsterHP: number, isBoss: boolean = false): MonsterBuff[] {
  const buffs: MonsterBuff[] = [];

  // Tier 1: No buffs
  if (tier === 1) {
    return buffs;
  }

  // Bosses: No buffs except Tier 5
  if (isBoss && tier < 5) {
    return buffs;
  }

  // Determine how many buffs to apply based on tier
  let buffCount = 0;
  const rand = Math.random();

  if (tier === 2) {
    // 40% chance for 1 buff, 60% no buffs
    if (rand < 0.4) buffCount = 1;
  } else if (tier === 3) {
    // 60% for 1 buff, 20% for 2 buffs, 20% no buffs
    if (rand < 0.6) buffCount = 1;
    else if (rand < 0.8) buffCount = 2;
  } else if (tier === 4) {
    // 70% for 1 buff, 30% for 2 buffs
    if (rand < 0.7) buffCount = 1;
    else buffCount = 2;
  } else if (tier === 5) {
    // 80% for 1 buff, 40% for 2 buffs (some overlap, so actually 80% for at least 1, 40% for 2)
    if (rand < 0.4) buffCount = 2;
    else if (rand < 0.8) buffCount = 1;
  }

  if (buffCount === 0) return buffs;

  // Available buff types (only Shield and Fast for Phase 2.1)
  const availableBuffs: MonsterBuffType[] = ['shield', 'fast'];

  // Randomly select buffs (no duplicates)
  const selectedBuffTypes: MonsterBuffType[] = [];
  for (let i = 0; i < buffCount; i++) {
    const remainingBuffs = availableBuffs.filter(b => !selectedBuffTypes.includes(b));
    if (remainingBuffs.length === 0) break;

    const randomIndex = Math.floor(Math.random() * remainingBuffs.length);
    selectedBuffTypes.push(remainingBuffs[randomIndex]);
  }

  // Apply buff values based on tier
  selectedBuffTypes.forEach(buffType => {
    if (buffType === 'shield') {
      // Shield: Tier 2 = 30% HP, Tier 3+ = 50% HP
      const shieldPercentage = tier === 2 ? 0.3 : 0.5;
      const shieldHP = Math.ceil(monsterHP * shieldPercentage);
      buffs.push({
        type: 'shield',
        value: shieldHP
      });
    } else if (buffType === 'fast') {
      // Fast: Tier 2 = 90s, Tier 3+ = 60s
      const escapeTime = tier === 2 ? 90 : 60;
      buffs.push({
        type: 'fast',
        value: escapeTime
      });
    }
  });

  return buffs;
}

/**
 * Get buff display information
 */
export function getBuffDisplayInfo(buff: MonsterBuff): { icon: string; label: string; color: string } {
  switch (buff.type) {
    case 'shield':
      return {
        icon: '🛡️',
        label: `Shield: ${buff.value} HP (-25% DMG)`,
        color: 'bg-blue-500/80 border-blue-400'
      };
    case 'fast':
      return {
        icon: '⚡',
        label: `Escapes in ${buff.value}s`,
        color: 'bg-yellow-500/80 border-yellow-400'
      };
    default:
      return {
        icon: '❓',
        label: 'Unknown',
        color: 'bg-gray-500/80 border-gray-400'
      };
  }
}
