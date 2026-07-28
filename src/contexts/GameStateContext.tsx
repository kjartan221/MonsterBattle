'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { LootItem } from '@/lib/loot-table';
import type { MonsterFrontend, BattleSessionFrontend } from '@/lib/types';

/**
 * Game State Management
 *
 * Centralized state machine to manage battle flow and prevent race conditions.
 * Stores all battle-related data as single source of truth.
 */

export enum GameState {
  INITIALIZING = 'INITIALIZING',           // Initial app load, fetching player data
  BATTLE_LOADING = 'BATTLE_LOADING',       // Loading/creating battle session
  BATTLE_START_SCREEN = 'BATTLE_START_SCREEN', // Showing "Start Battle" button
  BATTLE_IN_PROGRESS = 'BATTLE_IN_PROGRESS',   // Active battle (player clicking)
  BATTLE_COMPLETING = 'BATTLE_COMPLETING',     // Submitting battle results
  LOOT_SELECTION = 'LOOT_SELECTION',       // Showing loot selection modal
  BATTLE_VICTORY = 'BATTLE_VICTORY',       // Loot claimed, showing victory/rest screen
  NEXT_MONSTER_READY = 'NEXT_MONSTER_READY', // Ready to start next battle (shows button)
  PLAYER_DEFEATED = 'PLAYER_DEFEATED',     // Player died, showing defeat screen
}

interface GameStateContextType {
  gameState: GameState;
  monster: MonsterFrontend | null;         // Current monster
  session: BattleSessionFrontend | null;   // Current battle session
  lootOptions: LootItem[] | null;          // Loot available in LOOT_SELECTION state

  // State transitions
  setInitializing: () => void;
  setBattleLoading: () => void;
  setBattleStartScreen: (session: BattleSessionFrontend) => void;
  setBattleInProgress: (session?: BattleSessionFrontend) => void;
  setBattleCompleting: () => void;
  setLootSelection: (loot: LootItem[]) => void; // Pass loot when transitioning
  setBattleVictory: () => void;                  // Rest phase after loot claimed
  setNextMonsterReady: () => void;
  setPlayerDefeated: () => void;
  updateSession: (session: BattleSessionFrontend) => void; // Update session without changing state

  // State queries (helper methods)
  isLoading: () => boolean;
  canStartBattle: () => boolean;
  canAttackMonster: () => boolean;
  canShowLootModal: () => boolean;
  canShowNextMonsterButton: () => boolean;
  canShowDefeatScreen: () => boolean;
}

const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateProvider({ children }: { children: ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(GameState.INITIALIZING);
  const [session, setSession] = useState<BattleSessionFrontend | null>(null);
  const [lootOptions, setLootOptionsState] = useState<LootItem[] | null>(null);

  const monster = session?.monster || null;

  // State transition functions
  const setInitializing = () => {
    setGameState(GameState.INITIALIZING);
    setSession(null);
    setLootOptionsState(null);
  };

  const setBattleLoading = () => {
    setGameState(GameState.BATTLE_LOADING);
    // Keep monster/session from previous state during loading
    setLootOptionsState(null);
  };

  const setBattleStartScreen = (newSession: BattleSessionFrontend) => {
    setSession(newSession);
    setGameState(GameState.BATTLE_START_SCREEN);
    setLootOptionsState(null);
  };

  const setBattleInProgress = (newSession?: BattleSessionFrontend) => {
    if (newSession) {
      setSession(newSession);
    } else {
    }
    setGameState(GameState.BATTLE_IN_PROGRESS);
    setLootOptionsState(null);
  };

  const setBattleCompleting = () => {
    // Keep monster/session during completion
    setGameState(GameState.BATTLE_COMPLETING);
    setLootOptionsState(null);
  };

  const setLootSelection = (loot: LootItem[]) => {
    // Keep monster/session during loot selection
    setLootOptionsState(loot);
    setGameState(GameState.LOOT_SELECTION);
  };

  const setBattleVictory = () => {
    // Keep monster/session during victory phase
    setLootOptionsState(null); // Clear loot options
    setGameState(GameState.BATTLE_VICTORY);
  };

  const setNextMonsterReady = () => {
    // Keep monster/session until next battle loads
    setLootOptionsState(null);
    setGameState(GameState.NEXT_MONSTER_READY);
  };

  const setPlayerDefeated = () => {
    // Keep monster/session to show which monster defeated player
    setLootOptionsState(null);
    setGameState(GameState.PLAYER_DEFEATED);
  };

  const updateSession = (newSession: BattleSessionFrontend) => {
    setSession(newSession);
  };

  // State query helpers
  const isLoading = () => {
    return gameState === GameState.INITIALIZING || gameState === GameState.BATTLE_LOADING;
  };

  const canStartBattle = () => {
    // Can only start a new battle if:
    // - Not in any battle-related state
    // - Not showing loot/defeat screens
    return gameState === GameState.INITIALIZING;
  };

  const canAttackMonster = () => {
    // Can only attack if battle is in progress
    return gameState === GameState.BATTLE_IN_PROGRESS;
  };

  const canShowLootModal = () => {
    return gameState === GameState.LOOT_SELECTION;
  };

  const canShowNextMonsterButton = () => {
    return gameState === GameState.BATTLE_VICTORY || gameState === GameState.NEXT_MONSTER_READY;
  };

  const canShowDefeatScreen = () => {
    return gameState === GameState.PLAYER_DEFEATED;
  };

  const value: GameStateContextType = {
    gameState,
    monster,
    session,
    lootOptions,
    setInitializing,
    setBattleLoading,
    setBattleStartScreen,
    setBattleInProgress,
    setBattleCompleting,
    setLootSelection,
    setBattleVictory,
    setNextMonsterReady,
    setPlayerDefeated,
    updateSession,
    isLoading,
    canStartBattle,
    canAttackMonster,
    canShowLootModal,
    canShowNextMonsterButton,
    canShowDefeatScreen,
  };

  return (
    <GameStateContext.Provider value={value}>
      {children}
    </GameStateContext.Provider>
  );
}

export function useGameState() {
  const context = useContext(GameStateContext);
  if (context === undefined) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}
