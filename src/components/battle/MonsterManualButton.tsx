'use client';

interface MonsterManualButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function MonsterManualButton({ onClick, disabled = false }: MonsterManualButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="fixed top-[140px] left-2 sm:left-4 z-50 bg-gray-900/95 border-2 border-gray-700 rounded-lg px-4 py-3 shadow-xl hover:border-blue-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      title="Monster Manual"
    >
      <div className="flex items-center gap-2">
        <span className="text-2xl">📖</span>
        <span className="text-sm font-semibold text-gray-200">Monster Manual</span>
      </div>
    </button>
  );
}
