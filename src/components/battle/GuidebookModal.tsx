'use client';

interface GuidebookModalProps {
  onClose: () => void;
}

export default function GuidebookModal({ onClose }: GuidebookModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-amber-600 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="sticky top-4 right-4 float-right text-gray-400 hover:text-white transition-colors cursor-pointer z-10"
          aria-label="Close guidebook"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-6xl mb-3">📚</div>
            <h2 className="text-3xl font-bold text-amber-400">Game Guidebook</h2>
            <p className="text-gray-400 text-sm mt-2">Learn about game systems and where to use them</p>
          </div>

          {/* Equipment System */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <span>⚔️</span>
              Equipment System
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Equipment widget on the battle page (left side, below biome map)
              </p>
              <p>
                <span className="font-bold text-white">How to use:</span> Click on any equipment slot to open the selection modal, then choose an item to equip or unequip.
              </p>
              <p>
                <span className="font-bold text-white">Slots:</span> Weapon, Armor, Accessory 1, Accessory 2
              </p>
              <p className="text-amber-400 text-xs mt-2 font-semibold">
                ⚠️ Only minted NFTs can be equipped. Mint items from your inventory by clicking on them and selecting "Mint as NFT".
              </p>
              <p className="text-gray-400 text-xs mt-1">
                Equipped items grant bonus stats that help you in battle (damage, crit, defense, HP, etc.)
              </p>
            </div>
          </div>

          {/* Crafting & Stat Rolls */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
              <span>🔨</span>
              Crafting & Stat Rolls
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Crafting page (navigate via inventory or biome map buttons)
              </p>
              <p>
                <span className="font-bold text-white">How it works:</span> Combine materials to create equipment, consumables, and artifacts.
              </p>
              <p>
                <span className="font-bold text-white">Stat Rolls:</span> Crafted equipment gets a random quality roll (0.8x - 1.2x base stats).
              </p>
              <p className="text-amber-400 text-xs mt-2 font-semibold">
                ⚠️ Only minted materials can be used for crafting. Mint materials from your inventory first.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                <span className="font-bold text-purple-300">Quality Tiers:</span> ⭐ Masterwork (+15% to +20%), ✨ Superior (+5% to +15%), ⚖️ Standard (-5% to +5%), 📉 Inferior (-15% to -5%), 💔 Poor (-20% to -15%)
              </p>
            </div>
          </div>

          {/* Refine Stones */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <span>💎</span>
              Refine Stones
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Inventory → Click on crafted equipment → Refine Equipment section
              </p>
              <p>
                <span className="font-bold text-white">How to use:</span> Open a crafted equipment item's details and click "Refine Equipment" if you have refine stones.
              </p>
              <p>
                <span className="font-bold text-white">What it does:</span> Rerolls the stat variance on crafted equipment. Guarantees a minimum of +1% quality boost per use, never downgrades.
              </p>
              <p>
                <span className="font-bold text-white">How to get:</span> Craft refine stones in the Crafting menu (requires rare boss materials).
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Use refine stones to gradually improve low-quality crafted items until they reach perfect quality (100%).
              </p>
            </div>
          </div>

          {/* Inscriptions (Blacksmith) */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-orange-400 mb-3 flex items-center gap-2">
              <span>🔨</span>
              Inscriptions (Blacksmith)
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Blacksmith page (button in inventory or crafting pages)
              </p>
              <p>
                <span className="font-bold text-white">How to use:</span> Select equipment, select an inscription scroll, preview changes, apply inscription.
              </p>
              <p>
                <span className="font-bold text-white">What it does:</span> Adds prefix or suffix modifiers to equipment (weapons, armor, artifacts).
              </p>
              <p>
                <span className="font-bold text-white">Slots:</span> Each item has 1 prefix slot and 1 suffix slot. Applying a new inscription overwrites the old one.
              </p>
              <p className="text-amber-400 text-xs mt-2 font-semibold">
                ⚠️ Only minted equipment and scrolls can be used for inscriptions. Mint items from your inventory first.
              </p>
              <p className="text-gray-400 text-xs mt-1">
                <span className="font-bold text-red-300">Restrictions:</span> Autoclick and lifesteal inscriptions are exclusive - can't have both prefix AND suffix of the same type on one item.
              </p>
            </div>
          </div>

          {/* Enhancement (Consumables) */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <span>✨</span>
              Enhancement (Consumables)
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Inventory → Click on consumable → Enhancement section
              </p>
              <p>
                <span className="font-bold text-white">Requirements:</span> 5 copies of the same consumable + gold (cost varies by rarity)
              </p>
              <p>
                <span className="font-bold text-white">What it does:</span> Converts single-use consumables into infinite-use versions with cooldown.
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Enhanced consumables show a "✨ Infinite Use" badge in the hotbar selection modal. Great for frequently used potions!
              </p>
            </div>
          </div>

          {/* Equipment Stats Explained */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
              <span>📊</span>
              Equipment Stats Explained
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <div>
                <span className="font-bold text-white">⚔️ Damage Bonus:</span> Increases your attack damage.
              </div>
              <div>
                <span className="font-bold text-white">💥 Crit Chance:</span> Chance to deal 2x damage. Excess crit over 100% converts to crit multiplier.
              </div>
              <div>
                <span className="font-bold text-white">🛡️ Defense:</span> Reduces monster damage (diminishing returns, max 80% reduction).
              </div>
              <div>
                <span className="font-bold text-white">❤️ Max HP Bonus:</span> Increases your maximum health.
              </div>
              <div>
                <span className="font-bold text-white">🐌 Attack Speed:</span> Slows monster attacks (diminishing returns, max 50% slowdown).
              </div>
              <div>
                <span className="font-bold text-white">🩸 Lifesteal (Offense):</span> Heals % of damage dealt (only on manual clicks).
              </div>
              <div>
                <span className="font-bold text-white">💚 Tank Heal (Defense):</span> Heals % of damage taken.
              </div>
              <div>
                <span className="font-bold text-white">🔱 Thorns:</span> Reflects % of damage taken back to monster.
              </div>
              <div>
                <span className="font-bold text-white">⚡ Auto-Click Rate:</span> Automatic clicks per second.
              </div>
              <div>
                <span className="font-bold text-white">💰 Coin Bonus:</span> Increases gold earned from monsters.
              </div>
            </div>
          </div>

          {/* Corruption & Empowerment */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
              <span>⚡</span>
              Corruption & Empowerment
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Challenge settings modal (battle page, bottom left)
              </p>
              <p>
                <span className="font-bold text-white">How it works:</span> Enable "Corruption" challenge to spawn empowered monsters (purple aura).
              </p>
              <p>
                <span className="font-bold text-white">Benefits:</span> Empowered monsters have a chance to drop empowered loot (+20% bonus stats).
              </p>
              <p>
                <span className="font-bold text-white">Crafting:</span> Use empowered materials when crafting to create empowered equipment.
              </p>
              <p className="text-gray-400 text-xs mt-2">
                All materials used in crafting must be empowered for the crafted item to inherit empowered status.
              </p>
            </div>
          </div>

          {/* Challenge Mode */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
              <span>🔥</span>
              Challenge Mode
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Battle page, bottom left widget (⚔️ Challenge Mode button)
              </p>
              <p>
                <span className="font-bold text-white">How it works:</span> Enable various challenge modifiers to increase difficulty and earn bonus loot cards.
              </p>
              <p>
                <span className="font-bold text-white">Challenges:</span> HP multipliers, damage multipliers, corruption, faster monsters, armor, shields, boss spawn rate.
              </p>
              <p>
                <span className="font-bold text-white">Rewards:</span> Each active challenge grants +1 loot card per victory (up to +7 loot cards).
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Start with 1-2 challenges and gradually increase difficulty as you get stronger equipment!
              </p>
            </div>
          </div>

          {/* Biomes & Tiers */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <h3 className="text-xl font-bold text-teal-400 mb-3 flex items-center gap-2">
              <span>🗺️</span>
              Biomes & Tiers
            </h3>
            <div className="text-gray-300 text-sm space-y-2">
              <p>
                <span className="font-bold text-white">Location:</span> Biome map widget (battle page, top left)
              </p>
              <p>
                <span className="font-bold text-white">Biomes:</span> Forest, Desert, Ocean, Volcano, Castle (unlock by defeating previous biome's final tier)
              </p>
              <p>
                <span className="font-bold text-white">Tiers:</span> T1 (1x HP), T2 (3x HP), T3 (10x HP), T4 (30x HP), T5 (80x HP)
              </p>
              <p>
                <span className="font-bold text-white">Scaling:</span> Higher tiers have stronger monsters but drop higher-tier loot with better stats.
              </p>
              <p className="text-gray-400 text-xs mt-2">
                Tier scaling affects HP, damage, and equipment stats. Craft with higher-tier materials for better equipment!
              </p>
            </div>
          </div>

          {/* Close button at bottom */}
          <div className="pt-4 border-t border-gray-700">
            <button
              onClick={onClose}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer"
            >
              Close Guidebook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
