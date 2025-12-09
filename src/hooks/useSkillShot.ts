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

  // Log initial configuration (only on mount)
  useEffect(() => {
    console.log('========================================');
    console.log('[SkillShot] Hook initialized with config:');
    console.log(`  - enabled: ${enabled}`);
    console.log(`  - mode: ${mode}`);
    console.log(`  - isBoss: ${isBoss}`);
    console.log(`  - triggerChance: ${actualTriggerChance} (${(actualTriggerChance * 100).toFixed(1)}%)`);
    console.log(`  - cooldown: ${actualCooldown}ms`);
    console.log(`  - circleCount: ${actualCircleCount}`);
    console.log(`  - duration: ${actualDuration}ms`);
    console.log('========================================');
  }, []); // Empty deps = run once on mount

  // Log when isActive changes (overlay should appear/disappear)
  useEffect(() => {
    if (state.isActive) {
      console.log(`🎯 [SkillShot] isActive = TRUE! Overlay should now be VISIBLE`);
      console.log(`🎯 [SkillShot] Current activeMode state: ${activeMode}`);
      console.log(`🎯 [SkillShot] Component should render: ${activeMode === 'simple' ? 'SkillShotSingle' : 'SkillShotChain'}`);
    } else {
      console.log(`🎯 [SkillShot] isActive = FALSE. Overlay should be HIDDEN`);
    }
  }, [state.isActive, activeMode]);

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
    console.log(`[SkillShot] triggerSkillShot called (forceMode: ${forceMode || 'none'})`);
    console.log(`[SkillShot] Pre-trigger checks - enabled: ${enabled}, onCooldown: ${state.isOnCooldown}, isActive: ${state.isActive}`);

    if (!enabled) {
      console.log('[SkillShot] ❌ triggerSkillShot blocked: not enabled');
      return false;
    }
    if (state.isOnCooldown) {
      console.log('[SkillShot] ❌ triggerSkillShot blocked: on cooldown');
      return false;
    }
    if (state.isActive) {
      console.log('[SkillShot] ❌ triggerSkillShot blocked: already active');
      return false;
    }

    const triggerMode = forceMode || mode;
    const triggerCooldown = triggerMode === 'simple' ? SIMPLE_COOLDOWN : CHAIN_COOLDOWN;

    console.log(`[SkillShot] ✅ Triggering skillshot in ${triggerMode} mode (cooldown: ${triggerCooldown}ms)`);
    console.log(`[SkillShot] Setting activeMode to: ${triggerMode}`);

    setActiveMode(triggerMode);
    setState(prev => ({
      ...prev,
      isActive: true,
      isOnCooldown: true,
      lastTriggerTime: Date.now(),
      cooldownRemaining: triggerCooldown
    }));

    console.log('[SkillShot] State updated - isActive should now be TRUE, activeMode should be:', triggerMode);

    return true;
  }, [enabled, state.isOnCooldown, state.isActive, mode]);

  // Handle skillshot success
  const handleSuccess = useCallback(() => {
    console.log('[SkillShot] SUCCESS!');

    if (onSuccessRef.current) {
      onSuccessRef.current();
    }
  }, []);

  // Handle skillshot failure (chain mode - has penalty)
  const handleFailure = useCallback(() => {
    console.log('[SkillShot] FAILED!');

    if (onFailureRef.current) {
      onFailureRef.current();
    }
  }, []);

  // Handle skillshot miss (simple mode - no penalty)
  const handleMiss = useCallback(() => {
    console.log('[SkillShot] MISSED (no penalty)');

    if (onMissRef.current) {
      onMissRef.current();
    }
  }, []);

  // Handle skillshot complete (cleanup)
  const handleComplete = useCallback(() => {
    console.log('[SkillShot] Completed, clearing overlay');

    setState(prev => ({
      ...prev,
      isActive: false
    }));
  }, []);

  // Random trigger on monster attack (for non-bosses)
  // This method can be called from monster attack hook
  const checkRandomTrigger = useCallback(() => {
    console.log('[SkillShot] checkRandomTrigger called');
    console.log(`[SkillShot] State check - enabled: ${enabled}, isBoss: ${isBoss}, onCooldown: ${state.isOnCooldown}, isActive: ${state.isActive}`);

    if (!enabled) {
      console.log('[SkillShot] ❌ Not enabled, skipping trigger check');
      return;
    }
    if (isBoss) {
      console.log('[SkillShot] ❌ Is boss, skipping trigger check (bosses use manual triggers)');
      return;
    }
    if (state.isOnCooldown) {
      console.log(`[SkillShot] ❌ On cooldown, skipping trigger check (${Math.ceil(state.cooldownRemaining / 1000)}s remaining)`);
      return;
    }
    if (state.isActive) {
      console.log('[SkillShot] ❌ Already active, skipping trigger check');
      return;
    }

    const roll = Math.random();
    console.log(`[SkillShot] 🎲 Rolling for trigger: ${roll.toFixed(4)} (need < ${actualTriggerChance.toFixed(2)} for ${mode} mode)`);

    if (roll < actualTriggerChance) {
      console.log(`[SkillShot] ✅ SUCCESS! Triggering ${mode} skillshot! (roll: ${roll.toFixed(4)} < ${actualTriggerChance.toFixed(2)})`);
      triggerSkillShot();
    } else {
      console.log(`[SkillShot] ❌ Failed roll (${roll.toFixed(4)} >= ${actualTriggerChance.toFixed(2)})`);
    }
  }, [enabled, isBoss, state.isOnCooldown, state.isActive, actualTriggerChance, mode, triggerSkillShot, state.cooldownRemaining]);

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
