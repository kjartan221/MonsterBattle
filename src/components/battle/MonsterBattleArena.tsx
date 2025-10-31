'use client';

import { useState, useEffect, useRef } from 'react';
import type { MonsterFrontend } from '@/lib/types';

// ============================================================
// CONFIGURABLE CONSTANTS (Easy to change for future iterations)
// ============================================================
const GRID_SIZE = 5; // 5x5 grid (25 positions) - easy to change to 3, 4, 6, etc.
const ARENA_WIDTH = 500; // px
const ARENA_HEIGHT = 400; // px
const MONSTER_ICON_SIZE = 80; // px - size of the emoji icon
const HITBOX_RADIUS = 60; // px - radius from center for hit detection (independent of grid spacing)

interface GridPosition {
  x: number; // Center x coordinate
  y: number; // Center y coordinate
}

interface MonsterBattleArenaProps {
  monster: MonsterFrontend;
  isAttacking: boolean;
  isDefeated: boolean;
  isInvulnerable?: boolean;
  onAttack: () => void;
  onMiss?: (x: number, y: number) => void; // Optional miss feedback
  critTrigger?: number;
}

interface CritBadge {
  id: number;
  x: number;
  y: number;
}

/**
 * Generate grid positions for monster teleportation
 * Returns array of {x, y} coordinates (center points)
 */
function generateGridPositions(gridSize: number, width: number, height: number): GridPosition[] {
  const positions: GridPosition[] = [];
  const padding = MONSTER_ICON_SIZE / 2 + 20; // Keep monster away from edges
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const cellWidth = usableWidth / (gridSize - 1);
  const cellHeight = usableHeight / (gridSize - 1);

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      positions.push({
        x: padding + col * cellWidth,
        y: padding + row * cellHeight
      });
    }
  }

  return positions;
}

/**
 * Check if click is within hitbox radius from monster center
 */
function isHitDetected(
  clickX: number,
  clickY: number,
  monsterX: number,
  monsterY: number,
  radius: number
): boolean {
  const dx = clickX - monsterX;
  const dy = clickY - monsterY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= radius;
}

/**
 * Moving monster battle arena with 5x5 grid position system
 * Monster teleports between positions based on moveInterval
 * Player must click the moving hitbox to deal damage
 */
export default function MonsterBattleArena({
  monster,
  isAttacking,
  isDefeated,
  isInvulnerable = false,
  onAttack,
  onMiss,
  critTrigger = 0
}: MonsterBattleArenaProps) {
  const arenaRef = useRef<HTMLDivElement>(null);
  const moveIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate grid positions once
  const gridPositions = useRef(generateGridPositions(GRID_SIZE, ARENA_WIDTH, ARENA_HEIGHT)).current;

  // Monster position state (starts at center)
  const centerIndex = Math.floor(gridPositions.length / 2);
  const [monsterPosition, setMonsterPosition] = useState<GridPosition>(gridPositions[centerIndex]);
  const [isAnimating, setIsAnimating] = useState(false); // Brief flash on teleport
  const [critBadges, setCritBadges] = useState<CritBadge[]>([]);

  // Movement loop: teleport monster to random position at intervals
  useEffect(() => {
    if (isDefeated || isInvulnerable) return;

    // Start movement loop based on monster's moveInterval
    const interval = monster.moveInterval || 1500; // Default to 1.5s if missing

    moveIntervalRef.current = setInterval(() => {
      // Get random position (different from current)
      const currentIndex = gridPositions.findIndex(
        p => p.x === monsterPosition.x && p.y === monsterPosition.y
      );

      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * gridPositions.length);
      } while (newIndex === currentIndex && gridPositions.length > 1);

      const newPosition = gridPositions[newIndex];
      setMonsterPosition(newPosition);

      // Brief flash animation on teleport
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 200);
    }, interval);

    return () => {
      if (moveIntervalRef.current) {
        clearInterval(moveIntervalRef.current);
      }
    };
  }, [monster.moveInterval, isDefeated, isInvulnerable, gridPositions, monsterPosition]);

  // Handle critical hit badges
  useEffect(() => {
    if (critTrigger === 0) return;

    const badgeId = Date.now();
    const newBadge: CritBadge = {
      id: badgeId,
      x: monsterPosition.x + (Math.random() - 0.5) * 60, // Spawn near monster
      y: monsterPosition.y - 50 - Math.random() * 20 // Above monster
    };

    setCritBadges(prev => [...prev, newBadge]);

    const timer = setTimeout(() => {
      setCritBadges(prev => prev.filter(badge => badge.id !== badgeId));
    }, 1000);

    return () => clearTimeout(timer);
  }, [critTrigger, monsterPosition]);

  // Optional: Handle miss feedback (click outside hitbox)
  const handleArenaClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDefeated || isInvulnerable) return;

    // Only fire miss callback if user clicks outside hitbox
    if (onMiss) {
      const rect = arenaRef.current?.getBoundingClientRect();
      if (!rect) return;

      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      // Check if click missed the monster
      const hit = isHitDetected(clickX, clickY, monsterPosition.x, monsterPosition.y, HITBOX_RADIUS);

      if (!hit) {
        onMiss(clickX, clickY);
      }
    }
  };

  // Rarity colors
  const rarityColors = {
    common: 'from-gray-500 to-gray-600',
    rare: 'from-blue-500 to-blue-600',
    epic: 'from-purple-500 to-purple-600',
    legendary: 'from-yellow-500 to-orange-600'
  };

  const rarityBorderColors = {
    common: 'border-gray-400',
    rare: 'border-blue-400',
    epic: 'border-purple-400',
    legendary: 'border-yellow-400'
  };

  return (
    <div
      ref={arenaRef}
      onClick={handleArenaClick}
      className={`relative bg-gradient-to-br ${rarityColors[monster.rarity]} rounded-2xl shadow-2xl border-4 ${rarityBorderColors[monster.rarity]} overflow-hidden transition-all duration-150 select-none ${
        isDefeated
          ? 'opacity-50 cursor-not-allowed'
          : isInvulnerable
          ? 'border-cyan-400 shadow-cyan-500/50 shadow-2xl animate-pulse cursor-not-allowed'
          : 'hover:border-white/60'
      } ${isAttacking ? 'animate-pulse border-red-500 shadow-red-500/50 shadow-2xl' : ''}`}
      style={{
        width: `${ARENA_WIDTH}px`,
        height: `${ARENA_HEIGHT}px`,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        msUserSelect: 'none'
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent default drag/select behavior
    >
      {/* Background grid visualization (optional, for debugging) */}
      {/* Uncomment to see grid positions:
      {gridPositions.map((pos, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-white/30 rounded-full"
          style={{
            left: `${pos.x - 4}px`,
            top: `${pos.y - 4}px`
          }}
        />
      ))}
      */}

      {/* Monster Hitbox - Invisible clickable area with cursor-pointer */}
      {!isDefeated && !isInvulnerable && (
        <div
          onClick={onAttack}
          className="absolute rounded-full cursor-pointer z-10"
          style={{
            left: `${monsterPosition.x - HITBOX_RADIUS}px`,
            top: `${monsterPosition.y - HITBOX_RADIUS}px`,
            width: `${HITBOX_RADIUS * 2}px`,
            height: `${HITBOX_RADIUS * 2}px`
          }}
          title="Click to attack!"
        />
      )}

      {/* Monster Icon - Absolutely positioned at grid position (visual only) */}
      {!isDefeated && (
        <div
          className={`absolute transition-opacity duration-200 pointer-events-none ${
            isAnimating ? 'opacity-50' : 'opacity-100'
          } ${isAttacking ? 'scale-110' : ''}`}
          style={{
            left: `${monsterPosition.x - MONSTER_ICON_SIZE / 2}px`,
            top: `${monsterPosition.y - MONSTER_ICON_SIZE / 2}px`,
            width: `${MONSTER_ICON_SIZE}px`,
            height: `${MONSTER_ICON_SIZE}px`,
            transform: `scale(${isAttacking ? 1.1 : 1})`,
            transition: 'transform 0.15s'
          }}
        >
          <div className="text-8xl leading-none flex items-center justify-center select-none">
            {monster.imageUrl}
          </div>
        </div>
      )}

      {/* Defeated State */}
      {isDefeated && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-white text-4xl font-bold">DEFEATED!</p>
        </div>
      )}

      {/* Invulnerable Indicator */}
      {isInvulnerable && !isDefeated && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-cyan-500/80 px-4 py-2 rounded-full">
          <p className="text-white text-lg font-bold">🛡️ INVULNERABLE!</p>
        </div>
      )}

      {/* Critical Hit Badges */}
      {critBadges.map(badge => (
        <div
          key={badge.id}
          className="absolute pointer-events-none animate-crit-float z-50"
          style={{
            left: `${badge.x}px`,
            top: `${badge.y}px`,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 text-white font-bold text-sm px-3 py-1 rounded-full shadow-xl border-2 border-yellow-300">
            💥 CRIT!
          </div>
        </div>
      ))}
    </div>
  );
}
