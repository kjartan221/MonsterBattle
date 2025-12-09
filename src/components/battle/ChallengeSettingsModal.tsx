'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useChallenge, type ChallengeConfig } from '@/contexts/ChallengeContext';

interface ChallengeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChallengeSettingsModal({ isOpen, onClose }: ChallengeSettingsModalProps) {
  const { challengeConfig, loading: contextLoading, updateChallengeConfig } = useChallenge();
  const [config, setConfig] = useState<ChallengeConfig>(challengeConfig);
  const [saving, setSaving] = useState(false);

  // Custom styles for range slider thumb
  const sliderThumbStyles = `
    input[type='range']::-webkit-slider-thumb {
      appearance: none;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    input[type='range']::-moz-range-thumb {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      cursor: pointer;
      border: 2px solid #1f2937;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
  `;

  // Sync local state with context when modal opens
  useEffect(() => {
    if (isOpen) {
      setConfig(challengeConfig);
    }
  }, [isOpen, challengeConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateChallengeConfig(config);
      toast.success('Challenge settings saved!', { icon: '⚔️', duration: 3000 });
      onClose();
    } catch (error) {
      console.error('Error saving challenge config:', error);
      toast.error('Failed to save challenge settings');
    } finally {
      setSaving(false);
    }
  };

  // Calculate reward bonuses
  const calculateRewards = () => {
    let extraLootCards = 0;
    let xpCoinMultiplier = 1.0;
    let rareDropBonus = 0;

    // Toggle bonuses
    if (config.forceShield) {
      extraLootCards += 1;
      rareDropBonus += 5;
    }
    if (config.forceSpeed) {
      extraLootCards += 1;
      rareDropBonus += 5;
    }

    // Max slider bonuses (+1 loot card for the 3 hardest settings)
    if (config.damageMultiplier === 3.0) {
      extraLootCards += 1;
    }
    if (config.escapeTimerSpeed === 4.0) {
      extraLootCards += 1;
    }
    if (config.buffStrength === 5.0) {
      extraLootCards += 1;
    }

    // Damage multiplier bonus (+25% per step)
    if (config.damageMultiplier > 1.0) {
      const damageSteps = Math.log(config.damageMultiplier) / Math.log(1.25);
      xpCoinMultiplier += damageSteps * 0.25;
      rareDropBonus += Math.floor(damageSteps) * 5;
    }

    // HP multiplier bonus (+50% per step)
    if (config.hpMultiplier > 1.0) {
      const hpSteps = Math.log(config.hpMultiplier) / Math.log(1.5);
      xpCoinMultiplier += hpSteps * 0.50;
      rareDropBonus += Math.floor(hpSteps) * 5;
    }

    // DoT intensity bonus (+30% per step)
    if (config.dotIntensity > 1.0) {
      const dotSteps = Math.log(config.dotIntensity) / Math.log(1.5);
      xpCoinMultiplier += dotSteps * 0.30;
      rareDropBonus += Math.floor(dotSteps) * 5;
    }

    // Corruption rate bonus (+60% at 100%, but also adds risk)
    if (config.corruptionRate > 0) {
      xpCoinMultiplier += config.corruptionRate * 0.60;
      rareDropBonus += Math.floor(config.corruptionRate * 10);
    }

    // Escape timer speed bonus (+40% per step, minimum 10s enforced)
    if (config.escapeTimerSpeed > 1.0) {
      const escapeSteps = Math.log(config.escapeTimerSpeed) / Math.log(1.5);
      xpCoinMultiplier += escapeSteps * 0.40;
      rareDropBonus += Math.floor(escapeSteps) * 5;
    }

    // Buff strength bonus (+35% per step)
    if (config.buffStrength > 1.0) {
      const buffSteps = Math.log(config.buffStrength) / Math.log(1.5);
      xpCoinMultiplier += buffSteps * 0.35;
      rareDropBonus += Math.floor(buffSteps) * 5;
    }

    // Boss attack speed bonus (+50% per step)
    if (config.bossAttackSpeed < 1.0) {
      const bossSteps = Math.log(1.0 / config.bossAttackSpeed) / Math.log(1.33);
      xpCoinMultiplier += bossSteps * 0.50;
      rareDropBonus += Math.floor(bossSteps) * 5;
    }

    // Skillshot circles bonus (+25% per circle)
    if (config.skillshotCircles > 0) {
      xpCoinMultiplier += config.skillshotCircles * 0.25;
      rareDropBonus += config.skillshotCircles * 5;
    }

    // Skillshot speed bonus (+30% per step)
    if (config.skillshotSpeed < 1.0) {
      const speedSteps = (1.0 - config.skillshotSpeed) / 0.1; // Each 0.1 reduction = 1 step
      xpCoinMultiplier += speedSteps * 0.30;
      rareDropBonus += Math.floor(speedSteps) * 5;
    }

    // Boss spawn rate penalty (-3 loot cards when enabled)
    if (config.bossSpawnRate === 5.0) {
      extraLootCards -= 4;
    }

    return { extraLootCards, xpCoinMultiplier, rareDropBonus };
  };

  const rewards = calculateRewards();
  const totalLootCards = 5 + rewards.extraLootCards;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <style dangerouslySetInnerHTML={{ __html: sliderThumbStyles }} />
      <div
        className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl border-4 border-orange-500 p-4 max-w-3xl w-full shadow-2xl relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-bold text-orange-400 flex items-center gap-2">
            <span className="text-3xl">⚔️</span>
            Challenge Mode
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl cursor-pointer"
          >
            ×
          </button>
        </div>

        {contextLoading ? (
          <div className="text-white text-center py-8">Loading...</div>
        ) : (
          <>
            {/* Description */}
            <div className="bg-gray-700/50 rounded-lg p-2 mb-3">
              <p className="text-gray-300 text-xs">
                Increase difficulty for better rewards! Adjust multipliers and toggle special modifiers.
              </p>
            </div>

            {/* Toggle Challenges */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {/* Force Shield */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-lg">🛡️</span>
                    <h4 className="text-sm font-semibold text-white">Shield</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.forceShield}
                      onChange={(e) => setConfig({ ...config, forceShield: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Force Speed */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-lg">⚡</span>
                    <h4 className="text-sm font-semibold text-white">Speed</h4>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.forceSpeed}
                      onChange={(e) => setConfig({ ...config, forceSpeed: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Slider Challenges - 2 Column Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {/* Monster Damage */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">💥</span>
                  <h4 className="text-sm font-semibold text-white">Damage</h4>
                  <span className="ml-auto text-sm font-bold text-red-400">{config.damageMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 1.25, 1.5, 2.0, 3.0].indexOf(config.damageMultiplier)}
                  onChange={(e) => {
                    const values = [1.0, 1.25, 1.5, 2.0, 3.0];
                    setConfig({ ...config, damageMultiplier: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 1.25, 1.5, 2.0, 3.0].indexOf(config.damageMultiplier) / 4) * 100}%, #4b5563 ${([1.0, 1.25, 1.5, 2.0, 3.0].indexOf(config.damageMultiplier) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Monster HP */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">❤️</span>
                  <h4 className="text-sm font-semibold text-white">HP</h4>
                  <span className="ml-auto text-sm font-bold text-purple-400">{config.hpMultiplier}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.hpMultiplier)}
                  onChange={(e) => {
                    const values = [1.0, 1.5, 2.0, 3.0, 5.0];
                    setConfig({ ...config, hpMultiplier: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.hpMultiplier) / 4) * 100}%, #4b5563 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.hpMultiplier) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* DoT Intensity */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">🔥</span>
                  <h4 className="text-sm font-semibold text-white">DoT</h4>
                  <span className="ml-auto text-sm font-bold text-orange-400">{config.dotIntensity}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.dotIntensity)}
                  onChange={(e) => {
                    const values = [1.0, 1.5, 2.0, 3.0, 5.0];
                    setConfig({ ...config, dotIntensity: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.dotIntensity) / 4) * 100}%, #4b5563 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.dotIntensity) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Corruption Rate */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">😈</span>
                  <h4 className="text-sm font-semibold text-white">Corrupt</h4>
                  <span className="ml-auto text-sm font-bold text-purple-400">{Math.round(config.corruptionRate * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[0, 0.25, 0.5, 0.75, 1.0].indexOf(config.corruptionRate)}
                  onChange={(e) => {
                    const values = [0, 0.25, 0.5, 0.75, 1.0];
                    setConfig({ ...config, corruptionRate: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([0, 0.25, 0.5, 0.75, 1.0].indexOf(config.corruptionRate) / 4) * 100}%, #4b5563 ${([0, 0.25, 0.5, 0.75, 1.0].indexOf(config.corruptionRate) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Escape Timer Speed */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">⏱️</span>
                  <h4 className="text-sm font-semibold text-white">Timer</h4>
                  <span className="ml-auto text-sm font-bold text-yellow-400">{Math.max(10, Math.round(30 / config.escapeTimerSpeed))}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 1.5, 2.0, 3.0, 4.0].indexOf(config.escapeTimerSpeed)}
                  onChange={(e) => {
                    const values = [1.0, 1.5, 2.0, 3.0, 4.0];
                    setConfig({ ...config, escapeTimerSpeed: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 1.5, 2.0, 3.0, 4.0].indexOf(config.escapeTimerSpeed) / 4) * 100}%, #4b5563 ${([1.0, 1.5, 2.0, 3.0, 4.0].indexOf(config.escapeTimerSpeed) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Buff Strength */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">💪</span>
                  <h4 className="text-sm font-semibold text-white">Buffs</h4>
                  <span className="ml-auto text-sm font-bold text-blue-400">{config.buffStrength}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.buffStrength)}
                  onChange={(e) => {
                    const values = [1.0, 1.5, 2.0, 3.0, 5.0];
                    setConfig({ ...config, buffStrength: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.buffStrength) / 4) * 100}%, #4b5563 ${([1.0, 1.5, 2.0, 3.0, 5.0].indexOf(config.buffStrength) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Boss Attack Speed */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">⚡</span>
                  <h4 className="text-sm font-semibold text-white">Boss CD</h4>
                  <span className="ml-auto text-sm font-bold text-red-400">{config.bossAttackSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 0.75, 0.5, 0.33, 0.25].indexOf(config.bossAttackSpeed)}
                  onChange={(e) => {
                    const values = [1.0, 0.75, 0.5, 0.33, 0.25];
                    setConfig({ ...config, bossAttackSpeed: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 0.75, 0.5, 0.33, 0.25].indexOf(config.bossAttackSpeed) / 4) * 100}%, #4b5563 ${([1.0, 0.75, 0.5, 0.33, 0.25].indexOf(config.bossAttackSpeed) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Boss Spawn Rate */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">👹</span>
                  <h4 className="text-sm font-semibold text-white">Boss Rate</h4>
                  <span className="ml-auto text-sm font-bold text-orange-400">{config.bossSpawnRate}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="1"
                  value={[1.0, 5.0].indexOf(config.bossSpawnRate)}
                  onChange={(e) => {
                    const values = [1.0, 5.0];
                    setConfig({ ...config, bossSpawnRate: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 5.0].indexOf(config.bossSpawnRate) / 1) * 100}%, #4b5563 ${([1.0, 5.0].indexOf(config.bossSpawnRate) / 1) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Skillshot Extra Circles */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">🎯</span>
                  <h4 className="text-sm font-semibold text-white">Skillshot Circles</h4>
                  <span className="ml-auto text-sm font-bold text-orange-400">+{config.skillshotCircles}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={config.skillshotCircles}
                  onChange={(e) => {
                    setConfig({ ...config, skillshotCircles: parseInt(e.target.value) });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${(config.skillshotCircles / 4) * 100}%, #4b5563 ${(config.skillshotCircles / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Skillshot Speed */}
              <div className="bg-gray-700/30 rounded-lg p-2 border-2 border-gray-600">
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-lg">⚡</span>
                  <h4 className="text-sm font-semibold text-white">Skillshot Speed</h4>
                  <span className="ml-auto text-sm font-bold text-orange-400">{config.skillshotSpeed}x</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={[1.0, 0.9, 0.8, 0.7, 0.6].indexOf(config.skillshotSpeed)}
                  onChange={(e) => {
                    const values = [1.0, 0.9, 0.8, 0.7, 0.6];
                    setConfig({ ...config, skillshotSpeed: values[parseInt(e.target.value)] });
                  }}
                  style={{
                    background: `linear-gradient(to right, #ea580c 0%, #dc2626 ${([1.0, 0.9, 0.8, 0.7, 0.6].indexOf(config.skillshotSpeed) / 4) * 100}%, #4b5563 ${([1.0, 0.9, 0.8, 0.7, 0.6].indexOf(config.skillshotSpeed) / 4) * 100}%, #4b5563 100%)`
                  }}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            {/* Total Rewards Summary */}
            <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 rounded-lg p-3 mb-3 border-2 border-orange-500">
              <h3 className="text-base font-semibold text-orange-400 mb-2">Total Rewards</h3>
              <div className="space-y-1 text-white text-sm">
                <div className="flex justify-between">
                  <span>Loot Cards:</span>
                  <span className="font-bold text-green-400">{totalLootCards} {rewards.extraLootCards > 0 && `(+${rewards.extraLootCards})`}</span>
                </div>
                <div className="flex justify-between">
                  <span>XP/Coin Multi:</span>
                  <span className="font-bold text-green-400">{rewards.xpCoinMultiplier.toFixed(2)}x {rewards.xpCoinMultiplier > 1 && `(+${Math.round((rewards.xpCoinMultiplier - 1) * 100)}%)`}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rare Drop:</span>
                  <span className="font-bold text-green-400">+{rewards.rareDropBonus}%</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-lg font-semibold transition-all cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
