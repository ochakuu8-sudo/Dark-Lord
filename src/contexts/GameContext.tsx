import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, ROWS, BOARD_WIDTH, ENEMY_BOARD_WIDTH } from '../game/config';
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

    const generateWave = React.useCallback((day: number, patternId?: string) => {
        type EnemyEntry = { id: string; type: string; row: number; col: number; isElite?: boolean; hpScale?: number };

        // ユーティリティ: 列ごとに重複しない行をランダムに割り当てる
        const usedByCol = new Map<number, Set<number>>();
        const placeAt = (col: number): number => {
            if (!usedByCol.has(col)) usedByCol.set(col, new Set());
            const used = usedByCol.get(col)!;
            const avail = Array.from({ length: ROWS }, (_, k) => k).filter(k => !used.has(k));
            const row = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : Math.floor(Math.random() * ROWS);
            used.add(row);
            return row;
        };
        const boss = (id: string, row = 4, col = 8): EnemyEntry => ({
            id, type: 'ボス', row, col, isElite: false, hpScale: 1 + (day - 1) * 0.8
        });
        const unit = (idx: number, type: HeroType, col: number, elite = false): EnemyEntry => ({
            id: `e-${day}-${idx}`, type, row: placeAt(col), col, isElite: elite
        });

        // 利用可能パターン（day4未満はvip_guardを除外）
        const available = ['turtle', 'swarm', 'archer_wall', 'lane_rush', 'priest_loop', 'phased', 'speed_rush'];
        if (day >= 4) available.push('vip_guard');

        const pid = (!patternId || patternId === 'random')
            ? available[Math.floor(Math.random() * available.length)]
            : patternId;

        let enemies: EnemyEntry[] = [];

        if (pid === 'turtle') {
            // 亀甲陣: 重騎士/パラディンで前列密集＋後方プリースト
            const count = 4 + day * 2;
            for (let i = 0; i < count; i++) {
                const col = i % 3; // col 0〜2
                const type: HeroType = col === 0 ? 'パラディン' : '重騎士';
                enemies.push(unit(i, type, col));
            }
            const priests = Math.min(2 + day, 4);
            for (let i = 0; i < priests; i++) enemies.push(unit(100 + i, 'プリースト', 6 + (i % 2)));
            enemies.push(boss(`boss-${day}`));

        } else if (pid === 'swarm') {
            // 雪崩: 農夫・村人の大量配置
            const count = 10 + day * 4;
            for (let i = 0; i < count; i++) {
                const type: HeroType = Math.random() < 0.5 ? '農夫' : '村人';
                const col = Math.floor(Math.random() * 5); // col 0〜4
                enemies.push(unit(i, type, col, day >= 2 && Math.random() < 0.1));
            }
            enemies.push(boss(`boss-${day}`, 0, 8));

        } else if (pid === 'archer_wall') {
            // 弓兵殲滅陣: 後衛に弓兵・魔法使い密集
            enemies.push(unit(0, '村人', 0)); // 前衛1体だけ
            const rangedCount = 4 + day * 2;
            for (let i = 0; i < rangedCount; i++) {
                const types: HeroType[] = day >= 3 ? ['弓兵', '魔法使い', '大魔道士'] : ['弓兵', '魔法使い'];
                const type = types[Math.floor(Math.random() * types.length)];
                const col = 5 + (i % 3); // col 5〜7
                enemies.push(unit(i + 1, type, col));
            }
            enemies.push(boss(`boss-${day}`));

        } else if (pid === 'vip_guard') {
            // 精鋭護衛隊: 勇者を聖騎士/重騎士が囲む
            enemies.push({ id: `vip-${day}`, type: '勇者', row: 4, col: 4, hpScale: 1 + (day - 1) * 0.5 });
            const guardPositions = [
                [3,3],[4,3],[5,3],[3,4],[5,4],[3,5],[4,5],[5,5]
            ];
            guardPositions.forEach(([r, c], i) => {
                const type: HeroType = i % 2 === 0 ? '聖騎士' : '重騎士';
                enemies.push({ id: `guard-${day}-${i}`, type, row: r, col: c });
            });

        } else if (pid === 'lane_rush') {
            // 縦割り突撃: 中央3行(3〜5)のみに集中
            const count = 5 + day * 2;
            for (let i = 0; i < count; i++) {
                const row = 3 + (i % 3); // row 3,4,5
                const col = i % 8;
                const types: HeroType[] = ['剣士', '農夫', '弓兵'];
                const type = types[Math.floor(Math.random() * types.length)];
                enemies.push({ id: `e-${day}-${i}`, type, row, col });
            }
            enemies.push(boss(`boss-${day}`, 4, 8));

        } else if (pid === 'priest_loop') {
            // 支援完結型: プリースト縦列＋聖騎士タンク
            const priestCount = Math.min(3 + day, 5);
            for (let i = 0; i < priestCount; i++) enemies.push(unit(i, 'プリースト', 4 + (i % 3)));
            const knightCount = 2 + Math.floor(day / 2);
            for (let i = 0; i < knightCount; i++) enemies.push(unit(100 + i, '聖騎士', i % 3));
            enemies.push(boss(`boss-${day}`));

        } else if (pid === 'phased') {
            // 波状攻撃: タンク→中衛→後衛の3層
            const perLayer = 2 + day;
            for (let i = 0; i < perLayer; i++) {
                const t: HeroType = Math.random() < 0.5 ? '重騎士' : 'パラディン';
                enemies.push(unit(i, t, i % 3));
            }
            for (let i = 0; i < perLayer; i++) {
                const t: HeroType = Math.random() < 0.5 ? '剣士' : '農夫';
                enemies.push(unit(perLayer + i, t, 3 + (i % 3)));
            }
            for (let i = 0; i < perLayer; i++) {
                const t: HeroType = Math.random() < 0.5 ? '弓兵' : '魔法使い';
                enemies.push(unit(perLayer * 2 + i, t, 6 + (i % 2)));
            }
            enemies.push(boss(`boss-${day}`));

        } else if (pid === 'speed_rush') {
            // 奇襲隊: 農夫・剣士のみ col 0〜3 に大量展開
            const count = 6 + day * 3;
            for (let i = 0; i < count; i++) {
                const type: HeroType = Math.random() < 0.6 ? '農夫' : '剣士';
                enemies.push(unit(i, type, i % 4, day >= 2 && Math.random() < 0.15));
            }
            enemies.push(boss(`boss-${day}`, 8, 8));

        } else {
            // フォールバック: 従来のランダム編成
            const count = 6 + day * 3;
            const tankTypes: HeroType[] = day >= 3 ? ['剣士', '重騎士'] : ['村人', '農夫'];
            const rangedTypes: HeroType[] = day >= 3 ? ['弓兵', '魔法使い'] : day >= 2 ? ['弓兵'] : [];
            for (let i = 0; i < count; i++) {
                const isTank = rangedTypes.length === 0 || i < Math.ceil(count * 2 / 3);
                const types = isTank ? tankTypes : rangedTypes;
                const type = types[Math.floor(Math.random() * types.length)];
                const FORMATION: Record<string, number> = { '重騎士': 0, 'パラディン': 0, '剣士': 1, '村人': 1, '農夫': 2, '弓兵': 5, '魔法使い': 6, '大魔道士': 7 };
                enemies.push(unit(i, type, FORMATION[type] ?? 4, day >= 2 && Math.random() < 0.1));
            }
            enemies.push(boss(`boss-${day}`));
        }

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
        setIsDebugMode(false);
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
            debugGridClearSignal, triggerDebugGridClear
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
