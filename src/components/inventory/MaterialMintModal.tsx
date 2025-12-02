'use client';

import { useState } from 'react';

interface MaterialMintModalProps {
  materialName: string;
  tier: number;
  totalCount: number;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function MaterialMintModal({
  materialName,
  tier,
  totalCount,
  icon,
  rarity,
  onConfirm,
  onCancel,
  isProcessing = false
}: MaterialMintModalProps) {
  const [selectedOption, setSelectedOption] = useState<'single' | 'all'>('single');

  const rarityColors = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-amber-400'
  };

  const handleConfirm = () => {
    const quantity = selectedOption === 'single' ? 1 : totalCount;
    onConfirm(quantity);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg border-2 border-purple-500 max-w-md w-full p-6 shadow-2xl">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">{icon}</div>
          <h2 className="text-xl font-bold text-white mb-2">
            Mint Material Token
          </h2>
          <p className="text-gray-400 text-sm">
            {materialName} (Tier {tier})
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3 mb-6">

          {/* Single Option */}
          <button
            onClick={() => setSelectedOption('single')}
            disabled={isProcessing}
            className={`w-full p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedOption === 'single'
                ? `${rarityColors[rarity]} bg-purple-900/30`
                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-white font-bold text-sm mb-1">Mint Single Item</div>
                <div className="text-gray-400 text-xs">
                  Create token with quantity: <span className="text-white font-bold">1</span>
                </div>
              </div>
              <div className="text-2xl">
                {selectedOption === 'single' ? '✓' : '○'}
              </div>
            </div>
          </button>

          {/* All Option */}
          <button
            onClick={() => setSelectedOption('all')}
            disabled={isProcessing}
            className={`w-full p-4 rounded-lg border-2 transition-all cursor-pointer ${
              selectedOption === 'all'
                ? `${rarityColors[rarity]} bg-purple-900/30`
                : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
            } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <div className="text-white font-bold text-sm mb-1">Mint All (Recommended)</div>
                <div className="text-gray-400 text-xs">
                  Create token with quantity: <span className="text-white font-bold">{totalCount}</span>
                </div>
              </div>
              <div className="text-2xl">
                {selectedOption === 'all' ? '✓' : '○'}
              </div>
            </div>
          </button>

        </div>

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mb-6">
          <div className="flex items-start gap-2">
            <span className="text-blue-400 text-lg flex-shrink-0">ℹ️</span>
            <div className="text-blue-200 text-xs leading-relaxed">
              Material tokens are fungible and can be updated later. If you collect more {materialName}, you can add to the same token instead of creating a new one.
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Minting...</span>
              </>
            ) : (
              <>
                <span>💎</span>
                <span>Mint Token</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
