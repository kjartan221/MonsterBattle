
import { useState, useEffect } from 'react';

interface SkillShotSingleProps {
  isActive: boolean;
  duration: number; // Time limit to click (ms)
  onSuccess: () => void;
  onMiss: () => void; // Called if time runs out (no penalty)
  onComplete: () => void; // Called after animation
}

export default function SkillShotSingle({
  isActive,
  duration,
  onSuccess,
  onMiss,
  onComplete
}: SkillShotSingleProps) {
  const [isClicked, setIsClicked] = useState(false);
  const [result, setResult] = useState<'success' | 'miss' | null>(null);
  const [position, setPosition] = useState({
    x: 20 + Math.random() * 60,
    y: 20 + Math.random() * 60
  });

  // Reset state when isActive changes
  useEffect(() => {
    if (isActive) {
      setIsClicked(false);
      setResult(null);
      setPosition({
        x: 20 + Math.random() * 60,
        y: 20 + Math.random() * 60
      });
    }
  }, [isActive, duration]);

  // Miss when the timer runs out (the ring shrink itself is pure CSS — no per-frame state)
  useEffect(() => {
    if (!isActive || isClicked) return;

    const timeout = setTimeout(() => {
      setResult('miss');
      onMiss();
      setTimeout(() => onComplete(), 300);
    }, duration);

    return () => clearTimeout(timeout);
  }, [isActive, isClicked, duration, onMiss, onComplete]);

  const handleClick = () => {
    if (isClicked || !isActive) return;

    setIsClicked(true);
    setResult('success');
    onSuccess();

    // Clear after animation (fast)
    setTimeout(() => {
      onComplete();
    }, 500);
  };

  if (!isActive) return null;

  const outerSize = 100; // px
  const innerSize = 60; // px

  return (
    <div
      className="absolute inset-0 z-40 pointer-events-auto select-none"
      style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Subtle overlay (less intrusive than chain) */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Single circle */}
      <div
        className="absolute cursor-pointer transition-all duration-200"
        style={{
          left: `${position.x}%`,
          top: `${position.y}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: isClicked ? 'none' : 'auto'
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
            border: '4px solid rgb(251, 191, 36)', // Amber
            opacity: isClicked ? 0.3 : 1,
            transform: `translate(-50%, -50%) scale(${isClicked ? 0.5 : 1})`,
            transition: isClicked ? 'all 0.3s ease-out' : 'none',
            animation: isClicked ? 'none' : `skillshot-ring-shrink ${duration}ms linear forwards`,
            boxShadow: '0 0 20px rgba(251, 191, 36, 0.6)'
          }}
        />

        {/* Inner circle (clickable area) */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            width: innerSize,
            height: innerSize,
            borderRadius: '50%',
            backgroundColor: 'rgb(251, 191, 36)', // Amber
            transform: 'translate(-50%, -50%)',
            opacity: isClicked ? 0.5 : 0.9,
            boxShadow: '0 0 15px rgba(251, 191, 36, 0.8)'
          }}
        >
          {/* Target icon */}
          <span className="text-3xl select-none">🎯</span>
        </div>

        {/* Success checkmark */}
        {result === 'success' && (
          <div
            className="absolute flex items-center justify-center"
            style={{
              width: innerSize,
              height: innerSize,
              transform: 'translate(-50%, -50%)',
              fontSize: 40,
              animation: 'pulse 0.3s ease-out'
            }}
          >
            ✓
          </div>
        )}
      </div>

      {/* Result notification (smaller than chain) */}
      {result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`text-4xl font-bold animate-pulse ${
              result === 'success' ? 'text-amber-400' : 'text-gray-400'
            }`}
            style={{
              textShadow: result === 'success'
                ? '0 0 15px rgba(251, 191, 36, 0.8)'
                : '0 0 10px rgba(156, 163, 175, 0.5)'
            }}
          >
            {result === 'success' ? '✓ HIT!' : '⊗ MISS'}
          </div>
        </div>
      )}

      {/* Quick instruction */}
      {!isClicked && (
        <div className="absolute top-6 left-1/2 transform -translate-x-1/2 text-amber-300 text-base font-semibold text-center pointer-events-none">
          Quick! Click the target!
        </div>
      )}
    </div>
  );
}
