'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { BiomeId, Tier } from '@/lib/biome-config';

interface BiomeContextType {
  selectedBiome: BiomeId | null;
  selectedTier: Tier | null;
  setSelectedBiome: (biome: BiomeId) => void;
  setSelectedTier: (tier: Tier) => void;
  setBiomeTier: (biome: BiomeId, tier: Tier) => void;
  clearSelection: () => void;
}

const BiomeContext = createContext<BiomeContextType | undefined>(undefined);

const STORAGE_KEY = 'selectedBiomeTier';

export function BiomeProvider({ children }: { children: ReactNode }) {
  const [selectedBiome, setSelectedBiomeState] = useState<BiomeId | null>(null);
  const [selectedTier, setSelectedTierState] = useState<Tier | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.biome && parsed.tier) {
          setSelectedBiomeState(parsed.biome);
          setSelectedTierState(parsed.tier);
        }
      }
    } catch (error) {
      console.error('Failed to load biome selection from localStorage:', error);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage whenever selection changes
  useEffect(() => {
    if (!isHydrated) return; // Don't save during initial hydration

    if (selectedBiome && selectedTier) {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ biome: selectedBiome, tier: selectedTier })
        );
      } catch (error) {
        console.error('Failed to save biome selection to localStorage:', error);
      }
    }
  }, [selectedBiome, selectedTier, isHydrated]);

  const setSelectedBiome = (biome: BiomeId) => {
    setSelectedBiomeState(biome);
  };

  const setSelectedTier = (tier: Tier) => {
    setSelectedTierState(tier);
  };

  const setBiomeTier = (biome: BiomeId, tier: Tier) => {
    setSelectedBiomeState(biome);
    setSelectedTierState(tier);
  };

  const clearSelection = () => {
    setSelectedBiomeState(null);
    setSelectedTierState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear biome selection from localStorage:', error);
    }
  };

  return (
    <BiomeContext.Provider
      value={{
        selectedBiome,
        selectedTier,
        setSelectedBiome,
        setSelectedTier,
        setBiomeTier,
        clearSelection,
      }}
    >
      {children}
    </BiomeContext.Provider>
  );
}

export function useBiome() {
  const context = useContext(BiomeContext);
  if (context === undefined) {
    throw new Error('useBiome must be used within a BiomeProvider');
  }
  return context;
}
