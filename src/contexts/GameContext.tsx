import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, ROWS, BOARD_WIDTH, ENEMY_BOARD_WIDTH, ENEMY_COLS } from '../game/config';
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
    generateWave: (day: number, patternId?: string) => void;
    currentPattern: string;
    setPattern: (id: string) => void;

    // スコア（生き残ったwave数）
    finalScore: number;
    setFinalScore: (score: number) => void;

    // 共有PIXIアプリ（DefensePhaseが所有、RitualPhaseが借用）
    pixiAppRef: React.MutableRefObject<any | null>;
    pixiAppVersion: number; // アプリ初期化/破棄時にインクリメント
    registerPixiApp: (app: any | null) => void;

    // デバッグモード
    isDebugMode: boolean;
    setIsDebugMode: (v: boolean) => void;
    addIncomingEnemy: (enemy: any) => void;
    clearIncomingEnemies: () => void;
    updateIncomingEnemy: (id: string, row: number, col: number) => void;
    debugGridClearSignal: number;
    triggerDebugGridClear: () => void;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<GamePhase>('TITLE');
    const [summonedMonsters, setSummonedMonsters] = useState<SummonedUnit[]>([]);

    // レシピ装備システム（スタートドラフトで初期化）
    const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>([]);
    const [equippedRecipes, setEquippedRecipes] = useState<(string | null)[]>([]);
    const activeRecipes = equippedRecipes
        .map(id => ALL_RECIPES.find(r => r.id === id))
        .filter((r): r is Recipe => r !== undefined);

    const [currentDay, setCurrentDay] = useState<number>(1);
    const [money, setMoney] = useState<number>(0);
    const [ownedRelics, setOwnedRelics] = useState<string[]>([]);
    const [ritualGrid, setRitualGrid] = useState<(any | null)[][]>([]);
    const [expectedSummons, setExpectedSummons] = useState<SummonedUnit[]>([]);
    const [fieldWidth] = useState<number>(BOARD_WIDTH + ENEMY_BOARD_WIDTH);
    const [incomingEnemies, setIncomingEnemies] = useState<any[]>([]);
    const [currentPattern, setPattern] = useState<string>('random');

    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);
    const [isDebugMode, setIsDebugMode] = useState<boolean>(false);
    const [finalScore, setFinalScore] = useState<number>(0);
    const [debugGridClearSignal, setDebugGridClearSignal] = useState<number>(0);
    const triggerDebugGridClear = React.useCallback(() => setDebugGridClearSignal(v => v + 1), []);

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

    const addIncomingEnemy = React.useCallback((enemy: any) => {
        setIncomingEnemies(prev => [...prev, enemy]);
    }, []);

    const clearIncomingEnemies = React.useCallback(() => {
        setIncomingEnemies([]);
    }, []);

    const updateIncomingEnemy = React.useCallback((id: string, row: number, col: number) => {
        setIncomingEnemies(prev => prev.map(e => e.id === id ? { ...e, row, col } : e));
    }, []);

    const generateWave = React.useCallback((day: number, _patternId?: string) => {
        type EnemyEntry = { id: string; type: string; row: number; col: number; isElite?: boolean; hpScale?: number; atkScale?: number };

        // ランダム配置（重複なし）
        const usedPositions = new Set<string>();
        const placeRandom = (): { row: number; col: number } => {
            let row: number, col: number, tries = 0;
            do {
                row = Math.floor(Math.random() * ROWS);
                col = Math.floor(Math.random() * ENEMY_COLS);
                tries++;
            } while (usedPositions.has(`${row},${col}`) && tries < 100);
            usedPositions.add(`${row},${col}`);
            return { row, col };
        };

        // スタットスケーリング: HP +10%/wave、ATK +7%/wave
        const hpScale = 1.0 + (day - 1) * 0.10;
        const atkScale = 1.0 + (day - 1) * 0.07;

        // エリート出現率（wave3から開始、最大40%）
        const eliteChance = Math.min(Math.max(0, (day - 3) * 0.04), 0.40);

        // wave進行で解放されるユニット種別プール
        const pool: HeroType[] = ['農夫', '村人'];
        if (day >= 3)  pool.push('弓兵');
        if (day >= 5)  pool.push('剣士');
        if (day >= 8)  { pool.push('魔法使い'); pool.push('重騎士'); }
        if (day >= 12) { pool.push('プリースト'); pool.push('聖騎士'); }
        if (day >= 16) { pool.push('パラディン'); pool.push('大魔道士'); }
        if (day >= 22) pool.push('勇者');

        // 出現数: wave1=2-3体、以降じわじわ増加
        const baseCount = 2 + Math.floor((day - 1) * 0.8);
        const count = baseCount + Math.floor(Math.random() * 2);

        const enemies: EnemyEntry[] = [];
        for (let i = 0; i < count; i++) {
            const type = pool[Math.floor(Math.random() * pool.length)];
            const isElite = Math.random() < eliteChance;
            const { row, col } = placeRandom();
            enemies.push({ id: `e-${day}-${i}`, type, row, col, isElite, hpScale, atkScale });
        }

        setIncomingEnemies(enemies);
    }, []);

    const resetGame = React.useCallback(() => {
        setSummonedMonsters([]);
        setUnlockedRecipes([]);
        setEquippedRecipes([]);
        setCurrentDay(1);
        setMoney(0);
        setOwnedRelics([]);
        setPendingPuzzlePieces([]);
        setRitualGrid([]);
        setExpectedSummons([]);
        setIncomingEnemies([]);
        setIsDebugMode(false);
        setFinalScore(0);
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
            fieldWidth, incomingEnemies, generateWave, currentPattern, setPattern,
            pixiAppRef, pixiAppVersion, registerPixiApp,
            isDebugMode, setIsDebugMode, addIncomingEnemy, clearIncomingEnemies, updateIncomingEnemy,
            debugGridClearSignal, triggerDebugGridClear,
            finalScore, setFinalScore
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
