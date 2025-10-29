'use client';

import { useState, useEffect } from 'react';

interface SpellSlot {
  spellId: string | null;
  name: string;
  icon: string;
  cooldown: number; // seconds
  lastUsed: number | null; // timestamp
}

interface ConsumableSlot {
  itemId: string | null;
  name: string;
  icon: string;
  quantity: number;
}

interface HotbarProps {
  onSpellCast?: () => void;
  onConsumableUse?: (slot: number) => void;
}

export default function Hotbar({ onSpellCast, onConsumableUse }: HotbarProps) {
  // Spell slot (Q key)
  const [spellSlot, setSpellSlot] = useState<SpellSlot>({
    spellId: null,
    name: '',
    icon: '',
    cooldown: 0,
    lastUsed: null
  });

  // Consumable slots (1, 2, 3 keys)
  const [consumableSlots, setConsumableSlots] = useState<ConsumableSlot[]>([
    { itemId: null, name: '', icon: '', quantity: 0 },
    { itemId: null, name: '', icon: '', quantity: 0 },
    { itemId: null, name: '', icon: '', quantity: 0 }
  ]);

  // Calculate remaining cooldown for spell
  const [spellCooldownRemaining, setSpellCooldownRemaining] = useState(0);

  useEffect(() => {
    if (!spellSlot.lastUsed || !spellSlot.cooldown) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - spellSlot.lastUsed!) / 1000;
      const remaining = Math.max(0, spellSlot.cooldown - elapsed);
      setSpellCooldownRemaining(remaining);

      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [spellSlot.lastUsed, spellSlot.cooldown]);

  // Handle spell cast
  const handleSpellCast = () => {
    if (!spellSlot.spellId) return;
    if (spellCooldownRemaining > 0) return;

    setSpellSlot(prev => ({ ...prev, lastUsed: Date.now() }));
    onSpellCast?.();
  };

  // Handle consumable use
  const handleConsumableUse = (slotIndex: number) => {
    const slot = consumableSlots[slotIndex];
    if (!slot.itemId || slot.quantity === 0) return;

    // Decrease quantity
    setConsumableSlots(prev => {
      const updated = [...prev];
      updated[slotIndex] = { ...updated[slotIndex], quantity: updated[slotIndex].quantity - 1 };
      return updated;
    });

    onConsumableUse?.(slotIndex);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent shortcuts if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'q' || e.key === 'Q') {
        handleSpellCast();
      } else if (e.key === '1') {
        handleConsumableUse(0);
      } else if (e.key === '2') {
        handleConsumableUse(1);
      } else if (e.key === '3') {
        handleConsumableUse(2);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [spellSlot, consumableSlots, spellCooldownRemaining]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-gray-900/95 border-2 border-gray-700 rounded-lg p-3 shadow-2xl">
        <div className="flex gap-3">
          {/* Spell Slot (Q) */}
          <button
            onClick={handleSpellCast}
            disabled={!spellSlot.spellId || spellCooldownRemaining > 0}
            className={`
              relative w-16 h-16 rounded-lg border-2 transition-all
              ${spellSlot.spellId
                ? 'border-purple-500 bg-purple-900/30 hover:bg-purple-800/40 active:scale-95'
                : 'border-gray-600 bg-gray-800/50 cursor-not-allowed'}
              ${spellCooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {/* Keybind indicator */}
            <div className="absolute -top-2 -left-2 w-5 h-5 bg-purple-600 rounded text-white text-xs font-bold flex items-center justify-center">
              Q
            </div>

            {/* Spell icon or empty state */}
            {spellSlot.spellId ? (
              <>
                <div className="text-2xl">{spellSlot.icon}</div>
                <div className="text-[8px] text-gray-300 mt-0.5 leading-tight">
                  {spellSlot.name}
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-xs">
                Empty
              </div>
            )}

            {/* Cooldown overlay */}
            {spellCooldownRemaining > 0 && (
              <>
                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {Math.ceil(spellCooldownRemaining)}s
                  </span>
                </div>
                {/* Cooldown circle animation */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="28"
                    fill="none"
                    stroke="purple"
                    strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (spellCooldownRemaining / spellSlot.cooldown)}`}
                    className="transition-all duration-100"
                  />
                </svg>
              </>
            )}
          </button>

          {/* Vertical divider */}
          <div className="w-px bg-gray-600"></div>

          {/* Consumable Slots (1, 2, 3) */}
          {consumableSlots.map((slot, index) => (
            <button
              key={index}
              onClick={() => handleConsumableUse(index)}
              disabled={!slot.itemId || slot.quantity === 0}
              className={`
                relative w-16 h-16 rounded-lg border-2 transition-all
                ${slot.itemId && slot.quantity > 0
                  ? 'border-blue-500 bg-blue-900/30 hover:bg-blue-800/40 active:scale-95'
                  : 'border-gray-600 bg-gray-800/50 cursor-not-allowed'}
              `}
            >
              {/* Keybind indicator */}
              <div className="absolute -top-2 -left-2 w-5 h-5 bg-blue-600 rounded text-white text-xs font-bold flex items-center justify-center">
                {index + 1}
              </div>

              {/* Item icon or empty state */}
              {slot.itemId ? (
                <>
                  <div className="text-2xl">{slot.icon}</div>
                  <div className="text-[8px] text-gray-300 mt-0.5 leading-tight">
                    {slot.name}
                  </div>
                  {/* Quantity badge */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gray-900 border border-blue-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
                    {slot.quantity}
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-xs">
                  Empty
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Helper text */}
        <div className="text-center text-gray-400 text-[10px] mt-2">
          Press Q or 1-3 to use
        </div>
      </div>
    </div>
  );
}
