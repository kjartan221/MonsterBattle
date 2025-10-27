'use client';

interface CheatDetectionModalProps {
  show: boolean;
  message: string;
  onClose: () => void;
}

export default function CheatDetectionModal({ show, message, onClose }: CheatDetectionModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-red-900 to-red-800 border-4 border-red-500 rounded-xl p-8 max-w-md w-full shadow-2xl animate-pulse">
        <div className="text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Suspicious Activity Detected!
          </h2>
          <p className="text-white whitespace-pre-line mb-6">
            {message}
          </p>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
}
