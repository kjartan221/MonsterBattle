'use client';

interface EmpoweredBadgeProps {
  size?: 'small' | 'medium' | 'large';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  className?: string; // Additional custom classes
}

/**
 * EmpoweredBadge - Shows +20% bonus for items from corrupted monsters
 *
 * Positioning:
 * - 'top-left', 'top-right', 'bottom-left', 'bottom-right': Absolute positioning (use with relative parent)
 * - 'inline': Static inline display (no absolute positioning)
 *
 * Sizes:
 * - 'small': 8px-10px font, minimal padding (for cards/thumbnails)
 * - 'medium': 10px-12px font, standard padding (default)
 * - 'large': 12px-14px font, larger padding (for modals/headers)
 */
export default function EmpoweredBadge({
  size = 'medium',
  position = 'top-right',
  className = ''
}: EmpoweredBadgeProps) {
  // Size variations
  const sizeClasses = {
    small: 'text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5',
    medium: 'text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1',
    large: 'text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5'
  };

  // Position variations
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
        bg-purple-600/90 text-purple-100 font-bold rounded border border-purple-400
        ${sizeClasses[size]}
        ${positionClasses[position]}
        ${position !== 'inline' ? 'z-50 pointer-events-none' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      ⚡ +20%
    </div>
  );
}
