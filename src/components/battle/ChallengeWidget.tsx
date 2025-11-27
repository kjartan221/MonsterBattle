'use client';

import { useState } from 'react';
import ChallengeSettingsModal from './ChallengeSettingsModal';

export default function ChallengeWidget() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* Challenge Widget - Compact button under PlayerStatsDisplay */}
      <div className="fixed top-[420px] left-4 z-10">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white rounded-lg shadow-xl transition-all cursor-pointer border-2 border-orange-400 font-semibold text-sm flex items-center gap-2"
          title="Challenge Mode - Increase difficulty for better rewards"
        >
          <span className="text-lg">⚔️</span>
          <span>Challenge</span>
        </button>
      </div>

      {/* Challenge Settings Modal */}
      {showModal && (
        <ChallengeSettingsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
