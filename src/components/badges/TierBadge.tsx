'use client';

import { tierToRoman } from '@/utils/tierUtils';

interface TierBadgeProps {
  tier: number; // 1-5
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  className?: string;
}

/**
 * TierBadge - Shows item tier as Roman numerals (I-V)
 *
 * Standard positioning: bottom-left corner
 */
export default function TierBadge({
  tier,
  position = 'bottom-left',
  className = ''
}: TierBadgeProps) {
  const positionClasses = {
    'top-left': 'absolute top-1 left-1 sm:top-2 sm:left-2',
    'top-right': 'absolute top-1 right-1 sm:top-2 sm:right-2',
    'bottom-left': 'absolute bottom-1 left-1 sm:bottom-2 sm:left-2',
    'bottom-right': 'absolute bottom-1 right-1 sm:bottom-2 sm:right-2',
    'inline': ''
  };

  return (
    <div
      className={`
        bg-black/80 text-white text-[10px] font-bold px-1.5 py-0.5 rounded border border-white/40
        ${positionClasses[position]}
        ${position !== 'inline' ? 'z-20 pointer-events-none' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {tierToRoman(tier)}
    </div>
  );
}
