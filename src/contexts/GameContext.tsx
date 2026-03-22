import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, ROWS, COLS, BOARD_WIDTH, ENEMY_BOARD_WIDTH, BLOCK_SIZE, MAX_AP, AP_PER_DAY, AP_GAUGE_MAX } from '../game/config';
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

    // 共有PIXIアプリ（DefensePhaseが所有、RitualPhaseが借用）
    pixiAppRef: React.MutableRefObject<any | null>;
    pixiAppVersion: number; // アプリ初期化/破棄時にインクリメント
    registerPixiApp: (app: any | null) => void;
}

const GameContext = createContext<GameState | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [phase, setPhase] = useState<GamePhase>('TITLE');
    const [summonedMonsters, setSummonedMonsters] = useState<SummonedUnit[]>([]);

    // レシピ装備システム（上限なし・デバッグ中は全装備）
    const [unlockedRecipes, setUnlockedRecipes] = useState<string[]>(ALL_RECIPES.map(r => r.id));
    const [equippedRecipes, setEquippedRecipes] = useState<(string | null)[]>(ALL_RECIPES.map(r => r.id));
    const activeRecipes = equippedRecipes
        .map(id => ALL_RECIPES.find(r => r.id === id))
        .filter((r): r is Recipe => r !== undefined);

    const [currentDay, setCurrentDay] = useState<number>(1);
    const [gold, setGold] = useState<number>(100);
    const [ownedRelics, setOwnedRelics] = useState<string[]>([]);
    const [ritualGrid, setRitualGrid] = useState<(any | null)[][]>([]);
    const [expectedSummons, setExpectedSummons] = useState<SummonedUnit[]>([]);
    const [fieldWidth, setFieldWidth] = useState<number>(BOARD_WIDTH + ENEMY_BOARD_WIDTH);
    const [incomingEnemies, setIncomingEnemies] = useState<any[]>([]);

    const [pendingPuzzlePieces, setPendingPuzzlePieces] = useState<number[]>([]);
    const [ap, setAp] = useState<number>(AP_PER_DAY);
    const apRef = React.useRef<number>(AP_PER_DAY);
    const maxAp = MAX_AP;
    const [apGauge, setApGauge] = useState<number>(0);
    const apGaugeRef = React.useRef<number>(0);

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

    const incrementDay = React.useCallback(() => {
        setCurrentDay(prev => prev + 1);
        setSummonedMonsters([]); // 戦闘盤面リセット
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
        // 敵陣列(col): 0=最前衛(左/自陣に近い), 6=最後衛
        const FORMATION: Record<string, number> = {
            '重騎士': 0, 'パラディン': 0, '剣士': 1,
            '村人': 1, '農夫': 2,
            '弓兵': 4, '魔法使い': 5, '大魔道士': 6,
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
                isElite: Math.random() < 0.1
            });
        }
        // ボスを最後列中央に固定配置
        enemies.push({
            id: `boss-${day}`,
            type: 'ボス',
            row: 3,
            col: 6,
            isElite: false,
        });
        setIncomingEnemies(enemies);
    }, []);

    const dropMaterials = React.useCallback((day: number) => {
        const colors = [0, 1, 2];
        const count = 38 + day * 2;
        for (let i = 0; i < count; i++) {
            const color = colors[Math.floor(Math.random() * colors.length)];
            addPendingPuzzlePiece(color);
        }
        return count;
    }, [addPendingPuzzlePiece]);

    const resetGame = React.useCallback(() => {
        setSummonedMonsters([]);
        setEquippedRecipes(ALL_RECIPES.map(r => r.id));
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
            fieldWidth, incomingEnemies, generateWave, dropMaterials,
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
