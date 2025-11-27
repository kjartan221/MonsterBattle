'use client';

import { MonsterBuff } from '@/lib/types';
import { getBuffDisplayInfo } from '@/utils/monsterBuffs';

interface BuffIndicatorsProps {
  buffs?: MonsterBuff[];
  size?: 'small' | 'medium';
}

export default function BuffIndicators({ buffs, size = 'medium' }: BuffIndicatorsProps) {
  if (!buffs || buffs.length === 0) return null;

  const sizeClasses = {
    small: 'text-xs px-2 py-1 gap-1',
    medium: 'text-sm px-3 py-1.5 gap-2'
  };

  return (
    <div className="flex flex-wrap gap-2">
      {buffs.map((buff, index) => {
        const displayInfo = getBuffDisplayInfo(buff);
        return (
          <div
            key={index}
            className={`
              ${displayInfo.color}
              ${sizeClasses[size]}
              border-2 rounded-full
              flex items-center
              font-bold text-white
              shadow-lg
              animate-pulse
            `}
          >
            <span>{displayInfo.icon}</span>
            <span>{displayInfo.label}</span>
          </div>
        );
      })}
    </div>
  );
}
