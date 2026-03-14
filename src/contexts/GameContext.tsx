import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';

import { ALL_RECIPES } from '../game/config';
import type { Recipe } from '../game/config';

export type GamePhase = 'TITLE' | 'PREPARATION' | 'BATTLE' | 'RESULT';

interface GameState {
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;
    summonedMonsters: string[];
    addSummonedMonster: (monster: string) => void;
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
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<GamePhase>('TITLE');
    const [summonedMonsters, setSummonedMonsters] = useState<string[]>([]);
    
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

    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);

    const addSummonedMonster = (monster: string) => {
        setSummonedMonsters(prev => [monster, ...prev]);
    };

    const clearSummonedMonsters = () => {
        setSummonedMonsters([]);
    };

    const addPendingPuzzlePiece = (color: number) => {
        setPendingPuzzlePieces(prev => [...prev, color]);
    };

    const consumePendingPuzzlePieces = () => {
        const current = [...pendingPuzzlePieces];
        if (current.length > 0) {
            setPendingPuzzlePieces([]);
        }
        return current;
    };

    const unlockRecipe = (recipeId: string) => {
        if (!unlockedRecipes.includes(recipeId)) {
            setUnlockedRecipes(prev => [...prev, recipeId]);
        }
    };

    const equipRecipe = (slotIndex: number, recipeId: string | null) => {
        setEquippedRecipes(prev => {
            const newEquip = [...prev];
            newEquip[slotIndex] = recipeId;
            return newEquip;
        });
    };

    const incrementDay = () => {
        setCurrentDay(prev => prev + 1);
    };

    const addGold = (amount: number) => {
        setGold(prev => prev + amount);
    };

    const spendGold = (amount: number) => {
        if (gold >= amount) {
            setGold(prev => prev - amount);
            return true;
        }
        return false;
    };
    const addRelic = (relicId: string) => {
        if (!ownedRelics.includes(relicId)) {
            setOwnedRelics(prev => [...prev, relicId]);
        }
    };

    const resetGame = () => {
        setSummonedMonsters([]);
        setEquippedRecipes([
            ALL_RECIPES[0]?.id || null, 
            ALL_RECIPES[1]?.id || null, 
            ALL_RECIPES[2]?.id || null,
            null, null, null
        ]);
        setCurrentDay(1);
        setOwnedRelics([]);
        setPendingPuzzlePieces([]);
    };

    return (
        <GameContext.Provider value={{
            phase, setPhase,
            summonedMonsters, addSummonedMonster, clearSummonedMonsters,
            unlockedRecipes, equippedRecipes, unlockRecipe, equipRecipe, activeRecipes,
            currentDay, incrementDay,
            gold, addGold, spendGold,
            ownedRelics, addRelic,
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
