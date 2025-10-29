'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * Game State Management
 *
 * Centralized state machine to manage battle flow and prevent race conditions.
 * Replaces scattered boolean flags (loading, lootOptions, showNextMonster, etc.)
 */

export enum GameState {
  INITIALIZING = 'INITIALIZING',           // Initial app load, fetching player data
  BATTLE_LOADING = 'BATTLE_LOADING',       // Loading/creating battle session
  BATTLE_START_SCREEN = 'BATTLE_START_SCREEN', // Showing "Start Battle" button
  BATTLE_IN_PROGRESS = 'BATTLE_IN_PROGRESS',   // Active battle (player clicking)
  BATTLE_COMPLETING = 'BATTLE_COMPLETING',     // Submitting battle results
  LOOT_SELECTION = 'LOOT_SELECTION',       // Showing loot selection modal
  NEXT_MONSTER_READY = 'NEXT_MONSTER_READY', // Loot selected, ready for next battle
  PLAYER_DEFEATED = 'PLAYER_DEFEATED',     // Player died, showing defeat screen
}

interface GameStateContextType {
  gameState: GameState;

  // State transitions
  setInitializing: () => void;
  setBattleLoading: () => void;
  setBattleStartScreen: () => void;
  setBattleInProgress: () => void;
  setBattleCompleting: () => void;
  setLootSelection: () => void;
  setNextMonsterReady: () => void;
  setPlayerDefeated: () => void;

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

  // State transition functions
  const setInitializing = () => {
    console.log('🎮 Game State: INITIALIZING');
    setGameState(GameState.INITIALIZING);
  };

  const setBattleLoading = () => {
    console.log('🎮 Game State: BATTLE_LOADING');
    setGameState(GameState.BATTLE_LOADING);
  };

  const setBattleStartScreen = () => {
    console.log('🎮 Game State: BATTLE_START_SCREEN');
    setGameState(GameState.BATTLE_START_SCREEN);
  };

  const setBattleInProgress = () => {
    console.log('🎮 Game State: BATTLE_IN_PROGRESS');
    setGameState(GameState.BATTLE_IN_PROGRESS);
  };

  const setBattleCompleting = () => {
    console.log('🎮 Game State: BATTLE_COMPLETING');
    setGameState(GameState.BATTLE_COMPLETING);
  };

  const setLootSelection = () => {
    console.log('🎮 Game State: LOOT_SELECTION');
    setGameState(GameState.LOOT_SELECTION);
  };

  const setNextMonsterReady = () => {
    console.log('🎮 Game State: NEXT_MONSTER_READY');
    setGameState(GameState.NEXT_MONSTER_READY);
  };

  const setPlayerDefeated = () => {
    console.log('🎮 Game State: PLAYER_DEFEATED');
    setGameState(GameState.PLAYER_DEFEATED);
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
    return gameState === GameState.NEXT_MONSTER_READY;
  };

  const canShowDefeatScreen = () => {
    return gameState === GameState.PLAYER_DEFEATED;
  };

  const value: GameStateContextType = {
    gameState,
    setInitializing,
    setBattleLoading,
    setBattleStartScreen,
    setBattleInProgress,
    setBattleCompleting,
    setLootSelection,
    setNextMonsterReady,
    setPlayerDefeated,
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
