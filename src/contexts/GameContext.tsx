import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, ROWS, COLS, BOARD_WIDTH, ENEMY_BOARD_WIDTH, BLOCK_SIZE } from '../game/config';
import type { Recipe } from '../game/config';
import type { HeroType } from '../game/entities';

export type GamePhase = 'TITLE' | 'RITUAL' | 'BATTLE' | 'RESULT';

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
    addEquippedRecipe: (recipeId: string) => void;
    activeRecipes: Recipe[]; // derived from equippedRecipes

    currentDay: number;
    incrementDay: () => void;
    money: number;
    addMoney: (amount: number) => void;
    spendMoney: (amount: number) => boolean;
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

    // 戦場情報の拡張
    fieldWidth: number;
    expectedSummons: SummonedUnit[];
    setExpectedSummons: (units: SummonedUnit[]) => void;
    incomingEnemies: any[];
    generateWave: (day: number) => void;

    // 共有PIXIアプリ（DefensePhaseが所有、RitualPhaseが借用）
    pixiAppRef: React.MutableRefObject<any | null>;
    pixiAppVersion: number; // アプリ初期化/破棄時にインクリメント
    registerPixiApp: (app: any | null) => void;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<GamePhase>('TITLE');
    const [summonedMonsters, setSummonedMonsters] = useState<SummonedUnit[]>([]);

    // レシピ装備システム（初期: オーク・スケルトン・ウィスプ）
    const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>(['orc', 'skeleton', 'wisp']);
    const [equippedRecipes, setEquippedRecipes] = useState<(string | null)[]>(['orc', 'skeleton', 'wisp']);
    const activeRecipes = equippedRecipes
        .map(id => ALL_RECIPES.find(r => r.id === id))
        .filter((r): r is Recipe => r !== undefined);

    const [currentDay, setCurrentDay] = useState<number>(1);
    const [money, setMoney] = useState<number>(0);
    const [ownedRelics, setOwnedRelics] = useState<string[]>([]);
    const [ritualGrid, setRitualGrid] = useState<(any | null)[][]>([]);
    const [expectedSummons, setExpectedSummons] = useState<SummonedUnit[]>([]);
    const [fieldWidth, setFieldWidth] = useState<number>(BOARD_WIDTH + ENEMY_BOARD_WIDTH);
    const [incomingEnemies, setIncomingEnemies] = useState<any[]>([]);

    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);

    // 共有PIXIアプリ
    const pixiAppRef = React.useRef<any | null>(null);
    const [pixiAppVersion, setPixiAppVersion] = React.useState(0);
    const registerPixiApp = React.useCallback((app: any | null) => {
        pixiAppRef.current = app;
        setPixiAppVersion(v => v + 1);
    }, []);

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

    const addEquippedRecipe = React.useCallback((recipeId: string) => {
        setUnlockedRecipes(prev => prev.includes(recipeId) ? prev : [...prev, recipeId]);
        setEquippedRecipes(prev => prev.includes(recipeId) ? prev : [...prev, recipeId]);
    }, []);

    const incrementDay = React.useCallback(() => {
        setCurrentDay(prev => prev + 1);
        setSummonedMonsters([]); // 戦闘盤面リセット
    }, []);

    const addMoney = React.useCallback((amount: number) => {
        setMoney(prev => prev + amount);
    }, []);

    const spendMoney = React.useCallback((amount: number) => {
        let success = false;
        setMoney(prev => {
            if (prev >= amount) { success = true; return prev - amount; }
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

    const generateWave = React.useCallback((day: number) => {
        // 敵陣列(col): 0=最前衛(左/自陣に近い), 8=最後衛
        const FORMATION: Record<string, number> = {
            '重騎士': 0, 'パラディン': 0, '剣士': 1,
            '村人': 1, '農夫': 2,
            '弓兵': 5, '魔法使い': 6, '大魔道士': 7,
        };

        const enemies = [];
        const count = 6 + day * 3;

        const usedPosByCol = new Map<number, Set<number>>();
        const tankTypes: HeroType[] = day >= 3 ? ['剣士', '重騎士'] : ['村人', '農夫'];
        const rangedTypes: HeroType[] = day >= 3 ? ['弓兵', '魔法使い'] : day >= 2 ? ['弓兵'] : [];

        for (let i = 0; i < count; i++) {
            const isTank = rangedTypes.length === 0 || i < Math.ceil(count * 2 / 3);
            const type = isTank
                ? tankTypes[Math.floor(Math.random() * tankTypes.length)]
                : rangedTypes[Math.floor(Math.random() * rangedTypes.length)];
            const col = FORMATION[type] ?? 4;
            if (!usedPosByCol.has(col)) usedPosByCol.set(col, new Set());
            const used = usedPosByCol.get(col)!;
            const available = Array.from({length: ROWS}, (_, k) => k).filter(k => !used.has(k));
            const row = available.length > 0
                ? available[Math.floor(Math.random() * available.length)]
                : Math.floor(Math.random() * ROWS);
            used.add(row);
            enemies.push({
                id: `e-${day}-${i}`,
                type,
                row,
                col,
                isElite: day >= 2 && Math.random() < 0.1
            });
        }
        // ボスを最後列中央に固定配置（dayでHPスケール）
        enemies.push({
            id: `boss-${day}`,
            type: 'ボス',
            row: 4, // 9行中央
            col: 8, // 9列最後衛
            isElite: false,
            hpScale: 1 + (day - 1) * 0.8, // Day1=1x, Day2=1.8x, Day3=2.6x...
        });
        setIncomingEnemies(enemies);
    }, []);

    const resetGame = React.useCallback(() => {
        setSummonedMonsters([]);
        setUnlockedRecipes(['orc', 'skeleton', 'wisp']);
        setEquippedRecipes(['orc', 'skeleton', 'wisp']);
        setCurrentDay(1);
        setMoney(0);
        setOwnedRelics([]);
        setPendingPuzzlePieces([]);
        setRitualGrid([]);
        setExpectedSummons([]);
        setIncomingEnemies([]);
    }, []);

    return (
        <GameContext.Provider value={{
            phase, setPhase,
            summonedMonsters, addSummonedMonster, addSummonedMonsters, clearSummonedMonsters,
            unlockedRecipes, equippedRecipes, unlockRecipe, equipRecipe, addEquippedRecipe, activeRecipes,
            currentDay, incrementDay,
            money, addMoney, spendMoney,
            ownedRelics, addRelic,
            ritualGrid, saveRitualGrid,
            resetGame,
            pendingPuzzlePieces, addPendingPuzzlePiece, consumePendingPuzzlePieces,
            expectedSummons, setExpectedSummons,
            fieldWidth, incomingEnemies, generateWave,
            pixiAppRef, pixiAppVersion, registerPixiApp
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
