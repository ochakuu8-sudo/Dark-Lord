import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { useGame } from '../contexts/GameContext';
import {
    COLORS, PIECE_EMOJIS, ALL_RECIPES, AP_GAUGE_MAX, AP_GAUGE_PER_MATCH,
    type Recipe
} from '../game/config';
import { UNIT_STATS } from '../game/entities';
import type { SummonedUnit } from '../contexts/GameContext';
import BestiaryModal from './BestiaryModal';

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

import { ROWS, COLS, BLOCK_SIZE } from '../game/config';

const RitualPhase: React.FC = () => {
    const {
        activeRecipes, addSummonedMonsters,
        setPhase,
        ritualGrid: storedGrid, saveRitualGrid,
        setExpectedSummons,
        expectedSummons,
        ap, spendAp,
        apGauge, addApGauge,
        fieldWidth
    } = useGame();

    const curRows = ROWS;
    const curCols = COLS;
    const curBlockSize = BLOCK_SIZE;
    const curWidth = COLS * BLOCK_SIZE;
    const curHeight = ROWS * BLOCK_SIZE;

    // 状態の初期化
    const pixiContainerRef = useRef<HTMLDivElement>(null);
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

    const [hasSummoned, setHasSummoned] = useState(false);
    const [comboCount, setComboCount] = useState(0);
    const [comboKey, setComboKey] = useState(0); // アニメーション再トリガー用

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
            // 金色の光彩
            const glow = new PIXI.Graphics();
            glow.beginFill(unitColor, 0.25);
            glow.drawRoundedRect(-curBlockSize / 2 - 4, -curBlockSize / 2 - 4, curBlockSize + 8, curBlockSize + 8, 16);
            glow.endFill();
            container.addChild(glow);
            gsap.to(glow, { alpha: 0.6, duration: 0.9, repeat: -1, yoyo: true, ease: "sine.inOut" });
            // 背景
            const bg = new PIXI.Graphics();
            bg.beginFill(0x1a1000);
            bg.drawRoundedRect(-curBlockSize / 2 + 2, -curBlockSize / 2 + 2, curBlockSize - 4, curBlockSize - 4, 12);
            bg.endFill();
            container.addChild(bg);
            // 枠（金色）
            const edge = new PIXI.Graphics();
            edge.lineStyle(2, unitColor, 1.0);
            edge.drawRoundedRect(-curBlockSize / 2 + 5, -curBlockSize / 2 + 5, curBlockSize - 10, curBlockSize - 10, 10);
            container.addChild(edge);
            // 魔物アイコン
            const iconTxt = new PIXI.Text('👹', new PIXI.TextStyle({ fontSize: Math.floor(curBlockSize * 0.42), align: 'center' }));
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

            container.hitArea = new PIXI.Rectangle(-curBlockSize / 2, -curBlockSize / 2, curBlockSize, curBlockSize);
            container.eventMode = 'static'; container.cursor = 'pointer';
            container.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
                if (interactionParams.current.isDragging) return;
                interactionParams.current.selectedGroup = [block];
                interactionParams.current.isDragging = true;
                const startGlobalX = event.global.x;
                const startGlobalY = event.global.y;
                const gfx = blockGraphicsMap.current.get(block.id);
                const initX = gfx?.x ?? (block.col * curBlockSize + curBlockSize / 2);
                const initY = gfx?.y ?? (block.row * curBlockSize + curBlockSize / 2);
                if (gfx) { gsap.killTweensOf(gfx); gfx.zIndex = 100; gfx.scale.set(1.1); }
                blocksLayerRef.current?.sortChildren();
                if (!appRef.current) return;
                const canvas = appRef.current.view as HTMLCanvasElement;
                const onPointerMove = (e: PointerEvent) => {
                    const rect = canvas.getBoundingClientRect();
                    const px = (e.clientX - rect.left) * (curWidth / rect.width);
                    const py = (e.clientY - rect.top) * (curHeight / rect.height);
                    if (gfx) { gfx.x = initX + (px - startGlobalX); gfx.y = initY + (py - startGlobalY); }
                    renderLinks();
                };
                const onPointerUp = () => {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerUp);
                    if (!gfx) { interactionParams.current.isDragging = false; return; }
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

            let rafId: number | null = null;
            const onPointerMove = (moveEvent: PointerEvent) => {
                if (!interactionParams.current.isDragging) return;
                const rect = canvas.getBoundingClientRect();
                const pixiX = (moveEvent.clientX - rect.left) * (curWidth / rect.width);
                const pixiY = (moveEvent.clientY - rect.top) * (curHeight / rect.height);
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
                    // 空マスのプレースホルダー描画
                    const empty = new PIXI.Graphics();
                    // 薄い背景
                    empty.beginFill(0x111118, 0.5);
                    empty.drawRoundedRect(-curBlockSize / 2 + 4, -curBlockSize / 2 + 4, curBlockSize - 8, curBlockSize - 8, 10);
                    empty.endFill();
                    // 点線風の枠
                    empty.lineStyle(1, 0x333344, 0.6);
                    empty.drawRoundedRect(-curBlockSize / 2 + 6, -curBlockSize / 2 + 6, curBlockSize - 12, curBlockSize - 12, 8);
                    // 中央に小さな十字マーク
                    empty.lineStyle(1, 0x222233, 0.4);
                    empty.moveTo(-6, 0); empty.lineTo(6, 0);
                    empty.moveTo(0, -6); empty.lineTo(0, 6);

                    empty.x = ci * curBlockSize + curBlockSize / 2;
                    empty.y = ri * curBlockSize + curBlockSize / 2;
                    layer.addChild(empty);
                }
            });
        });
        // 行がない場合（初期化前）全マスにプレースホルダーを描画
        if (!gridRef.current || gridRef.current.length === 0) {
            for (let ri = 0; ri < curRows; ri++) {
                for (let ci = 0; ci < curCols; ci++) {
                    const empty = new PIXI.Graphics();
                    empty.beginFill(0x111118, 0.5);
                    empty.drawRoundedRect(-curBlockSize / 2 + 4, -curBlockSize / 2 + 4, curBlockSize - 8, curBlockSize - 8, 10);
                    empty.endFill();
                    empty.lineStyle(1, 0x333344, 0.6);
                    empty.drawRoundedRect(-curBlockSize / 2 + 6, -curBlockSize / 2 + 6, curBlockSize - 12, curBlockSize - 12, 8);
                    empty.lineStyle(1, 0x222233, 0.4);
                    empty.moveTo(-6, 0); empty.lineTo(6, 0);
                    empty.moveTo(0, -6); empty.lineTo(0, 6);
                    empty.x = ci * curBlockSize + curBlockSize / 2;
                    empty.y = ri * curBlockSize + curBlockSize / 2;
                    layer.addChild(empty);
                }
            }
        }
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
                                if (!cell) { match = false; break; }

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
                        }
                    }
                }
            });
        });
        matchedCellsRef.current = newMatchedCells;
        
        // Prevent infinite loop by only updating if the content changed
        setExpectedSummons(prev => {
            if (JSON.stringify(prev) === JSON.stringify(summons)) return prev;
            return summons;
        });
        
        const used = Array(curRows).fill(null).map((_, r) =>
            Array(curCols).fill(null).map((_, c) => newMatchedCells.has(`${r},${c}`))
        );
        return { used, matchedCells: newMatchedCells, summons };
    }, [curRows, curCols, generateId, setExpectedSummons]);

    const handleDropMaterial = useCallback(() => {
        if (!spendAp(1)) return;
        const pool = blockPool.current;
        const drawOne = () => pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * 3);
        const t0 = drawOne();
        const t1 = drawOne();
        const ng = gridRef.current.map(row => row ? [...row] : Array(curCols).fill(null));
        const candidates: { r0: number; c0: number; r1: number; c1: number }[] = [];
        for (let r = 0; r < curRows; r++) {
            for (let c = 0; c < curCols; c++) {
                if (!ng[r][c]) {
                    if (c + 1 < curCols && !ng[r][c + 1]) candidates.push({ r0: r, c0: c, r1: r, c1: c + 1 });
                    if (r + 1 < curRows && !ng[r + 1][c]) candidates.push({ r0: r, c0: c, r1: r + 1, c1: c });
                }
            }
        }
        if (candidates.length === 0) return;
        const choice = candidates[Math.floor(Math.random() * candidates.length)];
        const groupId = `g-${generateId()}`;
        const id0 = generateId();
        const id1 = generateId();
        newlyPlacedIds.current.add(id0);
        newlyPlacedIds.current.add(id1);
        ng[choice.r0][choice.c0] = { id: id0, type: t0, row: choice.r0, col: choice.c0, groupId, dropDelay: 0 };
        ng[choice.r1][choice.c1] = { id: id1, type: t1, row: choice.r1, col: choice.c1, groupId, dropDelay: 0.05 };
        gridRef.current = ng;
        setGrid([...ng.map(r => [...r])]);
    }, [spendAp, curRows, curCols, generateId]);

    const handleSummon = useCallback(() => {
        const result = findMatches();
        if (!result) return;
        const { used, summons } = result;
        if (summons.length === 0) return;

        const ng = gridRef.current.map((row, ri) =>
            row ? row.map((cell, ci) => (cell && used[ri][ci] ? null : cell)) : Array(curCols).fill(null)
        );
        // 召喚された魔物を盤面に配置
        summons.forEach(unit => {
            const place = (r: number, c: number) => {
                if (ng[r] && ng[r][c] === null) {
                    ng[r][c] = { id: generateId(), type: -1, row: r, col: c, isSummoned: true, monsterType: unit.type };
                    return true;
                }
                return false;
            };
            if (!place(unit.r, unit.c)) {
                // 元の位置が埋まっていたら近くの空きマスを探す
                for (let r = 0; r < curRows; r++)
                    for (let c = 0; c < curCols; c++)
                        if (place(r, c)) return;
            }
        });

        gridRef.current = ng;
        setGrid([...ng.map(r => [...r])]);
        saveRitualGrid(ng);
        setHasSummoned(true);

        // コンボAPゲージ加算（マッチ数 × AP_GAUGE_PER_MATCH）
        addApGauge(summons.length * AP_GAUGE_PER_MATCH);

        // コンボ演出
        if (summons.length >= 2) {
            setComboCount(summons.length);
            setComboKey(k => k + 1);
        }
    }, [findMatches, curRows, curCols, generateId, saveRitualGrid, addApGauge]);

    useEffect(() => {
        activeRecipesRef.current = activeRecipes;
        precomputePatterns();
        initPool();

        if (gridInitialized.current) return;
        gridInitialized.current = true;

        let targetGrid: (any | null)[][] = [];
        if (storedGrid && storedGrid.length > 0) {
            targetGrid = storedGrid.map(row => row ? [...row] : []);
        } else {
            targetGrid = Array(curRows).fill(null).map(() => Array(curCols).fill(null));
        }

        // 10ツモ（20ピース）を盤面に配置してスタート（落下アニメーション付き）
        const pool = blockPool.current;
        const rnd = () => Math.random().toString(36).substr(2, 9);
        const drawOne = () => pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : Math.floor(Math.random() * 3);
        for (let i = 0; i < 10; i++) {
            const t0 = drawOne();
            const t1 = drawOne();
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

        // setGrid()を呼ばずgridRefだけ更新する。
        // setGrid()するとuseEffect([grid])が発火→renderGrid再実行→アニメーション中のgsapオブジェクトが破棄される。
        // PIXI初期化後のrenderGrid()1回でアニメーションを完結させる。
        gridRef.current = targetGrid;
        saveRitualGrid(targetGrid);
    }, [activeRecipes, storedGrid, curRows, curCols, saveRitualGrid]);

    useEffect(() => {
        if (!pixiContainerRef.current) return;
        const devicePixelRatio = window.devicePixelRatio || 1;
        // 高解像度ディスプレイかつ大きいキャンバスでのクラッシュ防止（合計ピクセル数を4096px幅相当に制限）
        const safeResolution = (curWidth * devicePixelRatio > 4096) ? Math.max(1, 4096 / curWidth) : devicePixelRatio;

        const app = new PIXI.Application({
            width: curWidth, height: curHeight,
            backgroundAlpha: 0,
            antialias: true, resolution: safeResolution
        });
        pixiContainerRef.current.appendChild(app.view as HTMLCanvasElement);
        appRef.current = app;
        const bg = new PIXI.Graphics(); app.stage.addChild(bg); bgLayerRef.current = bg;
        const boost = new PIXI.Container(); app.stage.addChild(boost); boostLayerRef.current = boost;
        const links = new PIXI.Container(); app.stage.addChild(links); linksLayerRef.current = links;
        const blocks = new PIXI.Container(); app.stage.addChild(blocks); blocksLayerRef.current = blocks;
        const usage = new PIXI.Graphics(); app.stage.addChild(usage); usageLayerRef.current = usage;
        const preview = new PIXI.Container(); app.stage.addChild(preview); previewLayerRef.current = preview;
        blocks.sortableChildren = true;
        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, curWidth, curHeight);
        // renderGrid()はここで呼ばない。
        // Effect順: グリッド初期化(1) → PIXI初期化(2) → [grid](3)
        // (2)でrenderGridを呼ぶと(3)がアニメーション中のオブジェクトを破棄してしまう。
        // (3)が実行される時点でPIXIは準備済みなので、(3)だけにレンダリングを任せる。
        return () => { blocksLayerRef.current = null; linksLayerRef.current = null; bgLayerRef.current = null; app.destroy(true, { children: true }); appRef.current = null; };
    }, [curWidth, curHeight, renderGrid]);

    useEffect(() => {
        const result = findMatches();
        renderGrid(result?.matchedCells);
    }, [grid, renderGrid, findMatches]);

    const comboLabel = comboCount >= 5 ? '🔥 FEVER!!' : comboCount >= 3 ? '⚡ GREAT!' : `${comboCount} COMBO!`;
    const comboColor = comboCount >= 5 ? '#ff4400' : comboCount >= 3 ? '#ffaa00' : '#66ddff';

    return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'transparent', position: 'relative' }}>
            {/* コンボ演出オーバーレイ */}
            {comboCount >= 2 && (
                <div key={comboKey} style={{
                    position: 'absolute', top: 0, left: 0, width: curWidth, height: curHeight,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', zIndex: 100,
                    animation: 'comboAppear 1.4s ease-out forwards'
                }}>
                    <style>{`
                        @keyframes comboAppear {
                            0%   { opacity: 0; transform: scale(0.4); }
                            15%  { opacity: 1; transform: scale(1.25); }
                            30%  { transform: scale(1.0); }
                            60%  { opacity: 1; }
                            100% { opacity: 0; transform: scale(1.1) translateY(-30px); }
                        }
                    `}</style>
                    <div style={{
                        fontSize: comboCount >= 5 ? '64px' : '48px',
                        fontWeight: 900,
                        color: comboColor,
                        textShadow: `0 0 20px ${comboColor}, 0 0 40px ${comboColor}, 2px 2px 0 #000`,
                        letterSpacing: '4px',
                        userSelect: 'none',
                    }}>
                        {comboLabel}
                    </div>
                </div>
            )}
            {/* キャンバス */}
            <div style={{ display: 'flex', flexDirection: 'row', gap: '0', width: '100%', justifyContent: 'flex-start', alignItems: 'flex-start', overflow: 'hidden' }}>
                <div ref={pixiContainerRef} style={{ width: curWidth, height: curHeight, boxShadow: '0 0 40px rgba(0,0,0,0.5)', border: '2px solid rgba(255,255,255,0.1)', background: 'transparent', display: 'block' }} />
            </div>
            <div style={{ height: '90px', background: '#121218', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', borderTop: '2px solid #222', padding: '6px 12px' }}>
                {/* APゲージ */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '500px' }}>
                    <span style={{ color: '#aaddff', fontSize: '12px', whiteSpace: 'nowrap' }}>AP {ap}</span>
                    <div style={{ flex: 1, height: '10px', background: '#1a1a2e', borderRadius: '5px', overflow: 'hidden', border: '1px solid #334' }}>
                        <div style={{
                            width: `${(apGauge / AP_GAUGE_MAX) * 100}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, #3355cc, #66aaff)',
                            borderRadius: '5px',
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                    <span style={{ color: '#556', fontSize: '11px', whiteSpace: 'nowrap' }}>{apGauge}/{AP_GAUGE_MAX}</span>
                </div>
                {/* ボタン行 */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => setIsBestiaryOpen(true)} style={{ padding: '6px 14px', background: '#522', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>図鑑</button>
                    <button
                        onClick={handleDropMaterial}
                        disabled={ap === 0}
                        style={{ padding: '6px 16px', background: ap > 0 ? '#333a55' : '#222', color: ap > 0 ? '#aaddff' : '#555', border: '1px solid ' + (ap > 0 ? '#5566aa' : '#333'), borderRadius: '4px', cursor: ap > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 'bold' }}
                    >
                        ⚡ 素材投入 (AP:{ap})
                    </button>
                    <button
                        onClick={handleSummon}
                        style={{ padding: '6px 20px', background: '#447', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        ✨ 召喚する
                    </button>
                    <button
                        onClick={() => {
                            const finalSummons: SummonedUnit[] = [];
                            gridRef.current.forEach((row, ri) => row?.forEach((cell, ci) => {
                                if (cell?.isSummoned && cell.monsterType) {
                                    finalSummons.push({ id: generateId(), type: cell.monsterType, r: ri, c: ci, attackBonus: 0, hpBonus: 0 });
                                }
                            }));
                            if (finalSummons.length > 0) addSummonedMonsters(finalSummons);
                            const ng = gridRef.current.map(row => row?.map(cell => cell?.isSummoned ? null : cell) || []);
                            saveRitualGrid(ng);
                            setPhase('BATTLE');
                        }}
                        style={{ padding: '6px 20px', background: '#a22', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                    >
                        ⚔️ 戦闘へ
                    </button>
                </div>
            </div>

            {isBestiaryOpen && <BestiaryModal isOpen={isBestiaryOpen} onClose={() => setIsBestiaryOpen(false)} />}
        </div>
    );
};

export default RitualPhase;
