'use client';

type MintingStatus = 'not-minted' | 'minting' | 'minted';

interface MintingStatusBadgeProps {
  status: MintingStatus;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'inline';
  className?: string;
}

/**
 * MintingStatusBadge - Shows NFT minting status
 *
 * Statuses:
 * - 'not-minted': Gray badge with "Not Minted" text
 * - 'minting': Yellow pulsing badge with "Minting..." text
 * - 'minted': Hidden (can pass mintTransactionId to show "Minted" badge)
 *
 * Standard positioning: top-right corner
 */
export default function MintingStatusBadge({
  status,
  position = 'top-right',
  className = ''
}: MintingStatusBadgeProps) {
  // Don't render if already minted (typically shows transaction ID elsewhere)
  if (status === 'minted') return null;

  const positionClasses = {
    'top-left': 'absolute top-1 left-1 sm:top-2 sm:right-2',
    'top-right': 'absolute top-1 right-1 sm:top-2 sm:right-2',
    'bottom-left': 'absolute bottom-1 left-1 sm:bottom-2 sm:left-2',
    'bottom-right': 'absolute bottom-1 right-1 sm:bottom-2 sm:right-2',
    'inline': ''
  };

  const statusStyles = {
    'not-minted': 'bg-gray-500 text-white',
    'minting': 'bg-yellow-500 text-black animate-pulse',
    'minted': ''
  };

  const statusText = {
    'not-minted': 'Not Minted',
    'minting': 'Minting...',
    'minted': ''
  };

  return (
    <div
      className={`
        text-xs font-bold px-2 py-1 rounded-full
        ${statusStyles[status]}
        ${positionClasses[position]}
        ${position !== 'inline' ? 'z-10' : ''}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {statusText[status]}
    </div>
  );
}
