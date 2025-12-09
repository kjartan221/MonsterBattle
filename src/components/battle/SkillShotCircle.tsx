'use client';

import { useState, useEffect } from 'react';

interface SkillShotCircleProps {
  id: string;
  x: number; // Position as percentage (0-100)
  y: number; // Position as percentage (0-100)
  order: number; // Which number in the sequence (1, 2, 3, etc.)
  isActive: boolean; // Is this the current target?
  isCompleted: boolean; // Has this been clicked successfully?
  onClick: (id: string) => void;
  duration: number; // How long the circle stays alive (ms)
}

export default function SkillShotCircle({
  id,
  x,
  y,
  order,
  isActive,
  isCompleted,
  onClick,
  duration
}: SkillShotCircleProps) {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [startTime] = useState(Date.now());

  // Update time left every 50ms for smooth animation
  useEffect(() => {
    if (isCompleted) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [startTime, duration, isCompleted]);

  const progress = timeLeft / duration;

  const handleClick = () => {
    if (!isCompleted) {
      onClick(id);
    }
  };

  // Circle size and colors
  const innerSize = 60; // px
  const outerSize = 120; // px (must be larger than inner to be visible outside)
  const numberSize = 28; // px

  // Color based on state
  const getColor = () => {
    if (isCompleted) return 'rgb(34, 197, 94)'; // Green
    if (isActive) return 'rgb(59, 130, 246)'; // Blue
    return 'rgb(156, 163, 175)'; // Gray
  };

  const color = getColor();

  return (
    <div
      className="absolute transition-all duration-200"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)',
        pointerEvents: isCompleted ? 'none' : 'auto',
        cursor: isCompleted ? 'default' : 'pointer',
        opacity: isCompleted ? 0.5 : (isActive ? 1 : 0.7) // Dim inactive circles slightly
      }}
      onClick={handleClick}
    >
      {/* Outer circle (shrinking timer) */}
      <div
        className="absolute"
        style={{
          width: outerSize,
          height: outerSize,
          borderRadius: '50%',
          border: `5px solid ${color}`, // Thicker border for better visibility
          opacity: isCompleted ? 0.3 : 0.8,
          transform: `translate(-50%, -50%) scale(${isCompleted ? 0.5 : progress})`,
          transition: isCompleted ? 'all 0.3s ease-out' : 'none',
          boxShadow: isActive ? `0 0 20px ${color}` : 'none'
        }}
      />

      {/* Inner circle (clickable area) */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: '50%',
          backgroundColor: color,
          transform: 'translate(-50%, -50%)',
          opacity: isCompleted ? 0.5 : 0.9,
          boxShadow: isActive ? `0 0 15px ${color}` : 'none'
        }}
      >
        {/* Order number */}
        <span
          className="font-bold text-white select-none"
          style={{ fontSize: numberSize }}
        >
          {order}
        </span>
      </div>

      {/* Success checkmark */}
      {isCompleted && (
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: innerSize,
            height: innerSize,
            transform: 'translate(-50%, -50%)',
            fontSize: 32,
            animation: 'pulse 0.3s ease-out'
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}
