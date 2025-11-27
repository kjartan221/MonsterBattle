'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getLootItemById, LootItem } from '@/lib/loot-table';
import toast from 'react-hot-toast';
import { tierToRoman } from '@/utils/tierUtils';
import { getInscribedItemName, getInscriptionStatLabel, formatInscriptionStat, getInscriptionRarityColor } from '@/utils/itemNameHelpers';
import type { Inscription } from '@/lib/types';

interface InventoryItem {
  _id: string;
  lootTableId: string;
  itemType: string;
  tier: number;
  borderGradient: { color1: string; color2: string };
  prefix?: Inscription;
  suffix?: Inscription;
  crafted?: boolean;
  statRoll?: number;
  isEmpowered?: boolean;
}

export default function BlacksmithPage() {
  const router = useRouter();
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [scrolls, setScrolls] = useState<InventoryItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<InventoryItem | null>(null);
  const [selectedScroll, setSelectedScroll] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [overwriteWarning, setOverwriteWarning] = useState<{
    slot: 'prefix' | 'suffix';
    existingInscription: Inscription;
  } | null>(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/get');
      const data = await response.json();

      if (response.ok && data.success) {
        const allItems = data.inventory.map((item: any) => ({
          _id: item.inventoryId,
          lootTableId: item.lootId,
          itemType: item.type,
          tier: item.tier,
          borderGradient: item.borderGradient,
          prefix: item.prefix,
          suffix: item.suffix,
          crafted: item.crafted,
          statRoll: item.statRoll,
          isEmpowered: item.isEmpowered
        }));

        // Separate equipment and scrolls
        const equipmentItems = allItems.filter((item: InventoryItem) =>
          ['weapon', 'armor', 'artifact'].includes(item.itemType)
        );
        const scrollItems = allItems.filter((item: InventoryItem) =>
          item.itemType === 'inscription_scroll'
        );

        setEquipment(equipmentItems);
        setScrolls(scrollItems);
      } else {
        toast.error(data.error || 'Failed to load inventory');
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyInscription = async (overwrite = false) => {
    if (!selectedEquipment || !selectedScroll) {
      toast.error('Please select both equipment and scroll');
      return;
    }

    setApplying(true);
    try {
      const response = await fetch('/api/inscriptions/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          equipmentId: selectedEquipment._id,
          scrollId: selectedScroll._id,
          overwriteExisting: overwrite
        })
      });

      const data = await response.json();

      if (response.status === 409) {
        // Overwrite warning
        setOverwriteWarning(data.overwriteWarning);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply inscription');
      }

      toast.success(data.message, { icon: '✨', duration: 4000 });

      // Reset selections and refresh
      setSelectedEquipment(null);
      setSelectedScroll(null);
      setOverwriteWarning(null);
      fetchInventory();

    } catch (error) {
      console.error('Apply inscription error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to apply inscription');
    } finally {
      setApplying(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'text-gray-400 border-gray-500 bg-gray-900/50',
      rare: 'text-blue-400 border-blue-500 bg-blue-900/30',
      epic: 'text-purple-400 border-purple-500 bg-purple-900/30',
      legendary: 'text-amber-400 border-amber-500 bg-amber-900/30'
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">🔨</div>
          <p className="text-gray-400 text-lg">Loading blacksmith...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">🔨 Blacksmith</h1>
            <p className="text-gray-400">Apply inscriptions to your equipment</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => router.push('/inventory')}
              className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              📦 Inventory
            </button>
            <button
              onClick={() => router.push('/crafting')}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              🔨 Crafting
            </button>
            <button
              onClick={() => router.push('/battle')}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              ⚔️ Battle
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equipment Selection */}
        <div className="bg-gray-800/70 rounded-lg border-2 border-gray-700 p-4">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>⚔️</span>
            <span>Select Equipment</span>
          </h2>

          {equipment.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-3">📦</div>
              <div className="text-sm">No equipment available</div>
              <div className="text-xs mt-2">Craft or find equipment first!</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {equipment.map((item) => {
                const lootItem = getLootItemById(item.lootTableId);
                if (!lootItem) return null;

                const isSelected = selectedEquipment?._id === item._id;
                const rarityClasses = getRarityColor(lootItem.rarity);

                return (
                  <button
                    key={item._id}
                    onClick={() => setSelectedEquipment(item)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-900/30 shadow-lg'
                        : `${rarityClasses} hover:scale-102`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`font-semibold ${lootItem.rarity === 'legendary' ? 'text-amber-400' : lootItem.rarity === 'epic' ? 'text-purple-400' : lootItem.rarity === 'rare' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {getInscribedItemName(lootItem.name, item.prefix, item.suffix)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Tier {tierToRoman(item.tier)} • {lootItem.type}
                        </div>
                        {/* Show current inscriptions */}
                        <div className="mt-2 space-y-1">
                          {item.prefix && (
                            <div className={`text-xs ${getInscriptionRarityColor(item.prefix.value)}`}>
                              ✨ {item.prefix.name}: {formatInscriptionStat(item.prefix.type, item.prefix.value)}
                            </div>
                          )}
                          {item.suffix && (
                            <div className={`text-xs ${getInscriptionRarityColor(item.suffix.value)}`}>
                              ✨ {item.suffix.name}: {formatInscriptionStat(item.suffix.type, item.suffix.value)}
                            </div>
                          )}
                          {!item.prefix && !item.suffix && (
                            <div className="text-xs text-gray-600">No inscriptions</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scroll Selection */}
        <div className="bg-gray-800/70 rounded-lg border-2 border-gray-700 p-4">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>📜</span>
            <span>Select Inscription</span>
          </h2>

          {scrolls.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-3">📜</div>
              <div className="text-sm">No inscription scrolls</div>
              <div className="text-xs mt-2">Defeat bosses to find scrolls!</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {scrolls.map((item) => {
                const lootItem = getLootItemById(item.lootTableId);
                if (!lootItem || !lootItem.inscriptionData) return null;

                const isSelected = selectedScroll?._id === item._id;
                const rarityClasses = getRarityColor(lootItem.rarity);
                const inscriptionData = lootItem.inscriptionData;

                return (
                  <button
                    key={item._id}
                    onClick={() => setSelectedScroll(item)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-orange-500 bg-orange-900/30 shadow-lg'
                        : `${rarityClasses} hover:scale-102`
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`font-semibold ${lootItem.rarity === 'legendary' ? 'text-amber-400' : lootItem.rarity === 'epic' ? 'text-purple-400' : lootItem.rarity === 'rare' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {lootItem.name}
                        </div>
                        <div className="text-xs text-gray-500 uppercase mt-1">
                          {inscriptionData.slot} • {lootItem.rarity}
                        </div>
                        <div className={`text-xs mt-2 ${getInscriptionRarityColor(inscriptionData.statValue)}`}>
                          {formatInscriptionStat(inscriptionData.inscriptionType, inscriptionData.statValue)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Application Panel */}
        <div className="bg-gray-800/70 rounded-lg border-2 border-gray-700 p-4">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span>✨</span>
            <span>Apply Inscription</span>
          </h2>

          {!selectedEquipment && !selectedScroll ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-6xl mb-4">👈</div>
              <div className="text-sm">Select equipment and scroll</div>
              <div className="text-xs mt-2 text-gray-600">
                Choose an item and inscription to begin
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Selected Equipment */}
              {selectedEquipment && (() => {
                const lootItem = getLootItemById(selectedEquipment.lootTableId);
                return lootItem ? (
                  <div className="bg-gray-900/50 rounded-lg p-4 border-2 border-gray-600">
                    <div className="text-sm text-gray-400 mb-2">Equipment:</div>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`font-bold ${lootItem.rarity === 'legendary' ? 'text-amber-400' : lootItem.rarity === 'epic' ? 'text-purple-400' : lootItem.rarity === 'rare' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {getInscribedItemName(lootItem.name, selectedEquipment.prefix, selectedEquipment.suffix)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {lootItem.type} • Tier {tierToRoman(selectedEquipment.tier)}
                        </div>
                        {/* Current inscriptions */}
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-gray-400">
                            Prefix: {selectedEquipment.prefix ? (
                              <span className={getInscriptionRarityColor(selectedEquipment.prefix.value)}>
                                {selectedEquipment.prefix.name} {formatInscriptionStat(selectedEquipment.prefix.type, selectedEquipment.prefix.value)}
                              </span>
                            ) : (
                              <span className="text-gray-600">Empty</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400">
                            Suffix: {selectedEquipment.suffix ? (
                              <span className={getInscriptionRarityColor(selectedEquipment.suffix.value)}>
                                {selectedEquipment.suffix.name} {formatInscriptionStat(selectedEquipment.suffix.type, selectedEquipment.suffix.value)}
                              </span>
                            ) : (
                              <span className="text-gray-600">Empty</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Arrow Down */}
              {selectedEquipment && selectedScroll && (
                <div className="text-center text-gray-600 text-2xl">
                  ↓
                </div>
              )}

              {/* Selected Scroll */}
              {selectedScroll && (() => {
                const lootItem = getLootItemById(selectedScroll.lootTableId);
                return lootItem?.inscriptionData ? (
                  <div className="bg-gray-900/50 rounded-lg p-4 border-2 border-gray-600">
                    <div className="text-sm text-gray-400 mb-2">Inscription:</div>
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{lootItem.icon}</span>
                      <div className="flex-1">
                        <div className={`font-bold ${lootItem.rarity === 'legendary' ? 'text-amber-400' : lootItem.rarity === 'epic' ? 'text-purple-400' : lootItem.rarity === 'rare' ? 'text-blue-400' : 'text-gray-400'}`}>
                          {lootItem.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 uppercase">
                          {lootItem.inscriptionData.slot} • {lootItem.rarity}
                        </div>
                        <div className={`text-sm mt-2 ${getInscriptionRarityColor(lootItem.inscriptionData.statValue)}`}>
                          ✨ {formatInscriptionStat(lootItem.inscriptionData.inscriptionType, lootItem.inscriptionData.statValue)}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Apply Button */}
              {selectedEquipment && selectedScroll && (
                <button
                  onClick={() => handleApplyInscription(false)}
                  disabled={applying}
                  className="w-full py-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-lg transition-all cursor-pointer text-lg"
                >
                  {applying ? 'Applying...' : '✨ Apply Inscription'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overwrite Warning Modal */}
      {overwriteWarning && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg border-4 border-orange-500 max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-bold text-orange-400 mb-4">⚠️ Overwrite Warning</h3>
            <p className="text-white mb-4">
              This equipment already has a <span className="font-bold text-orange-400">{overwriteWarning.slot}</span> inscription:
            </p>
            <div className="bg-gray-900/50 rounded-lg p-4 mb-4 border-2 border-orange-500/50">
              <div className={`font-bold ${getInscriptionRarityColor(overwriteWarning.existingInscription.value)}`}>
                {overwriteWarning.existingInscription.name}
              </div>
              <div className={`text-sm mt-2 ${getInscriptionRarityColor(overwriteWarning.existingInscription.value)}`}>
                {formatInscriptionStat(overwriteWarning.existingInscription.type, overwriteWarning.existingInscription.value)}
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-6">
              Applying the new inscription will permanently remove the existing one. This cannot be undone!
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setOverwriteWarning(null)}
                className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setOverwriteWarning(null);
                  handleApplyInscription(true);
                }}
                disabled={applying}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white font-bold rounded-lg transition-colors cursor-pointer"
              >
                {applying ? 'Replacing...' : 'Replace'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
