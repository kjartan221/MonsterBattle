'use client';

interface QuickActionsBarProps {
  onMonsterManualClick: () => void;
  onGuidebookClick: () => void;
  onChallengeClick: () => void;
  disabled?: boolean;
}

export default function QuickActionsBar({
  onMonsterManualClick,
  onGuidebookClick,
  onChallengeClick,
  disabled = false
}: QuickActionsBarProps) {
  return (
    <div className="relative z-0 md:z-10 md:fixed md:top-[105px] md:left-2 md:sm:left-4 w-full max-w-[320px] md:w-[320px]">
      <div className="grid grid-cols-3 gap-2">
        {/* Monster Manual Button */}
        <button
          onClick={onMonsterManualClick}
          disabled={disabled}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-2 py-2 sm:py-3 shadow-xl hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Monster Manual"
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-lg sm:text-xl">📖</span>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-200">Manual</span>
          </div>
        </button>

        {/* Guidebook Button */}
        <button
          onClick={onGuidebookClick}
          disabled={disabled}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-2 py-2 sm:py-3 shadow-xl hover:border-amber-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Game Guidebook"
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-lg sm:text-xl">📚</span>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-200">Guide</span>
          </div>
        </button>

        {/* Challenge Button */}
        <button
          onClick={onChallengeClick}
          disabled={disabled}
          className="bg-gray-900/95 border-2 border-gray-700 rounded-lg px-2 py-2 sm:py-3 shadow-xl hover:border-orange-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Challenge Settings"
        >
          <div className="flex flex-col items-center justify-center gap-1">
            <span className="text-lg sm:text-xl">⚔️</span>
            <span className="text-[10px] sm:text-xs font-semibold text-gray-200">Challenge</span>
          </div>
        </button>
      </div>
    </div>
  );
}
