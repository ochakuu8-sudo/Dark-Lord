import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import { ALL_RECIPES, ROWS, BOARD_WIDTH, ENEMY_BOARD_WIDTH, ENEMY_COLS } from '../game/config';
import type { Recipe } from '../game/config';
import type { HeroType } from '../game/entities';

export type GamePhase = 'TITLE' | 'RITUAL' | 'BATTLE' | 'RESULT';

export interface BattleOption {
    id: string;
    label: string;
    difficulty: 1 | 2 | 3;
    gruntGroups: { type: HeroType; count: number }[];
    bossType: HeroType;
    pieceType: 0 | 1 | 2;   // 0=骨 1=肉 2=霊
    recipeId: string;
}



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

    // バトル選択 (ローグライク)
    battleOptions: BattleOption[];
    selectedBattleOption: BattleOption | null;
    generateBattleOptions: (day: number) => void;
    selectBattleOption: (option: BattleOption) => void;

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
    const [battleOptions, setBattleOptions] = useState<BattleOption[]>([]);
    const [selectedBattleOption, setSelectedBattleOption] = useState<BattleOption | null>(null);

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

    // ── バトル選択肢生成 ──────────────────────────────────────────
    const generateBattleOptions = React.useCallback((day: number) => {
        const materialSuffix = ['bone', 'meat', 'spirit'] as const;

        // ピース種別をシャッフル（毎回異なる組み合わせ）
        const pieceTypes: (0 | 1 | 2)[] = [0, 1, 2];
        for (let i = 2; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieceTypes[i], pieceTypes[j]] = [pieceTypes[j], pieceTypes[i]];
        }

        const pickRecipe = (pt: 0 | 1 | 2): string => {
            const suffix = materialSuffix[pt];
            const cands = ALL_RECIPES.filter(r =>
                r.id.endsWith(`_${suffix}`) && !equippedRecipes.includes(r.id)
            );
            if (cands.length > 0) return cands[Math.floor(Math.random() * cands.length)].id;
            const any = ALL_RECIPES.filter(r => !equippedRecipes.includes(r.id));
            return (any[0] || ALL_RECIPES[0]).id;
        };

        const boss1: HeroType = day >= 7 ? '聖騎士' : '剣士';
        const boss2: HeroType = day >= 9 ? 'パラディン' : '重騎士';
        const boss3: HeroType = day >= 11 ? '勇者' : day >= 7 ? '大魔道士' : '魔法使い';

        const c1 = 2 + Math.floor(day * 0.8);
        const c2 = 2 + Math.floor(day * 0.6);
        const c3 = 2 + Math.floor(day * 0.5);

        const options: BattleOption[] = [
            {
                id: `opt-${day}-0`, label: '落ち武者の群れ', difficulty: 1,
                gruntGroups: [
                    { type: '農夫', count: Math.max(2, Math.ceil(c1 * 0.6)) },
                    { type: '村人', count: Math.max(1, Math.floor(c1 * 0.4)) },
                ],
                bossType: boss1, pieceType: pieceTypes[0], recipeId: pickRecipe(pieceTypes[0]),
            },
            {
                id: `opt-${day}-1`, label: '国境の守備隊', difficulty: 2,
                gruntGroups: [
                    { type: '弓兵', count: Math.max(2, Math.ceil(c2 * 0.6)) },
                    { type: '剣士', count: Math.max(1, Math.floor(c2 * 0.4)) },
                ],
                bossType: boss2, pieceType: pieceTypes[1], recipeId: pickRecipe(pieceTypes[1]),
            },
            {
                id: `opt-${day}-2`, label: '王国精鋭部隊', difficulty: 3,
                gruntGroups: [
                    { type: '魔法使い', count: Math.max(2, Math.ceil(c3 * 0.5)) },
                    { type: '重騎士',   count: Math.max(1, Math.floor(c3 * 0.3)) },
                ],
                bossType: boss3, pieceType: pieceTypes[2], recipeId: pickRecipe(pieceTypes[2]),
            },
        ];

        setBattleOptions(options);
        setSelectedBattleOption(null);
    }, [equippedRecipes]);

    const selectBattleOption = React.useCallback((option: BattleOption) => {
        setSelectedBattleOption(option);

        type EnemyEntry = { id: string; type: string; row: number; col: number; isElite?: boolean; isBoss?: boolean };

        const usedByCol = new Map<number, Set<number>>();
        const placeAt = (col: number): number => {
            if (!usedByCol.has(col)) usedByCol.set(col, new Set());
            const used = usedByCol.get(col)!;
            const avail = Array.from({ length: ROWS }, (_, k) => k).filter(k => !used.has(k));
            const row = avail.length > 0 ? avail[Math.floor(Math.random() * avail.length)] : Math.floor(Math.random() * ROWS);
            used.add(row);
            return row;
        };

        const enemies: EnemyEntry[] = [];
        let idx = 0;
        option.gruntGroups.forEach(({ type, count }) => {
            for (let i = 0; i < count; i++) {
                const col = Math.floor(Math.random() * 7);
                enemies.push({ id: `e-${option.id}-${idx++}`, type, row: placeAt(col), col });
            }
        });
        // ボスは中央列に固定配置
        enemies.push({ id: `boss-${option.id}`, type: option.bossType, row: placeAt(4), col: 4, isBoss: true });

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
            battleOptions, selectedBattleOption, generateBattleOptions, selectBattleOption,
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
