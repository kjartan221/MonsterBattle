'use client';

import { useEffect, useState } from 'react';
import type { SpecialAttack } from '@/lib/types';

interface SpecialAttackFlashProps {
  attack: SpecialAttack | null;
}

export default function SpecialAttackFlash({ attack }: SpecialAttackFlashProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (attack) {
      setVisible(true);
      // Heal lasts longer (3.5s) so players notice the green flash
      // Other attacks last 2 seconds
      const duration = attack.type === 'heal' ? 3500 : 2000;
      const timer = setTimeout(() => {
        setVisible(false);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [attack]);

  if (!visible || !attack) return null;

  // Get color based on attack type
  const getFlashColor = () => {
    if (attack.visualEffect) {
      return attack.visualEffect; // Use custom color
    }

    switch (attack.type) {
      case 'fireball':
        return 'orange';
      case 'lightning':
        return 'blue';
      case 'meteor':
        return 'red';
      case 'heal':
        return 'green';
      default:
        return 'white';
    }
  };

  const color = getFlashColor();

  // Color-based styles
  const flashStyles: Record<string, string> = {
    orange: 'bg-orange-500/40 border-orange-400',
    blue: 'bg-blue-500/40 border-blue-400',
    red: 'bg-red-500/40 border-red-400',
    purple: 'bg-purple-500/40 border-purple-400',
    green: 'bg-green-500/40 border-green-400',
    white: 'bg-white/40 border-white'
  };

  const iconByType: Record<string, string> = {
    fireball: '🔥',
    lightning: '⚡',
    meteor: '☄️',
    heal: '💚'
  };

  // Heal gets more pulses and slower animation for visibility
  const flashAnimation = attack.type === 'heal'
    ? 'flash 0.6s ease-in-out 5'
    : 'flash 0.5s ease-in-out 3';

  return (
    <>
      {/* Screen Flash Effect */}
      <div
        className={`
          fixed inset-0 pointer-events-none z-[999]
          ${flashStyles[color] || flashStyles.white}
          animate-pulse
        `}
        style={{
          animation: flashAnimation
        }}
      />

      {/* Attack Message */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
        <div className={`
          px-8 py-4 rounded-lg border-4
          ${flashStyles[color] || flashStyles.white}
          backdrop-blur-sm
          animate-bounce
          text-center
        `}>
          <div className="text-6xl mb-2">
            {iconByType[attack.type] || '💥'}
          </div>
          <div className="text-white text-xl font-bold drop-shadow-lg">
            {attack.message || 'Special Attack!'}
          </div>
          {attack.damage && (
            <div className="text-red-400 text-2xl font-bold mt-2 drop-shadow-lg">
              -{attack.damage} HP
            </div>
          )}
          {attack.healing && (
            <div className="text-green-400 text-2xl font-bold mt-2 drop-shadow-lg">
              +{attack.healing} HP
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes flash {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  );
}
