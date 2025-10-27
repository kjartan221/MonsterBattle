// Monster Definition Template
export interface MonsterTemplate {
  name: string;
  imageUrl: string; // Emoji icon
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  clicksRange: [number, number]; // Range of clicks required to defeat
  attackDamage: number; // Damage per second dealt to player
}

// Monster Templates - Base stats for each monster type
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    name: 'Goblin',
    imageUrl: '👺',
    rarity: 'common',
    clicksRange: [5, 10],
    attackDamage: 2 // 2 damage per second
  },
  {
    name: 'Orc',
    imageUrl: '👹',
    rarity: 'common',
    clicksRange: [8, 12],
    attackDamage: 3 // 3 damage per second
  },
  {
    name: 'Zombie',
    imageUrl: '🧟‍♂️',
    rarity: 'common',
    clicksRange: [6, 11],
    attackDamage: 2 // 2 damage per second
  },
  {
    name: 'Troll',
    imageUrl: '🧟',
    rarity: 'rare',
    clicksRange: [15, 20],
    attackDamage: 5 // 5 damage per second
  },
  {
    name: 'Ghost',
    imageUrl: '👻',
    rarity: 'rare',
    clicksRange: [12, 18],
    attackDamage: 4 // 4 damage per second
  },
  {
    name: 'Dragon',
    imageUrl: '🐉',
    rarity: 'epic',
    clicksRange: [25, 35],
    attackDamage: 8 // 8 damage per second
  },
  {
    name: 'Vampire',
    imageUrl: '🧛',
    rarity: 'epic',
    clicksRange: [20, 30],
    attackDamage: 7 // 7 damage per second
  },
  {
    name: 'Demon',
    imageUrl: '😈',
    rarity: 'legendary',
    clicksRange: [40, 50],
    attackDamage: 12 // 12 damage per second
  },
];

// Rarity weights for random selection
export const RARITY_WEIGHTS = {
  common: 60,    // 60% chance
  rare: 25,      // 25% chance
  epic: 12,      // 12% chance
  legendary: 3   // 3% chance
};

/**
 * Get a random monster template based on rarity weights
 */
export function getRandomMonsterTemplate(): MonsterTemplate {
  const totalWeight = Object.values(RARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  let selectedRarity: keyof typeof RARITY_WEIGHTS = 'common';
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    random -= weight;
    if (random <= 0) {
      selectedRarity = rarity as keyof typeof RARITY_WEIGHTS;
      break;
    }
  }

  // Filter monsters by selected rarity
  const monstersOfRarity = MONSTER_TEMPLATES.filter(m => m.rarity === selectedRarity);
  return monstersOfRarity[Math.floor(Math.random() * monstersOfRarity.length)];
}

/**
 * Get random clicks required within a range
 */
export function getRandomClicksRequired(range: [number, number]): number {
  return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
}

/**
 * Get monster template by name
 */
export function getMonsterTemplateByName(name: string): MonsterTemplate | undefined {
  return MONSTER_TEMPLATES.find(m => m.name === name);
}
