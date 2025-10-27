'use client';

interface BattleDefeatScreenProps {
  monsterName: string;
  monsterRarity: 'common' | 'rare' | 'epic' | 'legendary';
  monsterIcon: string;
  goldLost: number;
  streakLost: number;
  onContinue: () => void;
}

export default function BattleDefeatScreen({
  monsterName,
  monsterRarity,
  monsterIcon,
  goldLost,
  streakLost,
  onContinue
}: BattleDefeatScreenProps) {
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
      <div className="bg-gradient-to-br from-red-900/90 to-slate-900 rounded-2xl p-8 border-2 border-red-500/50 shadow-2xl max-w-md w-full mx-4">
        <div className="text-center">
          {/* Defeat Icon */}
          <div className="mb-6">
            <div className="text-8xl mb-2 animate-pulse">💀</div>
            <h2 className="text-4xl font-bold text-red-400 mb-2">
              DEFEATED
            </h2>
          </div>

          {/* Monster Info */}
          <div className="mb-6 p-4 bg-black/30 rounded-lg border border-white/10">
            <p className="text-gray-300 text-sm mb-2">Defeated by</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl">{monsterIcon}</span>
              <div className="text-left">
                <h3 className="text-xl font-bold text-white">{monsterName}</h3>
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${rarityColors[monsterRarity]} text-white`}>
                  {monsterRarity.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Losses */}
          <div className="mb-6 space-y-3">
            {/* Streak Lost */}
            {streakLost > 0 && (
              <div className="p-3 bg-orange-500/20 rounded-lg border border-orange-500/50">
                <p className="text-orange-300 text-sm">
                  🔥 Win Streak Lost: <span className="font-bold">{streakLost}</span>
                </p>
              </div>
            )}

            {/* Gold Lost */}
            {goldLost > 0 && (
              <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/50">
                <p className="text-yellow-300 text-sm">
                  💰 Gold Lost: <span className="font-bold">-{goldLost}</span>
                </p>
              </div>
            )}

            {/* No Penalties */}
            {goldLost === 0 && streakLost === 0 && (
              <div className="p-3 bg-blue-500/20 rounded-lg border border-blue-500/50">
                <p className="text-blue-300 text-sm">
                  No penalties this time
                </p>
              </div>
            )}
          </div>

          {/* Encouragement Text */}
          <p className="text-gray-400 text-sm mb-6">
            Don't give up! You'll get stronger with each attempt.
          </p>

          {/* Continue Button */}
          <button
            onClick={onContinue}
            className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white text-xl font-bold rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg hover:shadow-blue-500/50 cursor-pointer"
          >
            Try Again
          </button>

          {/* Hint */}
          <p className="text-gray-500 text-xs mt-4">
            Your HP has been restored
          </p>
        </div>
      </div>
    </div>
  );
}
