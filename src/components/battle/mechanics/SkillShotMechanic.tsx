'use client';

import { useState, useEffect, useRef } from 'react';

export interface SkillShotProps {
  x: number; // Position X (center of circle)
  y: number; // Position Y (center of circle)
  radius: number; // Click radius in pixels (60-100px based on tier)
  duration: number; // Time to complete in milliseconds (2000-3000ms)
  tier: number; // Monster tier (determines difficulty)
  onSuccess: () => void; // Called when player clicks in time
  onTimeout: () => void; // Called when timer expires
}

export default function SkillShotMechanic({
  x,
  y,
  radius,
  duration,
  tier,
  onSuccess,
  onTimeout
}: SkillShotProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration);
  const [isHovered, setIsHovered] = useState(false);
  const [clicked, setClicked] = useState(false);
  const startTimeRef = useRef(Date.now());

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = duration - elapsed;

      if (remaining <= 0) {
        clearInterval(interval);
        if (!clicked) {
          onTimeout();
        }
      } else {
        setTimeRemaining(remaining);
      }
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [duration, clicked, onTimeout]);

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (clicked) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate distance from center
    const centerX = radius;
    const centerY = radius;
    const distance = Math.hypot(clickX - centerX, clickY - centerY);

    if (distance <= radius) {
      setClicked(true);
      onSuccess();
    }
  };

  // Progress percentage (for shrinking border animation)
  const progress = Math.max(0, timeRemaining / duration);
  const borderWidth = Math.max(2, progress * 8); // Border shrinks from 8px to 2px

  // Color changes as time runs out
  const getColor = () => {
    if (progress > 0.5) return '#22c55e'; // Green
    if (progress > 0.25) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  };

  if (clicked) {
    // Success animation - expand and fade out
    return (
      <div
        className="fixed pointer-events-none z-[9999] transition-all duration-300"
        style={{
          left: x - radius,
          top: y - radius,
          width: radius * 2,
          height: radius * 2,
        }}
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center animate-ping"
          style={{
            background: 'radial-gradient(circle, rgba(34, 197, 94, 0.4) 0%, transparent 70%)',
            border: '3px solid #22c55e',
          }}
        >
          <div className="text-green-500 font-bold text-2xl">✓</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed cursor-pointer z-[9999] transition-all duration-100"
      style={{
        left: x - radius,
        top: y - radius,
        width: radius * 2,
        height: radius * 2,
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Outer circle with shrinking border */}
      <div
        className="w-full h-full rounded-full flex items-center justify-center relative"
        style={{
          background: isHovered
            ? 'radial-gradient(circle, rgba(34, 197, 94, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          border: `${borderWidth}px solid ${getColor()}`,
          boxShadow: `0 0 20px ${getColor()}40`,
          transform: isHovered ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 0.1s ease-in-out',
        }}
      >
        {/* Center target */}
        <div
          className="absolute rounded-full"
          style={{
            width: radius * 0.3,
            height: radius * 0.3,
            background: `${getColor()}80`,
            boxShadow: `0 0 10px ${getColor()}`,
          }}
        />

        {/* Countdown timer */}
        <div
          className="absolute bottom-2 left-1/2 transform -translate-x-1/2 font-bold text-white text-sm bg-black/60 px-2 py-1 rounded"
          style={{
            textShadow: `0 0 4px ${getColor()}`,
          }}
        >
          {(timeRemaining / 1000).toFixed(1)}s
        </div>

        {/* Tier indicator (top) */}
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 font-medium bg-gray-900/80 px-2 py-1 rounded">
          {tier >= 5 ? '⭐⭐⭐' : tier >= 4 ? '⭐⭐' : '⭐'} Skill Shot
        </div>

        {/* Pulsing animation ring */}
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            border: `2px solid ${getColor()}40`,
            animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
      </div>
    </div>
  );
}
