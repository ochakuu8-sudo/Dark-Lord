import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { useGame } from '../contexts/GameContext';
import {
    COLORS, PIECE_EMOJIS, ALL_RECIPES,
    ROWS, COLS, BLOCK_SIZE, RECIPE_EMOJIS, MATERIAL_BG_COLORS, COLOR_HEX,
    RELICS, type Recipe, type Relic
} from '../game/config';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import type { SummonedUnit } from '../contexts/GameContext';
import BestiaryModal from './BestiaryModal';

const SIDE_PANEL_WIDTH = 260;

interface BlockData {
    type: number; row: number; col: number; id: string;
    groupId?: string;
    isSummoned?: boolean;
    monsterType?: string;
    dropDelay?: number;
}

const MATERIAL_PREFIX: Record<string, string> = { bone: '骨', meat: '肉', spirit: '霊' };
const getMonsterDisplayName = (monsterType: string): string => {
    const parts = monsterType.split('_');
    const suffix = parts[parts.length - 1];
    const baseId = parts.slice(0, -1).join('_');
    const baseName = ALL_RECIPES.find(r => r.id === baseId)?.name;
    const prefix = MATERIAL_PREFIX[suffix];
    if (baseName && prefix) return prefix + baseName;
    if (baseName) return baseName;
    return monsterType;
};

const RitualPhase: React.FC = () => {
    const {
        activeRecipes, addSummonedMonsters,
        setPhase, currentDay,
        ritualGrid: storedGrid, saveRitualGrid,
        setExpectedSummons,
        expectedSummons,
        pixiAppRef, pixiAppVersion,
        generateWave, currentPattern, setPattern,
        equippedRecipes, addEquippedRecipe,
        ownedRelics, addRelic,
        money, addMoney, spendMoney,
    } = useGame();

    // レシピ選択オーバーレイ状態
    const [offeredRecipes, setOfferedRecipes] = useState<Recipe[]>([]);
    const [pickedRecipeId, setPickedRecipeId] = useState<string | null>(null);
    const [showRecipeSelect, setShowRecipeSelect] = useState(false);
    const [offeredRelics, setOfferedRelics] = useState<Relic[]>([]);

    // Day開始時: wave生成・レシピ選択オーバーレイ表示（Day2以降のみ）
    useEffect(() => {
        generateWave(currentDay);
        setPickedRecipeId(null);
        // レリックショップ更新（毎日3種ランダム）
        const unowned = RELICS.filter(r => !ownedRelics.includes(r.id));
        setOfferedRelics([...unowned].sort(() => 0.5 - Math.random()).slice(0, 3));
        if (currentDay === 1) {
            setShowRecipeSelect(false);
        } else {
            const unequipped = ALL_RECIPES.filter(r => !equippedRecipes.includes(r.id));
            setOfferedRecipes([...unequipped].sort(() => 0.5 - Math.random()).slice(0, 3));
            setShowRecipeSelect(true);
        }
    }, [currentDay]);

    const curRows = ROWS;
    const curCols = COLS;
    const curBlockSize = BLOCK_SIZE;
    const curWidth = COLS * BLOCK_SIZE;
    const curHeight = ROWS * BLOCK_SIZE;

    // 自前のPIXIアプリは持たない。DefensePhaseが所有するアプリを共有する。
    const appRef = useRef<PIXI.Application | null>(null);

    // Layers
    const bgLayerRef = useRef<PIXI.Graphics | null>(null);
    const boostLayerRef = useRef<PIXI.Container | null>(null);
    const linksLayerRef = useRef<PIXI.Container | null>(null);
    const blocksLayerRef = useRef<PIXI.Container | null>(null);
    const usageLayerRef = useRef<PIXI.Graphics | null>(null);
    const previewLayerRef = useRef<PIXI.Container | null>(null);

    const blockGraphicsMap = useRef<Map<string, PIXI.Container>>(new Map());
    const interactionParams = useRef({ selectedGroup: [] as BlockData[], isDragging: false });

    // 状態の初期化
    const [grid, setGrid] = useState<(BlockData | null)[][]>(() =>
        Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
    );
    const gridRef = useRef<(BlockData | null)[][]>(grid);
    const [isBestiaryOpen, setIsBestiaryOpen] = useState(false);


    const [comboCount, setComboCount] = useState(0);
    const [comboKey, setComboKey] = useState(0); // アニメーション再トリガー用
    const [flashCells, setFlashCells] = useState<{ r: number; c: number }[]>([]);
    const [isDraggingSummoned, setIsDraggingSummoned] = useState(false);
    const sellZoneRef = useRef<HTMLDivElement>(null);
    const [pinnedPiece, setPinnedPiece] = useState<{ monsterType: string; pos: { x: number; y: number } } | null>(null);
    const pinnedPieceInfoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!pinnedPiece) return;
        const handler = (e: PointerEvent) => {
            if (pinnedPieceInfoRef.current && !pinnedPieceInfoRef.current.contains(e.target as Node)) {
                setPinnedPiece(null);
            }
        };
        window.addEventListener('pointerdown', handler);
        return () => window.removeEventListener('pointerdown', handler);
    }, [pinnedPiece]);

    const audioCtxRef = useRef<AudioContext | null>(null);

    const playComboSound = useCallback((comboN: number) => {
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            // ペンタトニックスケールで上昇
            const freqs = [440, 523, 659, 784, 988, 1175];
            const freq = freqs[Math.min(comboN - 1, freqs.length - 1)];
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = comboN >= 5 ? 'square' : comboN >= 3 ? 'triangle' : 'sine';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.35);
            if (comboN >= 5) {
                // FEVERは和音追加
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.value = freq * 1.5;
                gain2.gain.setValueAtTime(0.1, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + 0.5);
            }
        } catch (_) { /* AudioContext unavailable */ }
    }, []);

    const blockPool = useRef<number[]>([]);
    const activeRecipesRef = useRef<(Recipe)[]>([]);
    const precomputedPatterns = useRef<{ recipe: Recipe, patterns: number[][][] }[]>([]);
    const gridInitialized = useRef(false);

    const generateId = useCallback(() => Math.random().toString(36).substr(2, 9), []);

    // Texture generation removed for more robust direct rendering

    const initPool = useCallback(() => {
        const pool: number[] = [];
        activeRecipesRef.current.forEach(recipe => {
            if (!recipe || !recipe.pattern) return;
            recipe.pattern.forEach((row: number[]) => {
                if (!row) return;
                row.forEach((val: number) => {
                    // Only add basic pieces (0, 1, 2) to the pool, not wildcards (9) or empty (-1)
                    if (val >= 0 && val <= 2) pool.push(val);
                });
            });
        });
        if (pool.length === 0) pool.push(0, 1, 2);
        blockPool.current = pool;
    }, []);

    // Persistent graphics for links to avoid GC pressure
    const linksGraphicsRef = useRef<PIXI.Graphics | null>(null);

    const renderLinks = useCallback(() => {
        const linksLayer = linksLayerRef.current;
        if (!linksLayer) return;

        if (!linksGraphicsRef.current) {
            linksGraphicsRef.current = new PIXI.Graphics();
            linksLayer.addChild(linksGraphicsRef.current);
        }

        const g = linksGraphicsRef.current;
        if (!g || (g as any).destroyed) return;
        g.clear();

        const groups = new Map<string, BlockData[]>();
        gridRef.current.forEach(row => row?.forEach(b => {
            if (b?.groupId) {
                if (!groups.has(b.groupId)) groups.set(b.groupId, []);
                groups.get(b.groupId)!.push(b);
            }
        }));

        groups.forEach((members) => {
            const type = members[0].type;
            const color = COLORS[type] || 0x888888;
            g.lineStyle(4, color, 0.6);

            for (let i = 0; i < members.length; i++) {
                const m1 = members[i];
                const linkGm1 = blockGraphicsMap.current.get(m1.id);
                if (!linkGm1 || (linkGm1 as any).destroyed) continue;

                for (let j = i + 1; j < members.length; j++) {
                    const m2 = members[j];
                    // Only draw lines between adjacent members
                    if (Math.abs(m1.row - m2.row) + Math.abs(m1.col - m2.col) === 1) {
                        const linkGm2 = blockGraphicsMap.current.get(m2.id);
                        if (!linkGm2 || (linkGm2 as any).destroyed) continue;

                        g.moveTo(linkGm1.x, linkGm1.y);
                        g.lineTo(linkGm2.x, linkGm2.y);
                    }
                }
            }
        });
    }, []);

    const createBlockGraphics = useCallback((block: BlockData, isMatched: boolean) => {
        const container = new PIXI.Container();

        // 召喚済み魔物タイルの描画
        if (block.isSummoned && block.monsterType) {
            const stats = UNIT_STATS[block.monsterType];
            const unitColor = stats?.color ?? 0xffcc00;
            // モンスタータイプからレシピIDと素材を分離 (例: 'goblin_bone' → recipeId='goblin', material='bone')
            const lastUnderscore = block.monsterType.lastIndexOf('_');
            const recipeId = lastUnderscore >= 0 ? block.monsterType.slice(0, lastUnderscore) : block.monsterType;
            const material = lastUnderscore >= 0 ? block.monsterType.slice(lastUnderscore + 1) : '';
            const bgColor = MATERIAL_BG_COLORS[material] ?? 0x1a1000;
            const emoji = RECIPE_EMOJIS[recipeId] ?? '👾';
            // 光彩
            const glow = new PIXI.Graphics();
            glow.beginFill(unitColor, 0.25);
            glow.drawRoundedRect(-curBlockSize / 2 - 4, -curBlockSize / 2 - 4, curBlockSize + 8, curBlockSize + 8, 16);
            glow.endFill();
            container.addChild(glow);
            gsap.to(glow, { alpha: 0.6, duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" });
            // 背景（素材カラー）
            const bg = new PIXI.Graphics();
            bg.beginFill(bgColor);
            bg.drawRoundedRect(-curBlockSize / 2 + 2, -curBlockSize / 2 + 2, curBlockSize - 4, curBlockSize - 4, 12);
            bg.endFill();
            container.addChild(bg);
            // 枠（ユニットカラー）
            const edge = new PIXI.Graphics();
            edge.lineStyle(2, unitColor, 1.0);
            edge.drawRoundedRect(-curBlockSize / 2 + 5, -curBlockSize / 2 + 5, curBlockSize - 10, curBlockSize - 10, 10);
            container.addChild(edge);
            // 魔物アイコン（レシピ別絵文字）
            const iconTxt = new PIXI.Text(emoji, new PIXI.TextStyle({ fontSize: Math.floor(curBlockSize * 0.42), align: 'center' }));
            iconTxt.anchor.set(0.5, 0.6);
            container.addChild(iconTxt);
            // 魔物名
            const nameTxt = new PIXI.Text(getMonsterDisplayName(block.monsterType), new PIXI.TextStyle({
                fontSize: 10, fill: '#ffdd88', fontWeight: 'bold', align: 'center',
                dropShadow: true, dropShadowColor: '#000000', dropShadowBlur: 3, dropShadowDistance: 0
            }));
            nameTxt.anchor.set(0.5, 0);
            nameTxt.y = curBlockSize / 2 - 14;
            container.addChild(nameTxt);
            // 隣接レベル表示（右下）
            const unitMaterialType = stats?.materialType ?? -1;
            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            let adjLevel = 0;
            if (unitMaterialType >= 0) {
                for (const [dr, dc] of dirs) {
                    const cell = gridRef.current[block.row + dr]?.[block.col + dc];
                    if (cell && !cell.isSummoned && cell.type === unitMaterialType) adjLevel++;
                }
            }
            if (adjLevel > 0) {
                const lvlBg = new PIXI.Graphics();
                lvlBg.beginFill(0x000000, 0.75);
                lvlBg.drawRoundedRect(-1, -1, 16, 16, 4);
                lvlBg.endFill();
                lvlBg.x = curBlockSize / 2 - 16;
                lvlBg.y = curBlockSize / 2 - 16;
                container.addChild(lvlBg);
                const lvlTxt = new PIXI.Text(`+${adjLevel}`, new PIXI.TextStyle({
                    fontSize: 11, fill: '#ffee44', fontWeight: 'bold'
                }));
                lvlTxt.anchor.set(0.5, 0.5);
                lvlTxt.x = curBlockSize / 2 - 8;
                lvlTxt.y = curBlockSize / 2 - 8;
                container.addChild(lvlTxt);
            }

            container.hitArea = new PIXI.Rectangle(-curBlockSize / 2, -curBlockSize / 2, curBlockSize, curBlockSize);
            container.eventMode = 'static'; container.cursor = 'pointer';
            container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
                if (interactionParams.current.isDragging) return;
                interactionParams.current.selectedGroup = [block];
                interactionParams.current.isDragging = true;
                const startGlobalX = event.global.x;
                const startGlobalY = event.global.y;
                const startClientX = event.clientX;
                const startClientY = event.clientY;
                let hasDragged = false;
                const gfx = blockGraphicsMap.current.get(block.id);
                const initX = gfx?.x ?? (block.col * curBlockSize + curBlockSize / 2);
                const initY = gfx?.y ?? (block.row * curBlockSize + curBlockSize / 2);
                if (gfx) { gsap.killTweensOf(gfx); gfx.zIndex = 100; gfx.scale.set(1.1); }
                blocksLayerRef.current?.sortChildren();
                if (!appRef.current) return;
                const canvas = appRef.current.view as HTMLCanvasElement;
                const rect0 = canvas.getBoundingClientRect();
                const scaleX0 = ((appRef.current as any)?.screen?.width ?? rect0.width) / rect0.width;
                const scaleY0 = ((appRef.current as any)?.screen?.height ?? rect0.height) / rect0.height;
                let rafId0: number | null = null;
                setIsDraggingSummoned(true);
                const onPointerMove = (e: PointerEvent) => {
                    const dx = e.clientX - startClientX;
                    const dy = e.clientY - startClientY;
                    if (!hasDragged && Math.sqrt(dx * dx + dy * dy) > 6) hasDragged = true;
                    const px = (e.clientX - rect0.left) * scaleX0;
                    const py = (e.clientY - rect0.top) * scaleY0;
                    if (gfx) { gfx.x = initX + (px - startGlobalX); gfx.y = initY + (py - startGlobalY); }
                    renderLinks();
                    if (rafId0 !== null) cancelAnimationFrame(rafId0);
                    rafId0 = requestAnimationFrame(() => {
                        appRef.current?.renderer.render(appRef.current.stage);
                        rafId0 = null;
                    });
                };
                const onPointerUp = (e: PointerEvent) => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    setIsDraggingSummoned(false);
                    if (!gfx) { interactionParams.current.isDragging = false; return; }
                    if (!hasDragged) {
                        // タップ判定: infoを表示
                        gfx.zIndex = 0; gfx.scale.set(1);
                        interactionParams.current.isDragging = false;
                        setPinnedPiece(prev =>
                            prev?.monsterType === block.monsterType ? null
                            : { monsterType: block.monsterType!, pos: { x: startGlobalX, y: startGlobalY } }
                        );
                        return;
                    }
                    // ドラッグ判定: 通常ドロップ処理
                    const sellRect = sellZoneRef.current?.getBoundingClientRect();
                    if (sellRect && e.clientX >= sellRect.left && e.clientX <= sellRect.right && e.clientY >= sellRect.top && e.clientY <= sellRect.bottom) {
                        gfx.zIndex = 0; gfx.scale.set(1);
                        interactionParams.current.isDragging = false;
                        const ng = gridRef.current.map(r => r ? [...r] : Array(curCols).fill(null));
                        ng[block.row][block.col] = null;
                        gridRef.current = ng;
                        setGrid([...ng.map(r => [...r])]);
                        saveRitualGrid(ng);
                        addMoney(10);
                        return;
                    }
                    const tr = Math.floor(gfx.y / curBlockSize);
                    const tc = Math.floor(gfx.x / curBlockSize);
                    if (tr >= 0 && tr < curRows && tc >= 0 && tc < curCols) {
                        const ng = gridRef.current.map(row => row ? [...row] : Array(curCols).fill(null));
                        const dest = gridRef.current[tr]?.[tc];
                        ng[block.row][block.col] = dest ? { ...dest, row: block.row, col: block.col } : null;
                        ng[tr][tc] = { ...block, row: tr, col: tc };
                        gridRef.current = ng; setGrid([...ng.map(r => [...r])]);
                    }
                    gfx.zIndex = 0; gfx.scale.set(1);
                    interactionParams.current.isDragging = false;
                    setGrid([...gridRef.current.map(r => [...r])]);
                };
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
            });
            return container;
        }

        const color = COLORS[block.type] ?? 0x888888;
        const emoji = PIECE_EMOJIS[block.type] || '❓';

        // Highlight Glow
        if (isMatched) {
            const glow = new PIXI.Graphics();
            glow.beginFill(0xffffff, 0.3);
            glow.drawRoundedRect(-curBlockSize / 2 - 5, -curBlockSize / 2 - 5, curBlockSize + 10, curBlockSize + 10, 16);
            glow.endFill();
            container.addChild(glow);

            // Pulsing animation for glow
            gsap.to(glow, { alpha: 0.6, duration: 0.8, repeat: -1, yoyo: true, ease: "sine.inOut" });
        }

        // 背景
        const bg = new PIXI.Graphics();
        bg.beginFill(isMatched ? 0x442222 : 0x222222);
        bg.drawRoundedRect(-curBlockSize / 2 + 2, -curBlockSize / 2 + 2, curBlockSize - 4, curBlockSize - 4, 12);
        bg.endFill();
        container.addChild(bg);

        // 枠
        const edge = new PIXI.Graphics();
        edge.lineStyle(2, isMatched ? 0xffffff : color, isMatched ? 1 : 0.6);
        edge.drawRoundedRect(-curBlockSize / 2 + 6, -curBlockSize / 2 + 6, curBlockSize - 12, curBlockSize - 12, 10);
        container.addChild(edge);

        // 絵文字
        const style = new PIXI.TextStyle({
            fontSize: Math.floor(curBlockSize * (isMatched ? 0.6 : 0.5)),
            align: 'center',
            fill: '#ffffff',
            fontWeight: 'bold',
            dropShadow: isMatched,
            dropShadowColor: '#ff0000',
            dropShadowBlur: 4,
            dropShadowDistance: 0
        });
        const txt = new PIXI.Text(emoji, style);
        txt.anchor.set(0.5);
        container.addChild(txt);

        // Explicit Hit Area
        container.hitArea = new PIXI.Rectangle(-curBlockSize / 2, -curBlockSize / 2, curBlockSize, curBlockSize);
        container.eventMode = 'static'; container.cursor = 'pointer';

        container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            if (interactionParams.current.isDragging) return;

            let targetBlock: BlockData | null = null;
            for (const row of gridRef.current) {
                if (!row) continue;
                for (const b of row) {
                    if (b?.id === block.id) { targetBlock = b; break; }
                }
                if (targetBlock) break;
            }
            if (!targetBlock) return;

            let group: BlockData[] = [];
            const tb = targetBlock as BlockData;
            if (tb.groupId) {
                gridRef.current.forEach(row => row?.forEach(c => { if (c && c.groupId === tb.groupId) group.push(c); }));
            } else { group = [tb]; }

            interactionParams.current.selectedGroup = group;
            interactionParams.current.isDragging = true;

            // Start position in PIXI local coordinates
            const startGlobalX = event.global.x;
            const startGlobalY = event.global.y;

            const initialPositions = group.map(m => ({
                id: m.id,
                x: blockGraphicsMap.current.get(m.id)?.x || (m.col * curBlockSize + curBlockSize / 2),
                y: blockGraphicsMap.current.get(m.id)?.y || (m.row * curBlockSize + curBlockSize / 2)
            }));

            group.forEach(m => {
                const targetGm = blockGraphicsMap.current.get(m.id);
                if (targetGm) { gsap.killTweensOf(targetGm); targetGm.zIndex = 100; targetGm.scale.set(1.1); }
            });
            blocksLayerRef.current?.sortChildren();

            if (!appRef.current) return;
            const canvas = appRef.current.view as HTMLCanvasElement;
            // getBoundingClientRect はドラッグ開始時に1回だけ取得
            const rect = canvas.getBoundingClientRect();
            const scaleX = ((appRef.current as any)?.screen?.width ?? rect.width) / rect.width;
            const scaleY = ((appRef.current as any)?.screen?.height ?? rect.height) / rect.height;

            let rafId: number | null = null;
            const onPointerMove = (moveEvent: PointerEvent) => {
                if (!interactionParams.current.isDragging) return;
                const pixiX = (moveEvent.clientX - rect.left) * scaleX;
                const pixiY = (moveEvent.clientY - rect.top) * scaleY;
                const dx = pixiX - startGlobalX;
                const dy = pixiY - startGlobalY;
                initialPositions.forEach(pos => {
                    const moveGm = blockGraphicsMap.current.get(pos.id);
                    if (moveGm) { moveGm.x = pos.x + dx; moveGm.y = pos.y + dy; }
                });
                renderLinks();
                if (rafId !== null) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    const currentApp = appRef.current;
                    if (currentApp) currentApp.renderer.render(currentApp.stage);
                    rafId = null;
                });
            };

            const onPointerUp = () => {
                window.removeEventListener('pointermove', onPointerMove);
                window.removeEventListener('pointerup', onPointerUp);

                const moves = group.map(m => {
                    const upGm = blockGraphicsMap.current.get(m.id);
                    if (!upGm) return { block: m, tr: -1, tc: -1 };
                    const tr = Math.floor(upGm.y / curBlockSize);
                    const tc = Math.floor(upGm.x / curBlockSize);
                    return { block: m, tr, tc };
                });
                const allIn = moves.every(m => m.tr >= 0 && m.tr < curRows && m.tc >= 0 && m.tc < curCols);
                if (allIn) {
                    const ng = gridRef.current.map(row => (row ? [...row] : Array(curCols).fill(null)));
                    const draggingIds = new Set(group.map(m => m.id));
                    let validSwap = true;
                    moves.forEach(m => {
                        const target = gridRef.current[m.tr]?.[m.tc];
                        if (target && !draggingIds.has(target.id) && target.groupId) {
                            const otherIds = new Set<string>();
                            gridRef.current.forEach(r => r?.forEach(b => {
                                if (b && b.groupId === target.groupId) otherIds.add(b.id);
                            }));
                            const targetIds = new Set(moves.map(mv => gridRef.current[mv.tr]?.[mv.tc]?.id).filter(id => !!id));
                            otherIds.forEach(id => { if (!targetIds.has(id)) validSwap = false; });
                        }
                    });
                    if (validSwap) {
                        group.forEach(m => { if (ng[m.row]) ng[m.row][m.col] = null; });
                        moves.forEach(m => {
                            const targetBlock = gridRef.current[m.tr]?.[m.tc];
                            if (targetBlock && !draggingIds.has(targetBlock.id))
                                if (ng[m.block.row]) ng[m.block.row][m.block.col] = { ...targetBlock, row: m.block.row, col: m.block.col };
                        });
                        moves.forEach(m => { if (ng[m.tr]) ng[m.tr][m.tc] = { ...m.block, row: m.tr, col: m.tc }; });
                        gridRef.current = ng; setGrid([...ng.map(row => [...row])]);
                    }
                }
                group.forEach(m => { const endGm = blockGraphicsMap.current.get(m.id); if (endGm) { endGm.zIndex = 0; endGm.scale.set(1); } });
                interactionParams.current.isDragging = false;
                setGrid([...gridRef.current.map(row => [...row])]);
            };

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
        });
        return container;
    }, [curRows, curCols, curBlockSize, renderLinks]);

    const matchedCellsRef = useRef<Set<string>>(new Set());
    const newlyPlacedIds = useRef<Set<string>>(new Set());

    const renderGrid = useCallback((matched?: Set<string>) => {
        const layer = blocksLayerRef.current;
        if (!layer) return;
        layer.removeChildren();
        blockGraphicsMap.current.clear();
        const cellsToHighlight = matched || matchedCellsRef.current;
        gridRef.current.forEach((row, ri) => {
            row?.forEach((block, ci) => {
                if (block) {
                    const isMatched = cellsToHighlight.has(`${ri},${ci}`);
                    const g = createBlockGraphics(block, isMatched);
                    g.x = ci * curBlockSize + curBlockSize / 2;
                    const targetY = ri * curBlockSize + curBlockSize / 2;
                    if (newlyPlacedIds.current.has(block.id)) {
                        newlyPlacedIds.current.delete(block.id);
                        g.y = -curBlockSize * 2;
                        g.alpha = 0;
                        gsap.to(g, { y: targetY, alpha: 1, duration: 0.45, ease: 'bounce.out', delay: block.dropDelay ?? 0 });
                    } else {
                        g.y = targetY;
                    }
                    layer.addChild(g);
                    blockGraphicsMap.current.set(block.id, g);
                } else {
                    // 空マス：DefensePhaseのグリッドを透かすため何も描画しない
                }
            });
        });
        // 行がない場合（初期化前）も描画不要（DefensePhaseを透かす）
        renderLinks();
    }, [curBlockSize, curRows, curCols, createBlockGraphics, renderLinks]);

    const precomputePatterns = useCallback(() => {
        precomputedPatterns.current = activeRecipesRef.current.map(recipe => {
            const patterns: number[][][] = [];
            const p = recipe.pattern;
            for (let rot = 0; rot < 4; rot++) {
                const rotated = patterns.length === 0 ? p : rotatePattern(patterns[patterns.length - 1]);
                patterns.push(rotated);
            }
            return { recipe, patterns };
        });
    }, []);

    const rotatePattern = (p: number[][]) => {
        const rows = p.length, cols = p[0].length;
        const res = Array(cols).fill(0).map(() => Array(rows).fill(0));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) res[c][rows - 1 - r] = p[r][c];
        return res;
    };

    const findMatches = useCallback(() => {
        const summons: SummonedUnit[] = [];
        const recipeIds: string[] = [];
        const matchGroups: { r: number; c: number }[][] = [];
        const newMatchedCells = new Set<string>();
        // 同一レシピ×同一セル集合の重複召喚を防ぐ
        const seenMatchKeys = new Set<string>();

        precomputedPatterns.current.forEach(({ recipe, patterns }) => {
            patterns.forEach(p => {
                const pR = p.length, pC = p[0].length;
                for (let r = 0; r <= curRows - pR; r++) {
                    for (let c = 0; c <= curCols - pC; c++) {
                        let match = true;
                        let wildcardType = -1;
                        let wildcardR = -1;
                        let wildcardC = -1;
                        const currentMatchCells: { r: number, c: number }[] = [];

                        for (let pr = 0; pr < pR; pr++) {
                            for (let pc = 0; pc < pC; pc++) {
                                const patternVal = p[pr][pc];
                                if (patternVal === -1) continue;
                                const cell = gridRef.current[r + pr][c + pc];
                                if (!cell || cell.isSummoned) { match = false; break; }

                                if (patternVal === 9) {
                                    if (wildcardType === -1) {
                                        wildcardType = cell.type;
                                        wildcardR = r + pr;
                                        wildcardC = c + pc;
                                    } else if (wildcardType !== cell.type) {
                                        match = false;
                                        break;
                                    }
                                } else {
                                    if (cell.type !== patternVal) {
                                        match = false;
                                        break;
                                    }
                                }
                                currentMatchCells.push({ r: r + pr, c: c + pc });
                            }
                            if (!match) break;
                        }

                        if (match) {
                            // 同一レシピ×同一セル集合チェック（回転違いの重複排除）
                            const cellKey = recipe.id + ':' + currentMatchCells.map(c => `${c.r},${c.c}`).sort().join('|');
                            if (seenMatchKeys.has(cellKey)) continue;
                            seenMatchKeys.add(cellKey);

                            currentMatchCells.forEach(cell => {
                                newMatchedCells.add(`${cell.r},${cell.c}`);
                            });

                            let unitType = recipe.id;
                            if (wildcardType !== -1 && recipe.resultMap) {
                                unitType = recipe.resultMap[wildcardType] || recipe.id;
                            }

                            // Use wildcard position if available, else center
                            const targetR = wildcardR !== -1 ? wildcardR : r + Math.floor(pR / 2);
                            const targetC = wildcardC !== -1 ? wildcardC : c + Math.floor(pC / 2);

                            summons.push({
                                id: generateId(), type: unitType,
                                r: targetR, c: targetC,
                                attackBonus: 0, hpBonus: 0
                            });
                            recipeIds.push(recipe.id);
                            matchGroups.push([...currentMatchCells]);
                        }
                    }
                }
            });
        });
        matchedCellsRef.current = newMatchedCells;
        
        // Prevent infinite loop by only updating if the content changed
        if (JSON.stringify(expectedSummons) !== JSON.stringify(summons)) {
            setExpectedSummons(summons);
        }
        
        const used = Array(curRows).fill(null).map((_, r) =>
            Array(curCols).fill(null).map((_, c) => newMatchedCells.has(`${r},${c}`))
        );
        return { used, matchedCells: newMatchedCells, summons, recipeIds, matchGroups };
    }, [curRows, curCols, generateId, setExpectedSummons]);

    // 召喚処理（コンボ演出のみ。素材は消費しない）
    const handleSummon = useCallback((onComplete?: (summons: SummonedUnit[]) => void) => {
        const result = findMatches();
        if (!result) { onComplete?.([]); return; }
        const { summons, matchGroups } = result;
        if (summons.length === 0) { onComplete?.([]); return; }

        // 1召喚ごとにコンボ演出
        const STEP_MS = 450;
        matchGroups.forEach((cells, i) => {
            setTimeout(() => {
                setFlashCells(cells);
                setComboCount(i + 1);
                setComboKey(k => k + 1);
                playComboSound(i + 1);
                setTimeout(() => setFlashCells([]), 380);
            }, i * STEP_MS);
        });

        // 全演出終了後にコールバック（素材はそのまま、グリッド変更なし）
        const totalAnimMs = (matchGroups.length - 1) * STEP_MS + 420;
        setTimeout(() => {
            setTimeout(() => setComboCount(0), 1400);
            onComplete?.(summons);
        }, totalAnimMs);
    }, [findMatches, saveRitualGrid, playComboSound]);

    useEffect(() => {
        activeRecipesRef.current = activeRecipes;
        precomputePatterns();
        initPool();

        if (gridInitialized.current) return;
        gridInitialized.current = true;

        // グリッドを復元（ピース落下はレシピ選択後に行う）
        let targetGrid: (any | null)[][] = [];
        if (storedGrid && storedGrid.length > 0) {
            targetGrid = storedGrid.map(row => row ? [...row] : []);
        } else {
            targetGrid = Array(curRows).fill(null).map(() => Array(curCols).fill(null));
        }
        gridRef.current = targetGrid;
    }, [activeRecipes, storedGrid, curRows, curCols, currentDay]);

    // レシピ選択後にピース落下（選択レシピのblockPoolが確定してから）
    const piecesDroppedThisDay = useRef(false);

    useEffect(() => {
        piecesDroppedThisDay.current = false;
    }, [currentDay]);

    const dropNewPieces = useCallback((drawCount: number) => {
        const pool = blockPool.current;
        const rnd = () => Math.random().toString(36).substr(2, 9);
        const drawOne = () => pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * 3);
        const targetGrid = gridRef.current.map(row => row ? [...row] : Array(curCols).fill(null));
        for (let i = 0; i < drawCount; i++) {
            const t0 = drawOne(); const t1 = drawOne();
            const candidates: { r0: number; c0: number; r1: number; c1: number }[] = [];
            for (let r = 0; r < curRows; r++) {
                for (let c = 0; c < curCols; c++) {
                    if (!targetGrid[r][c]) {
                        if (c + 1 < curCols && !targetGrid[r][c + 1]) candidates.push({ r0: r, c0: c, r1: r, c1: c + 1 });
                        if (r + 1 < curRows && !targetGrid[r + 1][c]) candidates.push({ r0: r, c0: c, r1: r + 1, c1: c });
                    }
                }
            }
            if (candidates.length === 0) break;
            const choice = candidates[Math.floor(Math.random() * candidates.length)];
            const groupId = `g-${rnd()}`;
            const id0 = rnd(); const id1 = rnd();
            const delay = i * 0.07;
            newlyPlacedIds.current.add(id0);
            newlyPlacedIds.current.add(id1);
            targetGrid[choice.r0][choice.c0] = { id: id0, type: t0, row: choice.r0, col: choice.c0, groupId, dropDelay: delay };
            targetGrid[choice.r1][choice.c1] = { id: id1, type: t1, row: choice.r1, col: choice.c1, groupId, dropDelay: delay + 0.035 };
        }
        gridRef.current = targetGrid;
        setGrid([...targetGrid.map(r => [...r])]);
        saveRitualGrid(targetGrid);
    }, [curRows, curCols, saveRitualGrid]);

    // Day1: 初期レシピ装備済みなのでblockPool確定後に自動落下
    useEffect(() => {
        if (currentDay !== 1) return;
        if (piecesDroppedThisDay.current) return;
        if (activeRecipes.length === 0) return;
        piecesDroppedThisDay.current = true;
        dropNewPieces(15); // Day1=15ツモ(30p)
    }, [currentDay, activeRecipes, dropNewPieces]);

    // Day2以降: レシピ選択後にドロップ
    useEffect(() => {
        if (currentDay === 1) return;
        if (pickedRecipeId === null) return;
        if (piecesDroppedThisDay.current) return;
        if (!activeRecipes.find(r => r.id === pickedRecipeId)) return;
        piecesDroppedThisDay.current = true;
        dropNewPieces(2); // Day2+=2ツモ(4p)
    }, [pickedRecipeId, activeRecipes, currentDay, dropNewPieces]);

    useEffect(() => {
        // DefensePhaseが所有する共有PIXIアプリを使う（自前アプリは作らない）
        const app = pixiAppRef.current;
        if (!app) return;
        appRef.current = app;

        // 儀式レイヤー群を共有ステージの最前面に追加
        const bg = new PIXI.Graphics(); app.stage.addChild(bg); bgLayerRef.current = bg;
        const boost = new PIXI.Container(); app.stage.addChild(boost); boostLayerRef.current = boost;
        const links = new PIXI.Container(); app.stage.addChild(links); linksLayerRef.current = links;
        const blocks = new PIXI.Container(); app.stage.addChild(blocks); blocksLayerRef.current = blocks;
        const usage = new PIXI.Graphics(); app.stage.addChild(usage); usageLayerRef.current = usage;
        const preview = new PIXI.Container(); app.stage.addChild(preview); previewLayerRef.current = preview;
        blocks.sortableChildren = true;

        // レイヤー構築後にグリッドを描画（pixiAppVersionが変わってレイヤーが作り直された場合もここで復元）
        const result = findMatches();
        renderGrid(result?.matchedCells);

        // アンマウント時：儀式レイヤーを共有ステージから除去（アプリ自体は破棄しない）
        return () => {
            [bgLayerRef, boostLayerRef, linksLayerRef, blocksLayerRef, usageLayerRef, previewLayerRef].forEach(ref => {
                if (ref.current && !(ref.current as any).destroyed) {
                    app.stage.removeChild(ref.current as any);
                    (ref.current as any).destroy({ children: true });
                }
                ref.current = null;
            });
            appRef.current = null;
        };
    }, [pixiAppVersion, pixiAppRef, renderGrid, findMatches]);

    useEffect(() => {
        const result = findMatches();
        renderGrid(result?.matchedCells);
    }, [grid, renderGrid, findMatches]);

    const comboLabel = comboCount >= 5 ? '🔥 FEVER!!' : comboCount >= 3 ? '⚡ GREAT!' : `${comboCount} COMBO!`;
    const comboColor = comboCount >= 5 ? '#ff4400' : comboCount >= 3 ? '#ffaa00' : '#66ddff';

    // 召喚プレビュー（現在マッチしている魔物リスト）
    const summonPreview = expectedSummons.reduce<Record<string, number>>((acc, u) => {
        acc[u.type] = (acc[u.type] || 0) + 1; return acc;
    }, {});

    // レシピパターン簡易表示用
    const PIECE_COLORS_HEX: Record<number, string> = { 0: '#5577ff', 1: '#ff5544', 2: '#44ddaa' };
    const PatternPreview = ({ pattern }: { pattern: number[][] }) => {
        const cols = Math.max(...pattern.map(r => r.length));
        return (
            <div style={{ display: 'inline-grid', gridTemplateColumns: `repeat(${cols}, 12px)`, gap: '2px' }}>
                {pattern.flatMap((row, ri) => row.map((val, ci) => (
                    <div key={`${ri}-${ci}`} style={{
                        width: 12, height: 12, borderRadius: 2,
                        background: val === -1 ? 'transparent' : val === 9 ? '#ffdd44' : (PIECE_COLORS_HEX[val] ?? '#888'),
                        border: val === 9 ? '1px solid #ffaa00' : 'none',
                        opacity: val === -1 ? 0 : 1
                    }} />
                )))}
            </div>
        );
    };

    const panelSlot = document.getElementById('ritual-panel-slot');
    const bottomSlot = document.getElementById('ritual-bottom-slot');
    const panelBottomSlot = document.getElementById('ritual-panel-bottom-slot');

    // ───── 左パネル：レシピ・図鑑・戦闘へ ─────
    const leftPanel = (
        <>
        <div style={{
            width: SIDE_PANEL_WIDTH, height: '100%',
            background: 'rgba(8,6,18,0.96)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
            {/* ヘッダー */}
            <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid #1a1030', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#cc88ff', fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px' }}>☽ 召喚儀式</span>
                    <span style={{ color: '#886699', fontSize: '11px' }}>Day {currentDay}</span>
                </div>
                <div style={{ marginTop: '6px', color: '#ffd700', fontSize: '13px', fontWeight: 'bold' }}>
                    💰 {money} G
                </div>
            </div>

            {/* 召喚プレビュー */}
            {Object.keys(summonPreview).length > 0 && (
                <div style={{ padding: '6px 14px', borderBottom: '1px solid #1a1030', flexShrink: 0 }}>
                    <div style={{ color: '#aabb88', fontSize: '10px', marginBottom: '4px' }}>✨ 召喚できる魔物</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {Object.entries(summonPreview).map(([type, count]) => (
                            <span key={type} style={{ background: '#1a2a1a', border: '1px solid #336633', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: '#aaddaa' }}>
                                {getMonsterDisplayName(type)} ×{count}
                            </span>
                        ))}
                    </div>
                </div>
            )}

        </div>
        {isBestiaryOpen && <BestiaryModal isOpen={isBestiaryOpen} onClose={() => setIsBestiaryOpen(false)} />}
        </>
    );

    // ───── 左パネル下部（売却ゾーン＋戦闘へ） ─────
    const panelBottomContent = (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '6px 8px', gap: '6px' }}>
            {/* 売却ゾーン */}
            <div ref={sellZoneRef} style={{
                flex: 1, padding: '6px',
                border: `2px dashed ${isDraggingSummoned ? '#ff8844' : '#3a2030'}`,
                borderRadius: '8px',
                background: isDraggingSummoned ? 'rgba(255,80,20,0.12)' : 'rgba(20,10,15,0.6)',
                textAlign: 'center', transition: 'all 0.15s',
                pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            }}>
                <div style={{ fontSize: '16px', lineHeight: 1 }}>💰</div>
                <div style={{ color: isDraggingSummoned ? '#ff8844' : '#553344', fontSize: '9px', marginTop: '2px' }}>
                    {isDraggingSummoned ? '売却 +10G' : '売却ゾーン'}
                </div>
            </div>
            {/* 戦闘へ */}
            <button
                disabled={showRecipeSelect}
                onClick={() => {
                    handleSummon((summons) => {
                        if (summons.length > 0) addSummonedMonsters(summons);
                        saveRitualGrid(gridRef.current.map(row => row ? [...row] : []));
                        setPhase('BATTLE');
                    });
                }}
                style={{ flexShrink: 0, padding: '10px', background: 'linear-gradient(135deg, #4a0a0a, #7a1a1a)', color: '#ffaaaa', border: '1px solid #882222', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold', cursor: showRecipeSelect ? 'not-allowed' : 'pointer', opacity: showRecipeSelect ? 0.5 : 1 }}>
                ⚔️ 戦闘へ
            </button>
        </div>
    );

    // ───── 下アクションバー（レシピ横並び） ─────
    const bottomContent = (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', padding: '0 14px', gap: '12px', boxSizing: 'border-box' }}>
            <div style={{ color: '#554466', fontSize: '10px', letterSpacing: '1px', flexShrink: 0 }}>📜</div>
            {activeRecipes.map(recipe => (
                <div key={recipe.id} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', flexShrink: 0
                }}>
                    <div style={{
                        background: '#100c1c', border: '1px solid #2a1a3a',
                        borderRadius: '6px',
                        width: '64px', height: '64px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <PatternPreview pattern={recipe.pattern} />
                    </div>
                    <div style={{ fontSize: '9px', color: '#886699', letterSpacing: '0.5px', width: '64px', textAlign: 'center' }}>
                        {recipe.name}
                    </div>
                </div>
            ))}
        </div>
    );

    // ───── SHOPオーバーレイ ─────
    const MATERIAL_NAMES: Record<number, string> = { 0: '骨', 1: '肉', 2: '霊' };
    const recipeSelectOverlay = showRecipeSelect && (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(4, 2, 12, 0.97)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '24px 32px', gap: '0',
        }}>
            {/* ヘッダー */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', maxWidth: '860px', marginBottom: '20px',
            }}>
                <div>
                    <div style={{ fontSize: '10px', color: '#554466', letterSpacing: '4px' }}>DAY {currentDay}</div>
                    <div style={{ fontSize: '22px', color: '#ccaaff', fontWeight: 'bold', letterSpacing: '3px' }}>SHOP</div>
                </div>
                <div style={{
                    background: '#1a1228', border: '1px solid #3a2040',
                    borderRadius: '8px', padding: '8px 16px',
                    fontSize: '18px', color: '#ffd700', fontWeight: 'bold',
                }}>
                    💰 {money} G
                </div>
            </div>

            {/* メインコンテンツ：レシピ上段 ＋ レリック下段 */}
            <div style={{ width: '100%', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* レシピ section */}
                <div style={{ background: 'rgba(20,10,35,0.8)', border: '1px solid #2a1040', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <span style={{ fontSize: '12px', color: '#886699', letterSpacing: '2px' }}>📜 新レシピ</span>
                        <span style={{ fontSize: '10px', color: '#554466' }}>— 1つ選択</span>
                        {pickedRecipeId && <span style={{ fontSize: '10px', color: '#66bb66', marginLeft: '4px' }}>✓ 選択済み</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {offeredRecipes.map(recipe => {
                            const stats = UNIT_STATS[recipe.id];
                            const materials = recipe.pattern.flat().filter(v => v >= 0 && v !== 9);
                            const materialCounts: Record<number, number> = {};
                            materials.forEach(v => { materialCounts[v] = (materialCounts[v] ?? 0) + 1; });
                            const isPicked = pickedRecipeId === recipe.id;
                            const isDisabled = pickedRecipeId !== null && !isPicked;
                            return (
                                <div key={recipe.id}
                                    onClick={() => { if (!isDisabled) { addEquippedRecipe(recipe.id); setPickedRecipeId(recipe.id); } }}
                                    onMouseEnter={e => { if (!isDisabled) (e.currentTarget as HTMLDivElement).style.borderColor = isPicked ? '#66cc66' : '#aa77ff'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = isPicked ? '#44aa44' : isDisabled ? '#221133' : '#5533aa'; }}
                                    style={{
                                        background: isPicked ? '#081808' : isDisabled ? '#080612' : '#0e0820',
                                        border: `2px solid ${isPicked ? '#44aa44' : isDisabled ? '#221133' : '#5533aa'}`,
                                        borderRadius: '10px', padding: '14px 16px',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                                        cursor: isDisabled ? 'default' : 'pointer',
                                        opacity: isDisabled ? 0.35 : 1,
                                        transition: 'border-color 0.12s',
                                    }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: isPicked ? '#88ff88' : '#ddbbff' }}>
                                        {isPicked && '✓ '}{recipe.name}
                                    </div>
                                    {/* パターン固定サイズ枠 */}
                                    <div style={{ width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${recipe.pattern[0].length}, 20px)` }}>
                                            {recipe.pattern.map((rowArr, ri) => rowArr.map((val, ci) => (
                                                <div key={`${ri}-${ci}`} style={{
                                                    width: 20, height: 20, borderRadius: 3,
                                                    backgroundColor: val === -1 ? 'transparent' : val === 9 ? '#333' : COLOR_HEX[val] ?? '#333',
                                                    border: val !== -1 ? '1px solid #444' : 'none',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px',
                                                }}>{val === 9 ? '✕' : val >= 0 ? PIECE_EMOJIS[val] : ''}</div>
                                            )))}
                                        </div>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#776688', display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                        {Object.entries(materialCounts).map(([k, cnt]) => (
                                            <span key={k}>{PIECE_EMOJIS[Number(k)]}{MATERIAL_NAMES[Number(k)]}×{cnt}</span>
                                        ))}
                                    </div>
                                    {stats && (
                                        <div style={{ fontSize: '10px', color: '#8899aa', display: 'flex', gap: '10px' }}>
                                            <span>❤️ {stats.hp}</span><span>⚔️ {stats.attack}</span><span>🏹 {stats.range}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* レリック section */}
                <div style={{ background: 'rgba(20,10,35,0.8)', border: '1px solid #2a1040', borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ fontSize: '12px', color: '#886699', letterSpacing: '2px', marginBottom: '14px' }}>🏪 レリック</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                        {offeredRelics.map(relic => {
                            const owned = ownedRelics.includes(relic.id);
                            const canAfford = money >= relic.price;
                            return (
                                <div key={relic.id} style={{
                                    background: owned ? '#081208' : '#0e0820',
                                    border: `1px solid ${owned ? '#1a3a1a' : canAfford ? '#3a1858' : '#1a1030'}`,
                                    borderRadius: '10px', padding: '14px 16px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                                    opacity: owned ? 0.45 : 1,
                                }}>
                                    <div style={{ fontSize: '26px', lineHeight: 1 }}>{relic.icon}</div>
                                    <div style={{ fontSize: '13px', color: '#ccaaff', fontWeight: 'bold', textAlign: 'center' }}>{relic.name}</div>
                                    <div style={{ fontSize: '9px', color: '#664466', lineHeight: 1.5, textAlign: 'center', flex: 1 }}>{relic.description}</div>
                                    <div style={{ fontSize: '14px', color: canAfford ? '#ffd700' : '#554400', fontWeight: 'bold', marginTop: '2px' }}>
                                        {relic.price} G
                                    </div>
                                    <button
                                        disabled={owned || !canAfford}
                                        onClick={() => { if (spendMoney(relic.price)) addRelic(relic.id); }}
                                        style={{
                                            width: '100%', padding: '6px 0',
                                            background: owned ? '#0d1a0d' : canAfford ? 'linear-gradient(135deg, #3a0a6a, #5a1a8a)' : '#100c18',
                                            color: owned ? '#335533' : canAfford ? '#ddaaff' : '#332244',
                                            border: `1px solid ${owned ? '#1a3a1a' : canAfford ? '#6622aa' : '#1a1030'}`,
                                            borderRadius: '6px', fontSize: '11px', fontWeight: 'bold',
                                            cursor: (owned || !canAfford) ? 'not-allowed' : 'pointer',
                                        }}>
                                        {owned ? '✓ 入手済み' : canAfford ? '購入する' : '所持金不足'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 進むボタン */}
            <button onClick={() => setShowRecipeSelect(false)} style={{
                marginTop: '20px',
                padding: '11px 48px',
                background: 'linear-gradient(135deg, #2a0808, #5a1212)',
                color: '#ffaaaa', border: '1px solid #662222',
                borderRadius: '8px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer',
                letterSpacing: '2px',
            }}>
                ⚔️ 儀式へ進む
            </button>
        </div>
    );

    return (
        <>
            {recipeSelectOverlay && ReactDOM.createPortal(recipeSelectOverlay, document.body)}
            {/* ───── 盤面オーバーレイ（フラッシュ・コンボ演出） ───── */}
            <div style={{ width: curWidth, height: '100%', position: 'relative', pointerEvents: 'none' }}
                onClick={() => setPinnedPiece(null)}>
                <style>{`
                    @keyframes comboAppear {
                        0%   { opacity: 0; transform: scale(0.4); }
                        15%  { opacity: 1; transform: scale(1.25); }
                        30%  { transform: scale(1.0); }
                        60%  { opacity: 1; }
                        100% { opacity: 0; transform: scale(1.1) translateY(-30px); }
                    }
                    @keyframes cellFlash {
                        0%   { opacity: 1; transform: scale(1.12); }
                        60%  { opacity: 0.8; }
                        100% { opacity: 0; transform: scale(1.0); }
                    }
                `}</style>

                {/* マッチセルのフラッシュ */}
                {flashCells.map((cell, i) => (
                    <div key={i} style={{
                        position: 'absolute',
                        left: cell.c * curBlockSize,
                        top: cell.r * curBlockSize,
                        width: curBlockSize,
                        height: curBlockSize,
                        borderRadius: 8,
                        background: `${comboColor}44`,
                        border: `3px solid ${comboColor}`,
                        boxShadow: `0 0 12px ${comboColor}`,
                        pointerEvents: 'none',
                        animation: 'cellFlash 0.4s ease-out forwards',
                        zIndex: 50,
                    }} />
                ))}

                {/* コンボテキスト */}
                {comboCount >= 1 && (
                    <div key={comboKey} style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: curHeight,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        pointerEvents: 'none', zIndex: 100,
                        animation: 'comboAppear 1.4s ease-out forwards'
                    }}>
                        <div style={{
                            fontSize: comboCount >= 5 ? '64px' : '48px', fontWeight: 900,
                            color: comboColor,
                            textShadow: `0 0 20px ${comboColor}, 0 0 40px ${comboColor}, 2px 2px 0 #000`,
                            letterSpacing: '4px', userSelect: 'none',
                        }}>{comboLabel}</div>
                    </div>
                )}
            </div>

            {/* ───── ユニットピース情報ポップアップ ───── */}
            {pinnedPiece && (() => {
                const stats = UNIT_STATS[pinnedPiece.monsterType];
                if (!stats) return null;
                const name = getMonsterDisplayName(pinnedPiece.monsterType);
                const abilities = stats.passiveAbilities ?? [];
                return (
                    <div ref={pinnedPieceInfoRef} style={{
                            position: 'absolute',
                            top: pinnedPiece.pos.y + 12,
                            left: Math.max(4, pinnedPiece.pos.x - 190),
                            backgroundColor: 'rgba(0,0,0,0.92)',
                            color: '#fff',
                            padding: '10px 14px',
                            borderRadius: '6px',
                            border: '1px solid #aaffaa',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
                            minWidth: '170px',
                            zIndex: 9999,
                            pointerEvents: 'auto',
                        }} onPointerDown={e => e.stopPropagation()}>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#aaffaa', marginBottom: '6px' }}>{name}</div>
                            <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                                <span style={{ color: '#aaffaa' }}>HP: {stats.maxHp}</span>
                                <span style={{ color: '#ffaaaa' }}>ATK: {stats.attack}</span>
                                <span style={{ color: '#aaaaff' }}>射程: {stats.range}</span>
                                <span style={{ color: '#ffff88' }}>速度: {(stats.speed ?? 0).toFixed(1)}</span>
                            </div>
                            {abilities.length > 0 && (
                                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #333', fontSize: '11px', color: '#cc88ff' }}>
                                    {abilities.map((pa, i) => (
                                        <div key={i}>★ {PASSIVE_DESCRIPTIONS[pa.type] ?? pa.type}</div>
                                    ))}
                                </div>
                            )}
                    </div>
                );
            })()}

            {/* ───── デバッグ: 敵軍パターン選択 ───── */}
            {import.meta.env.DEV && ReactDOM.createPortal(
                <div style={{
                    position: 'fixed', bottom: 12, right: 12, zIndex: 9999,
                    background: 'rgba(0,0,0,0.85)', border: '1px solid #444',
                    borderRadius: '8px', padding: '8px 12px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    fontSize: '11px', color: '#aaa',
                }}>
                    <span style={{ color: '#ff8844', fontWeight: 'bold' }}>🛠 DEV</span>
                    <span>敵軍:</span>
                    <select
                        value={currentPattern}
                        onChange={e => setPattern(e.target.value)}
                        style={{
                            background: '#1a1a2e', color: '#ccc',
                            border: '1px solid #555', borderRadius: '4px',
                            padding: '2px 4px', fontSize: '11px', cursor: 'pointer',
                        }}
                    >
                        <option value="random">ランダム（day依存）</option>
                        <option value="turtle">① 亀甲陣</option>
                        <option value="swarm">② 雪崩</option>
                        <option value="archer_wall">③ 弓兵殲滅陣</option>
                        <option value="vip_guard">④ 精鋭護衛隊（day4+）</option>
                        <option value="lane_rush">⑤ 縦割り突撃</option>
                        <option value="priest_loop">⑥ 支援完結型</option>
                        <option value="phased">⑦ 波状攻撃</option>
                        <option value="speed_rush">⑧ 奇襲隊</option>
                    </select>
                    <button
                        onClick={() => generateWave(currentDay, currentPattern)}
                        style={{
                            background: '#2a1a3e', color: '#cc88ff',
                            border: '1px solid #664488', borderRadius: '4px',
                            padding: '2px 10px', fontSize: '11px', cursor: 'pointer',
                        }}
                    >
                        適用
                    </button>
                </div>,
                document.body
            )}

            {/* ───── ポータル描画 ───── */}
            {panelSlot && ReactDOM.createPortal(leftPanel, panelSlot)}
            {bottomSlot && ReactDOM.createPortal(bottomContent, bottomSlot)}
            {panelBottomSlot && ReactDOM.createPortal(panelBottomContent, panelBottomSlot)}
        </>
    );
};

export default RitualPhase;
