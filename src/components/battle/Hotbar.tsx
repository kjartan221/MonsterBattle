'use client';

import { useState, useEffect, useRef } from 'react';

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
  cooldown: number;
  lastUsed: number | null;
}

interface HotbarProps {
  spellSlot?: SpellSlot; // External spell slot from hook (Phase 2.6)
  onSpellCast?: () => void;
  onConsumableUse?: (slot: number) => void;
  consumableSlots?: ConsumableSlot[]; // External slots from hook
  onSlotClick?: (slotType: 'spell' | 'consumable', slotIndex: number) => void;
  canInteract?: boolean; // True during rest phase, false during battle
}

export default function Hotbar({ spellSlot: externalSpellSlot, onSpellCast, onConsumableUse, consumableSlots: externalSlots, onSlotClick, canInteract = false }: HotbarProps) {
  // Use external spell slot if provided, otherwise use internal state
  const spellSlot = externalSpellSlot || {
    spellId: null,
    name: '',
    icon: '',
    cooldown: 0,
    lastUsed: null
  };

  // Consumable slots (1, 2, 3 keys) - use external or fallback to internal
  const consumableSlots = externalSlots || [
    { itemId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null },
    { itemId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null },
    { itemId: null, name: '', icon: '', quantity: 0, cooldown: 0, lastUsed: null }
  ];

  // Calculate remaining cooldown for spell and consumables
  const [spellCooldownRemaining, setSpellCooldownRemaining] = useState(0);
  const [consumableCooldownRemaining, setConsumableCooldownRemaining] = useState([0, 0, 0]);

  // Refs to access current values in event listener without recreating it
  const consumableCooldownRef = useRef(consumableCooldownRemaining);
  const canInteractRef = useRef(canInteract);
  
  // Keep refs in sync with state
  useEffect(() => {
    consumableCooldownRef.current = consumableCooldownRemaining;
  }, [consumableCooldownRemaining]);
  
  useEffect(() => {
    canInteractRef.current = canInteract;
  }, [canInteract]);

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

    // Call external handler (which manages state and cooldown via API)
    onSpellCast?.();
  };

  // Handle consumable use
  const handleConsumableUse = (slotIndex: number) => {
    if (consumableCooldownRemaining[slotIndex] > 0) return;
    const slot = consumableSlots[slotIndex];
    if (!slot.itemId || slot.quantity === 0) return;

    // Call external handler (which manages state and sets lastUsed)
    onConsumableUse?.(slotIndex);
  };

  // Single interval timer that checks all consumable cooldowns
  // This prevents memory leaks and orphaned intervals
  useEffect(() => {
    const interval = setInterval(() => {
      setConsumableCooldownRemaining((prev) => {
        const updated = [...prev];
        let hasChanges = false;

        // Check each slot and calculate remaining cooldown
        consumableSlots.forEach((slot, i) => {
          if (slot.lastUsed && slot.cooldown > 0) {
            const elapsed = (Date.now() - slot.lastUsed) / 1000;
            const remaining = Math.max(0, slot.cooldown - elapsed);
            
            if (updated[i] !== remaining) {
              updated[i] = remaining;
              hasChanges = true;
            }
          } else if (updated[i] !== 0) {
            // No cooldown active, ensure it's 0
            updated[i] = 0;
            hasChanges = true;
          }
        });

        // Only update state if something changed (avoid unnecessary renders)
        return hasChanges ? updated : prev;
      });
    }, 100); // Check every 100ms for smooth countdown

    return () => clearInterval(interval);
  }, [consumableSlots]); // Recreate only when slots prop changes

  // Keyboard shortcuts
  // Using refs to avoid recreating listener on every state change
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent shortcuts if typing in input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Don't allow keyboard shortcuts during canInteract mode (rest phase)
      // User should click to equip items instead
      if (canInteractRef.current) {
        return;
      }

      // Access current cooldown values via ref (not stale closure)
      const currentConsumableCooldowns = consumableCooldownRef.current;

      if (e.key === 'q' || e.key === 'Q') {
        handleSpellCast();
      } else if (e.key === '1') {
        // Only trigger if not on cooldown
        if (currentConsumableCooldowns[0] === 0) {
          handleConsumableUse(0);
        }
      } else if (e.key === '2') {
        if (currentConsumableCooldowns[1] === 0) {
          handleConsumableUse(1);
        }
      } else if (e.key === '3') {
        if (currentConsumableCooldowns[2] === 0) {
          handleConsumableUse(2);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []); // Empty deps - listener never recreates, uses refs for current values

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] sm:bottom-8 left-1/2 -translate-x-1/2 z-10">
      <div className="bg-gray-900/95 border-2 border-gray-700 rounded-lg p-3 md:p-4 shadow-2xl">
        <div className="flex gap-3 md:gap-4">
          {/* Spell Slot (Q) */}
          <button
            onClick={() => {
              // Always open modal on click (spell casting only via Q keybind)
              onSlotClick?.('spell', 0);
            }}
            className={`
              relative w-16 h-16 md:w-20 md:h-20 rounded-lg border-2 transition-all cursor-pointer
              ${spellSlot.spellId
                ? 'border-purple-500 bg-purple-900/30 hover:bg-purple-800/40 active:scale-95'
                : 'border-gray-500 bg-gray-800/30 hover:bg-gray-700/40'}
              ${!canInteract && spellCooldownRemaining > 0 ? 'opacity-50' : ''}
            `}
          >
            {/* Keybind indicator */}
            <div className="absolute -top-2 -left-2 w-5 h-5 md:w-6 md:h-6 bg-purple-600 rounded text-white text-xs md:text-sm font-bold flex items-center justify-center">
              Q
            </div>

            {/* Spell icon or empty state */}
            {spellSlot.spellId ? (
              <>
                <div className="text-2xl md:text-3xl">{spellSlot.icon}</div>
                <div className="text-[8px] md:text-[10px] text-gray-300 mt-0.5 leading-tight">
                  {spellSlot.name}
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-xs md:text-sm">
                Empty
              </div>
            )}

            {/* Cooldown overlay */}
            {spellCooldownRemaining > 0 && (
              <>
                <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm md:text-base">
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
              onClick={() => {
                // Always open modal on click (consumable use only via 1-3 keybinds)
                onSlotClick?.('consumable', index);
              }}
              className={`
                relative w-16 h-16 md:w-20 md:h-20 rounded-lg border-2 transition-all cursor-pointer
                ${slot.itemId && slot.quantity > 0
                  ? 'border-blue-500 bg-blue-900/30 hover:bg-blue-800/40 active:scale-95'
                  : 'border-gray-500 bg-gray-800/30 hover:bg-gray-700/40'}
                ${!canInteract && consumableCooldownRemaining[index] > 0 ? 'opacity-50' : ''}
              `}
            >
              {/* Keybind indicator */}
              <div className="absolute -top-2 -left-2 w-5 h-5 md:w-6 md:h-6 bg-blue-600 rounded text-white text-xs md:text-sm font-bold flex items-center justify-center">
                {index + 1}
              </div>

              {/* Item icon or empty state */}
              {slot.itemId ? (
                <>
                  <div className="text-2xl md:text-3xl">{slot.icon}</div>
                  <div className="text-[8px] md:text-[10px] text-gray-300 mt-0.5 leading-tight">
                    {slot.name}
                  </div>
                  {/* Quantity badge */}
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 md:w-6 md:h-6 bg-gray-900 border border-blue-500 rounded-full text-white text-[10px] md:text-xs font-bold flex items-center justify-center">
                    {slot.quantity}
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-xs md:text-sm">
                  Empty
                </div>
              )}

              {/* Cooldown overlay */}
              {consumableCooldownRemaining[index] > 0 && (
                <>
                  <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm md:text-base">
                      {Math.ceil(consumableCooldownRemaining[index])}s
                    </span>
                  </div>
                  {/* Cooldown circle animation */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="50%"
                      cy="50%"
                      r="28"
                      fill="none"
                      stroke="blue"
                      strokeWidth="2"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (consumableCooldownRemaining[index] / slot.cooldown)}`}
                      className="transition-all duration-100"
                    />
                  </svg>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Helper text */}
        <div className="text-center text-gray-400 text-[10px] md:text-xs mt-2">
          {canInteract ? 'Click to equip items' : 'Press Q or 1-3 to use'}
        </div>
      </div>
    </div>
  );
}
