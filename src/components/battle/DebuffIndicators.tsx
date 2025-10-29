'use client';

import { useEffect, useState } from 'react';
import type { ActiveDebuff, DebuffType } from '@/lib/types';

interface DebuffIndicatorsProps {
  debuffs: ActiveDebuff[];
  size?: 'small' | 'medium' | 'large';
  showDuration?: boolean;
}

/**
 * Visual indicators for active debuffs
 * Shows icon, color, and optional duration timer
 */
export default function DebuffIndicators({
  debuffs,
  size = 'medium',
  showDuration = true
}: DebuffIndicatorsProps) {
  const [, setTick] = useState(0);

  // Force re-render every 100ms to update timers
  useEffect(() => {
    if (!showDuration || debuffs.length === 0) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [showDuration, debuffs.length]);

  if (debuffs.length === 0) return null;

  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-base',
    large: 'w-10 h-10 text-lg'
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {debuffs.map(debuff => {
        const config = getDebuffConfig(debuff.type);
        const remaining = Math.ceil((debuff.duration - (Date.now() - debuff.startTime)) / 1000);

        return (
          <div
            key={debuff.id}
            className={`
              relative rounded border-2 transition-all
              ${sizeClasses[size]}
              hover:scale-110
            `}
            style={{
              borderColor: config.color,
              backgroundColor: `${config.color}20`,
              boxShadow: `0 0 8px ${config.color}40`
            }}
            title={`${config.name}: ${debuff.damageAmount}${debuff.damageType === 'percentage' ? '%' : ''} damage every ${debuff.tickInterval / 1000}s`}
          >
            {/* Icon */}
            <div className="flex items-center justify-center h-full">
              <span className={size === 'small' ? 'text-xs' : size === 'medium' ? 'text-base' : 'text-lg'}>
                {config.icon}
              </span>
            </div>

            {/* Duration timer */}
            {showDuration && remaining > 0 && (
              <div
                className="absolute -bottom-1 -right-1 text-[8px] font-bold rounded px-1 leading-tight"
                style={{
                  backgroundColor: config.color,
                  color: 'white'
                }}
              >
                {remaining}s
              </div>
            )}

            {/* Pulse animation for damage ticks */}
            <div
              className="absolute inset-0 rounded animate-pulse opacity-0"
              style={{
                backgroundColor: config.color,
                animation: `pulse 1s ease-in-out infinite`
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Get visual configuration for each debuff type
 */
function getDebuffConfig(type: DebuffType): {
  name: string;
  icon: string;
  color: string;
} {
  const configs = {
    poison: {
      name: 'Poison',
      icon: '☠️',
      color: '#10B981' // Green
    },
    burn: {
      name: 'Burn',
      icon: '🔥',
      color: '#F59E0B' // Orange
    },
    bleed: {
      name: 'Bleed',
      icon: '🩸',
      color: '#EF4444' // Red
    },
    slow: {
      name: 'Slow',
      icon: '🐌',
      color: '#3B82F6' // Blue
    },
    stun: {
      name: 'Stun',
      icon: '⚡',
      color: '#EAB308' // Yellow
    },
    freeze: {
      name: 'Freeze',
      icon: '❄️',
      color: '#06B6D4' // Cyan
    }
  };

  return configs[type];
}
