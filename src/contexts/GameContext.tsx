import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';

import { ALL_RECIPES } from '../game/config';
import type { Recipe } from '../game/config';

export type GamePhase = 'TITLE' | 'PREPARATION' | 'RITUAL' | 'BATTLE' | 'RESULT';

export interface SummonedUnit {
    id: string;      // 個体識別用
    type: string;    // 'orc_bone' 等
    attackBonus: number;
    hpBonus: number;
}

interface GameState {
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;
    summonedMonsters: SummonedUnit[];
    addSummonedMonster: (unit: SummonedUnit) => void;
    clearSummonedMonsters: () => void;
    
    unlockedRecipes: string[];
    equippedRecipes: (string | null)[];
    unlockRecipe: (recipeId: string) => void;
    equipRecipe: (slotIndex: number, recipeId: string | null) => void;
    activeRecipes: Recipe[]; // derived from equippedRecipes

    currentDay: number;
    incrementDay: () => void;
    gold: number;
    addGold: (amount: number) => void;
    spendGold: (amount: number) => boolean;
    ownedRelics: string[];
    addRelic: (relicId: string) => void;
    resetGame: () => void;

    // パズルへのフィードバック用
    pendingPuzzlePieces: number[];
    addPendingPuzzlePiece: (color: number) => void;
    consumePendingPuzzlePieces: () => number[];

    // 儀式盤面の永続化 (BlockData[] の 2次元配列)
    ritualGrid: (any | null)[][];
    saveRitualGrid: (grid: (any | null)[][]) => void;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<GamePhase>('TITLE');
    const [summonedMonsters, setSummonedMonsters] = useState<SummonedUnit[]>([]);
    
    // レシピ装備システム (6枠)
    const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>(ALL_RECIPES.map(r => r.id)); // 初期解放
    const [equippedRecipes, setEquippedRecipes] = useState<(string | null)[]>([
        ALL_RECIPES[0]?.id || null, 
        ALL_RECIPES[1]?.id || null, 
        ALL_RECIPES[2]?.id || null,
        null, null, null
    ]);
    const activeRecipes = equippedRecipes
        .map(id => ALL_RECIPES.find(r => r.id === id))
        .filter((r): r is Recipe => r !== undefined);
 
    const [currentDay, setCurrentDay] = useState<number>(1);
    const [gold, setGold] = useState<number>(100);
    const [ownedRelics, setOwnedRelics] = useState<string[]>([]);
    const [ritualGrid, setRitualGrid] = useState<(any | null)[][]>([]);
 
    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);
 
    const addSummonedMonster = React.useCallback((unit: SummonedUnit) => {
        setSummonedMonsters(prev => [unit, ...prev]);
    }, []);

    const clearSummonedMonsters = React.useCallback(() => {
        setSummonedMonsters([]);
    }, []);

    const addPendingPuzzlePiece = React.useCallback((color: number) => {
        setPendingPuzzlePieces(prev => [...prev, color]);
    }, []);

    const consumePendingPuzzlePieces = React.useCallback(() => {
        let current: number[] = [];
        setPendingPuzzlePieces(prev => {
            current = [...prev];
            return [];
        });
        return current;
    }, []);

    const unlockRecipe = React.useCallback((recipeId: string) => {
        setUnlockedRecipes(prev => {
            if (prev.includes(recipeId)) return prev;
            return [...prev, recipeId];
        });
    }, []);

    const equipRecipe = React.useCallback((slotIndex: number, recipeId: string | null) => {
        setEquippedRecipes(prev => {
            const newEquip = [...prev];
            newEquip[slotIndex] = recipeId;
            return newEquip;
        });
    }, []);

    const incrementDay = React.useCallback(() => {
        setCurrentDay(prev => prev + 1);
    }, []);

    const addGold = React.useCallback((amount: number) => {
        setGold(prev => prev + amount);
    }, []);

    const spendGold = React.useCallback((amount: number) => {
        let success = false;
        setGold(prev => {
            if (prev >= amount) {
                success = true;
                return prev - amount;
            }
            return prev;
        });
        return success;
    }, []);

    const addRelic = React.useCallback((relicId: string) => {
        setOwnedRelics(prev => {
            if (prev.includes(relicId)) return prev;
            return [...prev, relicId];
        });
    }, []);

    const saveRitualGrid = React.useCallback((grid: (any | null)[][]) => {
        setRitualGrid(grid);
    }, []);

    const resetGame = React.useCallback(() => {
        setSummonedMonsters([]);
        setEquippedRecipes([
            ALL_RECIPES[0]?.id || null, 
            ALL_RECIPES[1]?.id || null, 
            ALL_RECIPES[2]?.id || null,
            null, null, null
        ]);
        setCurrentDay(1);
        setGold(100);
        setOwnedRelics([]);
        setPendingPuzzlePieces([]);
        setRitualGrid([]);
    }, []);

    return (
        <GameContext.Provider value={{
            phase, setPhase,
            summonedMonsters, addSummonedMonster, clearSummonedMonsters,
            unlockedRecipes, equippedRecipes, unlockRecipe, equipRecipe, activeRecipes,
            currentDay, incrementDay,
            gold, addGold, spendGold,
            ownedRelics, addRelic,
            ritualGrid, saveRitualGrid,
            resetGame,
            pendingPuzzlePieces, addPendingPuzzlePiece, consumePendingPuzzlePieces
        }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (!context) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
