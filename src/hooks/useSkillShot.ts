import { useState, useEffect, useRef, useCallback } from 'react';

export type SkillShotMode = 'simple' | 'chain';

interface SkillShotConfig {
  enabled: boolean; // Is skillshot system enabled?
  mode?: SkillShotMode; // 'simple' = single circle, 'chain' = multiple circles
  randomTriggerChance?: number; // Chance to trigger on each monster attack (0-1)
  cooldown?: number; // Cooldown between skillshots (ms)
  circleCount?: number; // How many circles per skillshot (chain mode only)
  circleDuration?: number; // Time limit per circle sequence (ms)
  isBoss?: boolean; // Is current monster a boss?
}

interface SkillShotState {
  isActive: boolean;
  isOnCooldown: boolean;
  cooldownRemaining: number; // ms
  lastTriggerTime: number;
}

interface UseSkillShotResult {
  // State
  isActive: boolean;
  isOnCooldown: boolean;
  cooldownRemaining: number;
  mode: SkillShotMode;

  // Config
  circleCount: number;
  circleDuration: number;

  // Methods
  triggerSkillShot: (forceMode?: SkillShotMode) => boolean; // Manually trigger with optional mode override
  checkRandomTrigger: () => void; // Check for random trigger on monster attack
  handleSuccess: () => void;
  handleFailure: () => void;
  handleMiss: () => void; // For simple mode (no penalty)
  handleComplete: () => void;

  // Refs for callbacks (prevent re-renders)
  onSuccessRef: React.MutableRefObject<(() => void) | null>;
  onFailureRef: React.MutableRefObject<(() => void) | null>;
  onMissRef: React.MutableRefObject<(() => void) | null>;
}

// Simple mode: Low risk, low reward (single circle)
const SIMPLE_COOLDOWN = 10000; // 10 seconds
const SIMPLE_DURATION = 2000; // 2 seconds to click
const SIMPLE_CHANCE = 0.20; // 20% trigger chance

// Chain mode: High risk, high reward (multiple circles)
const CHAIN_COOLDOWN = 20000; // 20 seconds
const CHAIN_CIRCLE_COUNT = 3; // 3 circles
const CHAIN_DURATION = 3000; // 3 seconds total
const CHAIN_CHANCE = 0.10; // 10% trigger chance

export function useSkillShot(config: SkillShotConfig): UseSkillShotResult {
  const {
    enabled,
    mode = 'simple', // Default to simple mode
    randomTriggerChance,
    cooldown,
    circleCount,
    circleDuration,
    isBoss = false
  } = config;

  // Use mode-specific defaults
  const actualTriggerChance = randomTriggerChance ?? (mode === 'simple' ? SIMPLE_CHANCE : CHAIN_CHANCE);
  const actualCooldown = cooldown ?? (mode === 'simple' ? SIMPLE_COOLDOWN : CHAIN_COOLDOWN);
  const actualCircleCount = circleCount ?? (mode === 'simple' ? 1 : CHAIN_CIRCLE_COUNT);
  const actualDuration = circleDuration ?? (mode === 'simple' ? SIMPLE_DURATION : CHAIN_DURATION);

  const [state, setState] = useState<SkillShotState>({
    isActive: false,
    isOnCooldown: false,
    cooldownRemaining: 0,
    lastTriggerTime: 0
  });

  const [activeMode, setActiveMode] = useState<SkillShotMode>(mode);

  // Refs for callbacks
  const onSuccessRef = useRef<(() => void) | null>(null);
  const onFailureRef = useRef<(() => void) | null>(null);
  const onMissRef = useRef<(() => void) | null>(null);


  // Update cooldown timer
  useEffect(() => {
    if (!state.isOnCooldown) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - state.lastTriggerTime;
      const remaining = Math.max(0, actualCooldown - elapsed);

      if (remaining <= 0) {
        setState(prev => ({ ...prev, isOnCooldown: false, cooldownRemaining: 0 }));
      } else {
        setState(prev => ({ ...prev, cooldownRemaining: remaining }));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [state.isOnCooldown, state.lastTriggerTime, actualCooldown]);

  // Trigger skillshot manually or randomly
  const triggerSkillShot = useCallback((forceMode?: SkillShotMode) => {
    if (!enabled) return false;
    if (state.isOnCooldown) return false;
    if (state.isActive) return false;

    const triggerMode = forceMode || mode;
    const triggerCooldown = triggerMode === 'simple' ? SIMPLE_COOLDOWN : CHAIN_COOLDOWN;

    setActiveMode(triggerMode);
    setState(prev => ({
      ...prev,
      isActive: true,
      isOnCooldown: true,
      lastTriggerTime: Date.now(),
      cooldownRemaining: triggerCooldown
    }));

    return true;
  }, [enabled, state.isOnCooldown, state.isActive, mode]);

  // Handle skillshot success
  const handleSuccess = useCallback(() => {
    if (onSuccessRef.current) {
      onSuccessRef.current();
    }
  }, []);

  // Handle skillshot failure (chain mode - has penalty)
  const handleFailure = useCallback(() => {
    if (onFailureRef.current) {
      onFailureRef.current();
    }
  }, []);

  // Handle skillshot miss (simple mode - no penalty)
  const handleMiss = useCallback(() => {
    if (onMissRef.current) {
      onMissRef.current();
    }
  }, []);

  // Handle skillshot complete (cleanup)
  const handleComplete = useCallback(() => {
    setState(prev => ({
      ...prev,
      isActive: false
    }));
  }, []);

  // Random trigger on monster attack (for non-bosses)
  // This method can be called from monster attack hook
  const checkRandomTrigger = useCallback(() => {
    if (!enabled) return;
    if (isBoss) return; // Bosses use manual triggers
    if (state.isOnCooldown) return;
    if (state.isActive) return;

    const roll = Math.random();
    if (roll < actualTriggerChance) {
      triggerSkillShot();
    }
  }, [enabled, isBoss, state.isOnCooldown, state.isActive, actualTriggerChance, triggerSkillShot]);

  // Calculate values based on ACTIVE mode (not initial mode)
  const activeCircleCount = circleCount ?? (activeMode === 'simple' ? 1 : CHAIN_CIRCLE_COUNT);
  const activeDuration = circleDuration ?? (activeMode === 'simple' ? SIMPLE_DURATION : CHAIN_DURATION);

  return {
    isActive: state.isActive,
    isOnCooldown: state.isOnCooldown,
    cooldownRemaining: state.cooldownRemaining,
    mode: activeMode,
    circleCount: activeCircleCount, // Use activeMode-based value
    circleDuration: activeDuration, // Use activeMode-based value
    triggerSkillShot,
    checkRandomTrigger, // Export for calling on monster attacks
    handleSuccess,
    handleFailure,
    handleMiss,
    handleComplete,
    onSuccessRef,
    onFailureRef,
    onMissRef
  };
}
