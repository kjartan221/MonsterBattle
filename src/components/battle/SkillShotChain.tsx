'use client';

import { useState, useEffect, useRef } from 'react';
import SkillShotCircle from './SkillShotCircle';

interface Circle {
  id: string;
  x: number;
  y: number;
  order: number;
  isCompleted: boolean;
}

interface SkillShotChainProps {
  isActive: boolean;
  circleCount: number; // How many circles to spawn
  duration: number; // Time limit per circle (ms)
  onSuccess: () => void;
  onFailure: () => void;
  onComplete: () => void; // Called after success/failure animation
}

export default function SkillShotChain({
  isActive,
  circleCount,
  duration,
  onSuccess,
  onFailure,
  onComplete
}: SkillShotChainProps) {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [result, setResult] = useState<'success' | 'failure' | null>(null);

  // Refs for callbacks to prevent re-renders
  const onSuccessRef = useRef(onSuccess);
  const onFailureRef = useRef(onFailure);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onFailureRef.current = onFailure;
    onCompleteRef.current = onComplete;
  }, [onSuccess, onFailure, onComplete]);

  // Generate random positions for circles (avoid edges and overlaps)
  const generateCirclePositions = (count: number): Circle[] => {
    const positions: Circle[] = [];
    const minDistance = 25; // Minimum distance between circles (%) - increased from 15

    for (let i = 0; i < count; i++) {
      let x: number, y: number;
      let attempts = 0;
      const maxAttempts = 100; // Increased attempts for better placement

      do {
        // Generate position with safe margins (15% from edges, was 10%)
        x = 20 + Math.random() * 60; // 20-80%
        y = 20 + Math.random() * 60; // 20-80%
        attempts++;

        // Check if position is far enough from existing circles
        const tooClose = positions.some(circle => {
          const dist = Math.sqrt(Math.pow(circle.x - x, 2) + Math.pow(circle.y - y, 2));
          return dist < minDistance;
        });

        if (!tooClose || attempts >= maxAttempts) break;
      } while (true);

      positions.push({
        id: `circle-${i}`,
        x,
        y,
        order: i + 1,
        isCompleted: false
      });
    }

    return positions;
  };

  // Initialize circles when skillshot becomes active
  useEffect(() => {
    if (isActive) {
      // Reset and initialize on every activation
      const newCircles = generateCirclePositions(circleCount);
      setCircles(newCircles);
      setCurrentIndex(0);
      setIsFinished(false);
      setResult(null);
    } else {
      // Clear state when deactivated
      setCircles([]);
      setCurrentIndex(0);
      setIsFinished(false);
      setResult(null);
    }
  }, [isActive, circleCount]);

  // Timeout for each circle
  useEffect(() => {
    if (!isActive || isFinished || circles.length === 0) return;

    const timeout = setTimeout(() => {
      // Time ran out - failure
      setIsFinished(true);
      setResult('failure');
      onFailureRef.current();

      // Clear overlay after animation (fast)
      setTimeout(() => {
        onCompleteRef.current();
      }, 500);
    }, duration);

    return () => clearTimeout(timeout);
  }, [isActive, isFinished, circles.length, duration, currentIndex]);

  // Handle circle click
  const handleCircleClick = (id: string) => {
    if (isFinished) return;

    const clickedCircle = circles.find(c => c.id === id);
    if (!clickedCircle) return;

    // Check if it's the correct circle (in order)
    if (clickedCircle.order !== currentIndex + 1) {
      // Wrong order - failure
      setIsFinished(true);
      setResult('failure');
      onFailureRef.current();

      // Clear overlay after animation (fast)
      setTimeout(() => {
        onCompleteRef.current();
      }, 500);
      return;
    }

    // Correct circle clicked
    const updatedCircles = circles.map(c =>
      c.id === id ? { ...c, isCompleted: true } : c
    );
    setCircles(updatedCircles);

    // Check if all circles are completed
    if (currentIndex + 1 >= circles.length) {
      // All circles completed - success!
      setIsFinished(true);
      setResult('success');
      onSuccessRef.current();

      // Clear overlay after animation (fast)
      setTimeout(() => {
        onCompleteRef.current();
      }, 500);
    } else {
      // Move to next circle
      setCurrentIndex(prev => prev + 1);
    }
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-0 z-50 pointer-events-auto">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Circles */}
      <div className="relative w-full h-full">
        {circles.map((circle, index) => (
          <SkillShotCircle
            key={circle.id}
            id={circle.id}
            x={circle.x}
            y={circle.y}
            order={circle.order}
            isActive={index === currentIndex}
            isCompleted={circle.isCompleted}
            onClick={handleCircleClick}
            duration={duration}
          />
        ))}
      </div>

      {/* Result notification */}
      {result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`text-6xl font-bold animate-pulse ${
              result === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
            style={{
              textShadow: result === 'success'
                ? '0 0 20px rgba(34, 197, 94, 0.8)'
                : '0 0 20px rgba(239, 68, 68, 0.8)'
            }}
          >
            {result === 'success' ? '✓ PERFECT!' : '✗ FAILED!'}
          </div>
        </div>
      )}

      {/* Instructions (only show at start) */}
      {!isFinished && currentIndex === 0 && (
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-white text-xl font-bold text-center pointer-events-none">
          <div className="bg-black/60 px-6 py-3 rounded-lg backdrop-blur-sm">
            Click the circles in order!
          </div>
        </div>
      )}
    </div>
  );
}
