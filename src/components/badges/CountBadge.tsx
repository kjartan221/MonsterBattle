'use client';

interface CountBadgeProps {
  count: number;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  className?: string;
}

/**
 * CountBadge - Shows item stack count (e.g., "x3")
 *
 * Standard positioning: bottom-right corner
 * Only renders if count > 1
 */
export default function CountBadge({
  count,
  position = 'bottom-right',
  className = ''
}: CountBadgeProps) {
  // Don't render if count is 1 or less
  if (count <= 1) return null;

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
        bg-gray-900 border-2 border-white text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg
        ${positionClasses[position]}
        ${position !== 'inline' ? 'z-20 pointer-events-none' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      x{count}
    </div>
  );
}
