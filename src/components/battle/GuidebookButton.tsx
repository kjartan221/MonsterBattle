'use client';

interface GuidebookButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function GuidebookButton({ onClick, disabled = false }: GuidebookButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="fixed top-[140px] right-2 sm:right-4 z-50 bg-gray-900/95 border-2 border-gray-700 rounded-lg px-4 py-3 shadow-xl hover:border-amber-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      title="Game Guidebook"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">📚</span>
        <span className="text-sm font-semibold text-gray-200">Guidebook</span>
      </div>
    </button>
  );
}
