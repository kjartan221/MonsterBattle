'use client';

import { useEffect, useState } from 'react';
import type { Buff, BuffType } from '@/types/buffs';

interface BuffIndicatorsProps {
  buffs: Buff[];
  size?: 'small' | 'medium' | 'large';
  showDuration?: boolean;
}

/**
 * Visual indicators for active player buffs
 * Shows icon, color, and optional duration timer
 * Similar to DebuffIndicators but for positive effects
 */
export default function BuffIndicators({
  buffs,
  size = 'medium',
  showDuration = true
}: BuffIndicatorsProps) {
  const [, setTick] = useState(0);

  // Force re-render every 100ms to update timers
  useEffect(() => {
    if (!showDuration || buffs.length === 0) return;

    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [showDuration, buffs.length]);

  if (buffs.length === 0) return null;

  const sizeClasses = {
    small: 'w-6 h-6 text-xs',
    medium: 'w-8 h-8 text-base',
    large: 'w-10 h-10 text-lg'
  };

  return (
    <div className="flex gap-1 flex-wrap">
      {buffs.map(buff => {
        const config = getBuffConfig(buff.buffType);
        const remaining = buff.duration > 0
          ? Math.ceil((buff.expiresAt - Date.now()) / 1000)
          : Infinity;
        const isPermanent = buff.duration === 0;

        return (
          <div
            key={buff.buffId}
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
            title={getBuffTooltip(buff, config)}
          >
            {/* Icon */}
            <div className="flex items-center justify-center h-full">
              <span className={size === 'small' ? 'text-xs' : size === 'medium' ? 'text-base' : 'text-lg'}>
                {buff.icon || config.icon}
              </span>
            </div>

            {/* Duration timer or permanent indicator */}
            {showDuration && !isPermanent && remaining > 0 && (
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

            {isPermanent && (
              <div
                className="absolute -bottom-1 -right-1 text-[8px] font-bold rounded px-1 leading-tight"
                style={{
                  backgroundColor: config.color,
                  color: 'white'
                }}
              >
                ∞
              </div>
            )}

            {/* Gentle glow animation for active buffs */}
            <div
              className="absolute inset-0 rounded animate-pulse opacity-0"
              style={{
                backgroundColor: config.color,
                animation: `pulse 2s ease-in-out infinite`
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Generate tooltip text for buff
 */
function getBuffTooltip(buff: Buff, config: { name: string }): string {
  let tooltip = buff.name || config.name;

  // Add value description
  if (buff.buffType === 'shield') {
    tooltip += `: ${buff.value} HP shield`;
  } else if (buff.buffType === 'damage_boost') {
    tooltip += `: +${buff.value} damage`;
  } else if (buff.buffType === 'damage_mult' || buff.buffType === 'crit_boost' ||
             buff.buffType === 'attack_speed' || buff.buffType === 'cooldown_reduction' ||
             buff.buffType === 'coin_boost' || buff.buffType === 'xp_boost' ||
             buff.buffType === 'heal_boost') {
    tooltip += `: +${buff.value}%`;
  }

  // Add duration
  if (buff.duration > 0) {
    tooltip += ` (${buff.duration}s)`;
  } else {
    tooltip += ' (Permanent)';
  }

  return tooltip;
}

/**
 * Get visual configuration for each buff type
 */
function getBuffConfig(type: BuffType): {
  name: string;
  icon: string;
  color: string;
} {
  const configs: Record<BuffType, { name: string; icon: string; color: string }> = {
    shield: {
      name: 'Shield',
      icon: '🛡️',
      color: '#3B82F6' // Blue
    },
    damage_reduction: {
      name: 'Damage Reduction',
      icon: '🛡️',
      color: '#8B5CF6' // Purple
    },
    damage_boost: {
      name: 'Damage Boost',
      icon: '⚔️',
      color: '#EF4444' // Red
    },
    damage_mult: {
      name: 'Damage Multiplier',
      icon: '💥',
      color: '#DC2626' // Dark Red
    },
    crit_boost: {
      name: 'Critical Boost',
      icon: '💫',
      color: '#FBBF24' // Yellow
    },
    attack_speed: {
      name: 'Attack Speed',
      icon: '⚡',
      color: '#EAB308' // Gold
    },
    cooldown_reduction: {
      name: 'Cooldown Reduction',
      icon: '⏱️',
      color: '#06B6D4' // Cyan
    },
    coin_boost: {
      name: 'Coin Boost',
      icon: '🪙',
      color: '#F59E0B' // Orange
    },
    xp_boost: {
      name: 'XP Boost',
      icon: '⭐',
      color: '#8B5CF6' // Purple
    },
    heal_boost: {
      name: 'Healing Boost',
      icon: '💚',
      color: '#10B981' // Green
    },
    stat_boost: {
      name: 'Stat Boost',
      icon: '📈',
      color: '#6366F1' // Indigo
    }
  };

  return configs[type];
}
