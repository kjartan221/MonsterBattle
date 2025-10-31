'use client';

import { getStatRollQuality } from '@/utils/statRollUtils';

interface StatRangeIndicatorProps {
  statRoll: number; // 0.8 to 1.2
}

export default function StatRangeIndicator({ statRoll }: StatRangeIndicatorProps) {
  const quality = getStatRollQuality(statRoll);

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg border-2 ${quality.color} bg-gray-900/50`}>
      <span className="font-bold text-sm">
        {quality.percentage >= 0 ? '+' : ''}{quality.percentage}%
      </span>
      <span className="text-xs">
        {quality.emoji} {quality.label}
      </span>
    </div>
  );
}
