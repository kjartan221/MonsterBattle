'use client';

import React, { ReactNode } from 'react';

interface CorruptionOverlayProps {
  children?: ReactNode; // Optional: can wrap children or be used standalone
  className?: string; // Additional classes for positioning/sizing
  showLabel?: boolean; // Show "CORRUPTED" label
  size?: 'small' | 'medium' | 'large'; // Border thickness scale
}

/**
 * CorruptionOverlay - Corruption border effects for empowered items
 *
 * Usage:
 * 1. Standalone (inside relative parent): <CorruptionOverlay showLabel={false} />
 * 2. As wrapper: <CorruptionOverlay>{content}</CorruptionOverlay>
 *
 * Features:
 * - Dark purple gradient border
 * - Spiked edges on all four sides
 * - Purple glow effect
 * - Optional "CORRUPTED" label
 *
 * The parent container must have `position: relative` and `rounded-lg`
 */
export default function CorruptionOverlay({
  children,
  className = '',
  showLabel = false,
  size = 'small'
}: CorruptionOverlayProps) {
  // Spike dimensions based on size
  const spikeConfig = {
    small: { horizontal: 12, vertical: 12 }, // Loot cards, inventory items
    medium: { horizontal: 16, vertical: 14 }, // Default
    large: { horizontal: 20, vertical: 16 } // Monster arena - keep vertical smaller to prevent overflow
  };

  const { horizontal, vertical } = spikeConfig[size];

  // Spikes and effects
  const overlayElements = (
    <>

      {/* Top edge spikes */}
      <svg
        className="absolute top-0 left-0 right-0 pointer-events-none z-10 rounded-t-lg"
        style={{ height: `${horizontal}px` }}
        viewBox="0 0 300 12"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gradTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#9b59b6', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#8e44ad', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7d4a9e', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <polygon
          points="0,0 300,0 300,9 270,9 285,12 240,9 220,12 180,9 160,12 120,9 100,12 60,9 30,12 15,9 0,9"
          fill="url(#gradTop)"
        />
      </svg>

      {/* Bottom edge spikes */}
      <svg
        className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 rounded-b-lg"
        style={{ height: `${horizontal}px` }}
        viewBox="0 0 300 12"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gradBottom" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: '#9b59b6', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#8e44ad', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7d4a9e', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <polygon
          points="0,12 300,12 300,3 270,3 285,0 240,3 220,0 180,3 160,0 120,3 100,0 60,3 30,0 15,3 0,3"
          fill="url(#gradBottom)"
        />
      </svg>

      {/* Left edge spikes */}
      <svg
        className="absolute top-0 bottom-0 left-0 pointer-events-none z-10 rounded-l-lg"
        style={{ width: `${vertical}px` }}
        viewBox="0 0 12 300"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gradLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#9b59b6', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#8e44ad', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7d4a9e', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <polygon
          points="0,0 9,0 9,40 12,25 9,60 12,75 9,100 12,120 9,150 12,180 9,200 12,220 9,240 12,260 9,300 0,300"
          fill="url(#gradLeft)"
        />
      </svg>

      {/* Right edge spikes */}
      <svg
        className="absolute top-0 bottom-0 right-0 pointer-events-none z-10 rounded-r-lg"
        style={{ width: `${vertical}px` }}
        viewBox="0 0 12 300"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gradRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#9b59b6', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: '#8e44ad', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: '#7d4a9e', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
        <polygon
          points="12,0 3,0 3,40 0,25 3,60 0,75 3,100 0,120 3,150 0,180 3,200 0,220 3,240 0,260 3,300 12,300"
          fill="url(#gradRight)"
        />
      </svg>

      {/* Optional "CORRUPTED" label */}
      {showLabel && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30">
          <div className="bg-purple-900/90 text-purple-200 px-3 py-1 rounded-md border-2 border-purple-500 shadow-lg flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-wider">⚡ CORRUPTED</span>
          </div>
        </div>
      )}

      {/* Purple glow effect */}
      <div
        className="absolute inset-0 pointer-events-none animate-pulse rounded-lg z-5"
        style={{
          boxShadow: 'inset 0 0 30px rgba(139, 92, 246, 0.3), 0 0 20px rgba(139, 92, 246, 0.2)',
        }}
      />
    </>
  );

  // Always render with a container for proper sizing
  // Spikes rendered inside overflow-hidden to clip to container boundaries
  if (children) {
    return (
      <div className={`relative rounded-lg ${className}`}>
        <div className="overflow-hidden rounded-lg">
          {overlayElements}
          {children}
        </div>
      </div>
    );
  }

  // Standalone mode - just render overlay elements
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
      {overlayElements}
    </div>
  );
}
