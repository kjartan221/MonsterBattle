'use client';

interface BattleStartScreenProps {
  monsterName: string;
  monsterRarity: 'common' | 'rare' | 'epic' | 'legendary';
  monsterIcon: string;
  onStartBattle: () => void;
}

export default function BattleStartScreen({
  monsterName,
  monsterRarity,
  monsterIcon,
  onStartBattle
}: BattleStartScreenProps) {
  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-600'
  };

  const rarityBorderColors = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 border-2 border-white/20 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center">
          {/* Monster Preview */}
          <div className="mb-6">
            <div className={`inline-block p-6 rounded-full bg-gradient-to-br ${rarityColors[monsterRarity]} border-4 ${rarityBorderColors[monsterRarity]}`}>
              <span className="text-7xl">{monsterIcon}</span>
            </div>
          </div>

          {/* Monster Info */}
          <h2 className="text-3xl font-bold text-white mb-2">
            A wild {monsterName} appears!
          </h2>
          <span className={`inline-block text-sm font-semibold px-4 py-1 rounded-full mb-6 bg-gradient-to-r ${rarityColors[monsterRarity]} text-white`}>
            {monsterRarity.toUpperCase()}
          </span>

          {/* Warning Text */}
          <p className="text-gray-300 text-sm mb-6">
            Prepare yourself! The monster will attack once per second.
            Defeat it before your HP reaches zero!
          </p>

          {/* Start Button */}
          <button
            onClick={onStartBattle}
            className="w-full py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-xl font-bold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-green-500/50 cursor-pointer"
          >
            ⚔️ Start Battle
          </button>

          {/* Hint */}
          <p className="text-gray-400 text-xs mt-4">
            Click the monster repeatedly to deal damage
          </p>
        </div>
      </div>
    </div>
  );
}
