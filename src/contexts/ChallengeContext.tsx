'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuthContext } from './WalletContext';

export interface ChallengeConfig {
  forceShield: boolean;
  forceSpeed: boolean;
  damageMultiplier: number;
  hpMultiplier: number;
  dotIntensity: number;        // 1.0, 1.5, 2.0, 3.0, 5.0
  corruptionRate: number;       // 0, 0.25, 0.5, 0.75, 1.0 (force corruption + 20% enrage)
  escapeTimerSpeed: number;     // 1.0, 1.5, 2.0, 3.0, 4.0 (divides 30s timer, minimum 10s)
  buffStrength: number;         // 1.0, 1.5, 2.0, 3.0, 5.0 (multiplies shield HP)
  bossAttackSpeed: number;      // 1.0, 0.75, 0.5, 0.33, 0.25 (multiplies cooldown)
  bossSpawnRate: number;        // 1.0, 5.0 (5x boss spawns, -4 loot cards, +10% boss HP/DMG)
  skillshotCircles: number;     // 0, +1, +2, +3, +4 (extra circles added to skillshots)
  skillshotSpeed: number;       // 1.0, 0.9, 0.8, 0.7, 0.6 (multiplies circleDuration)
}

interface ChallengeContextType {
  challengeConfig: ChallengeConfig;
  loading: boolean;
  refreshChallengeConfig: () => Promise<void>;
  updateChallengeConfig: (config: ChallengeConfig) => Promise<void>;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

const DEFAULT_CONFIG: ChallengeConfig = {
  forceShield: false,
  forceSpeed: false,
  damageMultiplier: 1.0,
  hpMultiplier: 1.0,
  dotIntensity: 1.0,
  corruptionRate: 0,
  escapeTimerSpeed: 1.0,
  buffStrength: 1.0,
  bossAttackSpeed: 1.0,
  bossSpawnRate: 1.0,
  skillshotCircles: 0,
  skillshotSpeed: 1.0
};

export function ChallengeProvider({ children }: { children: ReactNode }) {
  const [challengeConfig, setChallengeConfig] = useState<ChallengeConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuthContext();

  const refreshChallengeConfig = useCallback(async () => {
    if (isAuthenticated !== true) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/challenge/get');
      if (response.ok) {
        const data = await response.json();
        if (data.config) {
          setChallengeConfig(data.config);
        }
      }
    } catch (error) {
      console.error('Error fetching challenge config:', error);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const updateChallengeConfig = useCallback(async (config: ChallengeConfig) => {
    if (isAuthenticated !== true) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch('/api/challenge/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      if (response.ok) {
        setChallengeConfig(config);
      } else {
        throw new Error('Failed to update challenge config');
      }
    } catch (error) {
      console.error('Error updating challenge config:', error);
      throw error;
    }
  }, [isAuthenticated]);

  // Fetch challenge config on mount
  useEffect(() => {
    if (isAuthenticated === true) {
      refreshChallengeConfig();
      return;
    }

    if (isAuthenticated === false) {
      setChallengeConfig(DEFAULT_CONFIG);
      setLoading(false);
    }
  }, [isAuthenticated, refreshChallengeConfig]);

  return (
    <ChallengeContext.Provider
      value={{
        challengeConfig,
        loading,
        refreshChallengeConfig,
        updateChallengeConfig
      }}
    >
      {children}
    </ChallengeContext.Provider>
  );
}

export function useChallenge() {
  const context = useContext(ChallengeContext);
  if (context === undefined) {
    throw new Error('useChallenge must be used within a ChallengeProvider');
  }
  return context;
}
