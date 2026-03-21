import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, INITIAL_RECIPES, ROWS, COLS, BOARD_WIDTH, MAX_AP, AP_PER_DAY, AP_GAUGE_MAX } from '../game/config';
import type { Recipe } from '../game/config';

export type GamePhase = 'TITLE' | 'PREPARATION' | 'RITUAL' | 'BATTLE' | 'RESULT';

export interface SummonedUnit {
    id: string;      // 個体識別用
    type: string;    // 'orc_bone' 等
    attackBonus: number;
    hpBonus: number;
    r: number;       // 盤面上の行
    c: number;       // 盤面上の列
}

interface GameState {
    phase: GamePhase;
    setPhase: (phase: GamePhase) => void;
    summonedMonsters: SummonedUnit[];
    addSummonedMonster: (unit: SummonedUnit) => void;
    addSummonedMonsters: (units: SummonedUnit[]) => void;
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

    // AP（行動ポイント）
    ap: number;
    maxAp: number;
    spendAp: (amount: number) => boolean;
    refillAp: () => void;
    apGauge: number;       // 0〜AP_GAUGE_MAX
    addApGauge: (amount: number) => void;

    // パズルへのフィードバック用
    pendingPuzzlePieces: number[];
    addPendingPuzzlePiece: (color: number) => void;
    consumePendingPuzzlePieces: () => number[];

    // 儀式盤面の永続化 (BlockData[] の 2次元配列)
    ritualGrid: (any | null)[][];
    saveRitualGrid: (grid: (any | null)[][]) => void;

    // 戦場情報の拡張
    fieldWidth: number;
    expectedSummons: SummonedUnit[];
    setExpectedSummons: (units: SummonedUnit[]) => void;
    incomingEnemies: any[];
    generateWave: (day: number) => void;
    dropMaterials: (day: number) => number;
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
    const [expectedSummons, setExpectedSummons] = useState<SummonedUnit[]>([]);
    const [fieldWidth, setFieldWidth] = useState<number>(BOARD_WIDTH + 1000);
    const [incomingEnemies, setIncomingEnemies] = useState<any[]>([]);

    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);
    const [ap, setAp] = useState<number>(AP_PER_DAY);
    const apRef = React.useRef<number>(AP_PER_DAY);
    const maxAp = MAX_AP;
    const [apGauge, setApGauge] = useState<number>(0);
    const apGaugeRef = React.useRef<number>(0);

    const addSummonedMonster = React.useCallback((unit: SummonedUnit) => {
        setSummonedMonsters(prev => [unit, ...prev]);
    }, []);

    const addSummonedMonsters = React.useCallback((units: SummonedUnit[]) => {
        setSummonedMonsters(prev => [...units, ...prev]);
    }, []);

    const clearSummonedMonsters = React.useCallback(() => {
        setSummonedMonsters([]);
    }, []);

    const addPendingPuzzlePiece = React.useCallback((color: number) => {
        setPendingPuzzlePieces(prev => [...prev, color]);
    }, []);

    const consumePendingPuzzlePieces = React.useCallback(() => {
        const p = [...pendingPuzzlePieces];
        if (p.length > 0) setPendingPuzzlePieces([]);
        return p;
    }, [pendingPuzzlePieces]);

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

    const spendAp = React.useCallback((amount: number) => {
        if (apRef.current < amount) return false;
        apRef.current -= amount;
        setAp(apRef.current);
        return true;
    }, []);

    const refillAp = React.useCallback(() => {
        const next = Math.min(apRef.current + AP_PER_DAY, MAX_AP);
        apRef.current = next;
        setAp(next);
    }, []);

    const addApGauge = React.useCallback((amount: number) => {
        const next = apGaugeRef.current + amount;
        if (next >= AP_GAUGE_MAX) {
            const apGain = Math.floor(next / AP_GAUGE_MAX);
            const newAp = Math.min(apRef.current + apGain, MAX_AP);
            apRef.current = newAp;
            apGaugeRef.current = next % AP_GAUGE_MAX;
            setAp(newAp);
            setApGauge(apGaugeRef.current);
        } else {
            apGaugeRef.current = next;
            setApGauge(next);
        }
    }, []);

    const saveRitualGrid = React.useCallback((grid: (any | null)[][]) => {
        setRitualGrid(grid);
    }, []);

    const generateWave = React.useCallback((day: number) => {
        const enemies = [];
        const count = 3 + day * 2;
        const types: HeroType[] = ['村人', '農夫', '弓兵', 'シーフ'];
        for (let i = 0; i < count; i++) {
            const type = types[Math.floor(Math.random() * types.length)];
            enemies.push({ 
                id: `e-${day}-${i}`, 
                type: type, 
                lane: Math.floor(Math.random() * ROWS), // 0-6
                offset: i * 80 + Math.random() * 40,
                isElite: Math.random() < 0.1
            });
        }
        setIncomingEnemies(enemies);
    }, []);

    const dropMaterials = React.useCallback((day: number) => {
        const colors = [0, 1, 2];
        const count = 5 + day;
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            addPendingPuzzlePiece(color);
        }
        return count;
    }, [addPendingPuzzlePiece]);

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
        setAp(AP_PER_DAY);
        setApGauge(0);
        setRitualGrid([]);
        setExpectedSummons([]);
        setIncomingEnemies([]);
    }, []);

    return (
        <GameContext.Provider value={{
            phase, setPhase,
            summonedMonsters, addSummonedMonster, addSummonedMonsters, clearSummonedMonsters,
            unlockedRecipes, equippedRecipes, unlockRecipe, equipRecipe, activeRecipes,
            currentDay, incrementDay,
            gold, addGold, spendGold,
            ownedRelics, addRelic,
            ritualGrid, saveRitualGrid,
            resetGame,
            pendingPuzzlePieces, addPendingPuzzlePiece, consumePendingPuzzlePieces,
            ap, maxAp, spendAp, refillAp, apGauge, addApGauge,
            expectedSummons, setExpectedSummons,
            fieldWidth, incomingEnemies, generateWave, dropMaterials
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
