'use client';

interface QuickActionsBarProps {
  onMonsterManualClick: () => void;
  onChallengeClick: () => void;
  disabled?: boolean;
}

export default function QuickActionsBar({
  onMonsterManualClick,
  onChallengeClick,
  disabled = false
}: QuickActionsBarProps) {
  return (
    <div className="fixed top-[105px] left-2 sm:left-4 z-10 w-[calc(100vw-1rem)] sm:w-auto max-w-[320px]">
      <div className="grid grid-cols-2 gap-2">
        {/* Monster Manual Button */}
        <button
          onClick={onMonsterManualClick}
          disabled={disabled}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-3 py-3 shadow-xl hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Monster Manual"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">📖</span>
            <span className="text-sm font-semibold text-gray-200">Manual</span>
          </div>
        </button>

        {/* Challenge Button */}
        <button
          onClick={onChallengeClick}
          disabled={disabled}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-3 py-3 shadow-xl hover:border-orange-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Challenge Settings"
        >
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl">⚔️</span>
            <span className="text-sm font-semibold text-gray-200">Challenge</span>
          </div>
        </button>
      </div>
    </div>
  );
}
