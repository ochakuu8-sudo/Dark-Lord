import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { useGame } from '../contexts/GameContext';
import {
    COLORS, ALL_RECIPES, FUSION_RECIPES, PIECE_EMOJIS,
    type Recipe
} from '../game/config';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import type { SummonedUnit } from '../contexts/GameContext';
import BestiaryModal from './BestiaryModal';

interface BlockData {
    type: number; row: number; col: number; id: string;
    groupId?: string;
}

const RitualPhase: React.FC = () => {
    const {
        equippedRecipes, addSummonedMonster,
        clearSummonedMonsters, setPhase, currentDay,
        ritualGrid: storedGrid, saveRitualGrid
    } = useGame();

    const curRows = 9;
    const curCols = 9;
    const curBlockSize = 75;
    const curWidth = curCols * curBlockSize;
    const curHeight = curRows * curBlockSize;

    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const linksLayerRef = useRef<PIXI.Container | null>(null);
    const blocksLayerRef = useRef<PIXI.Container | null>(null);
    const usageLayerRef = useRef<PIXI.Graphics | null>(null);
    const blockGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
    const groupGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
    const interactionParams = useRef({ selectedGroup: [] as BlockData[], isDragging: false });
    
    // 状態の初期化
    const [grid, setGrid] = useState<(BlockData | null)[][]>(() => 
        Array(9).fill(null).map(() => Array(9).fill(null))
    );
    const gridRef = useRef<(BlockData | null)[][]>(grid);
    const [boostTiles, setBoostTiles] = useState<{r: number, c: number, type: 'ATK'}[]>([]);
    const [expectedSummons, setExpectedSummons] = useState<SummonedUnit[]>([]);
    const [usedBlocks, setUsedBlocks] = useState<Set<string>>(new Set());
    const [isBestiaryOpen, setIsBestiaryOpen] = useState(false);
    const [hoveredUnit, setHoveredUnit] = useState<SummonedUnit | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const blockPool = useRef<number[]>([]);
    const activeRecipesRef = useRef<(Recipe)[]>([]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const initPool = useCallback(() => {
        const pool: number[] = [];
        activeRecipesRef.current.forEach(recipe => {
            if (!recipe || !recipe.pattern) return;
            recipe.pattern.forEach((row: number[]) => {
                if (!row) return;
                row.forEach((val: number) => {
                    if (val === 0 || val === 1 || val === 2) {
                        for (let i = 0; i < 15; i++) pool.push(val);
                    } else if (val === 9) {
                        for (let i = 0; i < 5; i++) { pool.push(0); pool.push(1); pool.push(2); }
                    }
                });
            });
        });
        if (pool.length === 0) {
            for (let i = 0; i < 30; i++) { pool.push(0); pool.push(1); pool.push(2); }
        }
        pool.sort(() => Math.random() - 0.5);
        blockPool.current = pool;
    }, []);

    const drawFromPool = useCallback((): number => {
        if (blockPool.current.length === 0) initPool();
        return blockPool.current.pop() ?? Math.floor(Math.random() * 3);
    }, [initPool]);

    const calculateExpectedSummons = useCallback((currentGrid: (BlockData | null)[][], currentBoostTiles: {r: number, c: number, type: string}[]) => {
        if (!currentGrid || currentGrid.length < curRows) return;
        const recipes = activeRecipesRef.current;
        const baseUnits: SummonedUnit[] = [];
        const usedIds = new Set<string>();
        const foundMatchGroups = new Set<string>();

        const rotatePattern = (pattern: number[][]): number[][] => {
            if (!pattern || pattern.length === 0 || !pattern[0]) return [];
            const rows = pattern.length;
            const cols = pattern[0].length;
            const rotated = Array(cols).fill(0).map(() => Array(rows).fill(0));
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (pattern[r]) rotated[c][rows - 1 - r] = pattern[r][c];
                }
            }
            return rotated;
        };

        const getUniquePatterns = (basePattern: number[][]): number[][][] => {
            if (!basePattern) return [];
            const patterns = [basePattern];
            let current = basePattern;
            for (let i = 0; i < 3; i++) {
                current = rotatePattern(current);
                if (current.length === 0) break;
                const isDuplicate = patterns.some(p => JSON.stringify(p) === JSON.stringify(current));
                if (!isDuplicate) patterns.push(current);
            }
            return patterns;
        };

        for (let r = 0; r < curRows; r++) {
            for (let c = 0; c < curCols; c++) {
                recipes.forEach(recipe => {
                    if (!recipe || !recipe.pattern) return;
                    const uniquePatterns = getUniquePatterns(recipe.pattern);
                    uniquePatterns.forEach(patternToMatch => {
                        if (!patternToMatch || patternToMatch.length === 0 || !patternToMatch[0]) return;
                        const pRows = patternToMatch.length;
                        const pCols = patternToMatch[0].length;
                        if (r + pRows > curRows || c + pCols > curCols) return;

                        const matches: BlockData[] = [];
                        let valid = true;
                        let variableType: number | null = null;
                        let hasAtkBoost = false;

                        for (let pr = 0; pr < pRows && valid; pr++) {
                            const pRow = patternToMatch[pr];
                            if (!pRow) { valid = false; break; }
                            for (let pc = 0; pc < pCols && valid; pc++) {
                                const exp = pRow[pc];
                                if (exp === -1) continue;
                                const gridRow = currentGrid[r + pr];
                                if (!gridRow) { valid = false; break; }
                                const block = gridRow[c + pc];
                                if (!block) { valid = false; break; }
                                if (exp === 9) {
                                    if (variableType === null) variableType = block.type;
                                    else if (variableType !== block.type) valid = false;
                                } else if (block.type !== exp) {
                                    valid = false;
                                }
                                if (valid) {
                                    matches.push(block);
                                    if (currentBoostTiles.some(t => t.r === (r + pr) && t.c === (c + pc) && t.type === 'ATK')) {
                                        hasAtkBoost = true;
                                    }
                                }
                            }
                        }
                        if (valid && matches.length > 0) {
                            const matchGroupStr = matches.map(b => b.id).sort().join(',');
                            if (!foundMatchGroups.has(matchGroupStr)) {
                                foundMatchGroups.add(matchGroupStr);
                                let resultId = recipe.id;
                                if (recipe.resultMap && variableType !== null) {
                                    resultId = recipe.resultMap[variableType] || recipe.id;
                                }
                                baseUnits.push({
                                    id: generateId(),
                                    type: resultId,
                                    attackBonus: hasAtkBoost ? 25 : 0, 
                                    hpBonus: 0
                                });
                                matches.forEach(b => usedIds.add(b.id));
                            }
                        }
                    });
                });
            }
        }

        // Fusion Logic
        const counts = new Map<string, number>();
        baseUnits.forEach(u => counts.set(u.type, (counts.get(u.type) || 0) + 1));

        let fused = true;
        const finalUnits: SummonedUnit[] = [];
        
        while (fused) {
            fused = false;
            for (const fusion of FUSION_RECIPES) {
                if (!fusion || !fusion.pattern) continue;
                const needed = new Map<string, number>();
                fusion.pattern.flat().forEach(id => { if (id) needed.set(id as string, (needed.get(id as string) || 0) + 1); });
                let can = true;
                for (const [id, cnt] of needed) { if ((counts.get(id) || 0) < cnt) { can = false; break; } }
                if (can) {
                    for (const [id, cnt] of needed) counts.set(id, counts.get(id)! - cnt);
                    finalUnits.push({ id: generateId(), type: fusion.id, attackBonus: 0, hpBonus: 0 });
                    fused = true; break;
                }
            }
        }
        counts.forEach((cnt, type) => {
            for(let i=0; i<cnt; i++) {
                const original = baseUnits.find(u => u.type === type && !finalUnits.some(fu => fu.id === u.id));
                if (original) finalUnits.push(original);
                else finalUnits.push({ id: generateId(), type, attackBonus: 0, hpBonus: 0 });
            }
        });

        setExpectedSummons(finalUnits);
        setUsedBlocks(usedIds);
    }, [curRows, curCols]);

    const scatterPieces = useCallback((count: number, forceSingle: boolean = false) => {
        const newGrid = gridRef.current.map(row => (row ? [...row] : Array(curCols).fill(null)));
        for (let i = 0; i < count; i++) {
            const emptyLocations: { r: number; c: number }[] = [];
            for (let r = 0; r < curRows; r++) {
                if (!newGrid[r]) continue;
                for (let c = 0; c < curCols; c++) {
                    if (!newGrid[r][c]) emptyLocations.push({ r, c });
                }
            }
            if (emptyLocations.length === 0) break;

            const pairChoices: { r1: number, c1: number, r2: number, c2: number }[] = [];
            if (!forceSingle && emptyLocations.length >= 2) {
                emptyLocations.forEach(loc => {
                    if (loc.c + 1 < curCols && !newGrid[loc.r][loc.c + 1]) pairChoices.push({ r1: loc.r, c1: loc.c, r2: loc.r, c2: loc.c + 1 });
                    if (loc.r + 1 < curRows && newGrid[loc.r + 1] && !newGrid[loc.r + 1][loc.c]) pairChoices.push({ r1: loc.r, c1: loc.c, r2: loc.r + 1, c2: loc.c });
                });
            }

            if (!forceSingle && pairChoices.length > 0) {
                const choice = pairChoices[Math.floor(Math.random() * pairChoices.length)];
                const groupId = `g-${generateId()}`;
                newGrid[choice.r1][choice.c1] = { type: drawFromPool(), row: choice.r1, col: choice.c1, id: generateId(), groupId };
                newGrid[choice.r2][choice.c2] = { type: drawFromPool(), row: choice.r2, col: choice.c2, id: generateId(), groupId };
            } else {
                const loc = emptyLocations[Math.floor(Math.random() * emptyLocations.length)];
                newGrid[loc.r][loc.c] = { type: drawFromPool(), row: loc.r, col: loc.c, id: generateId() };
            }
        }
        gridRef.current = newGrid;
        setGrid([...newGrid.map(row => [...row])]);
    }, [drawFromPool, curRows, curCols]);

    const renderLinks = useCallback(() => {
        if (!linksLayerRef.current) return;
        const linkLayer = linksLayerRef.current;
        const currentGroupIds = new Set<string>();
        const processedGroups = new Set<string>();

        gridRef.current.forEach(row => {
            if (!row) return;
            row.forEach(block => {
                if (!block || !block.groupId || processedGroups.has(block.groupId)) return;
                let partner: BlockData | null = null;
                gridRef.current.forEach(r => {
                    if (!r) return;
                    r.forEach(b => {
                        if (b && b.groupId === block.groupId && b.id !== block.id) partner = b;
                    });
                });

                if (partner) {
                    const g = blockGraphicsMap.current.get(block.id);
                    const pg = blockGraphicsMap.current.get((partner as BlockData).id);
                    if (g && pg) {
                        currentGroupIds.add(block.groupId);
                        let outline = groupGraphicsMap.current.get(block.groupId);
                        if (!outline) {
                            outline = new PIXI.Graphics();
                            linkLayer.addChild(outline);
                            groupGraphicsMap.current.set(block.groupId, outline);
                        }
                        outline.clear(); outline.lineStyle(4, 0xffffff, 0.8);
                        const minX = Math.min(g.x, pg.x) - curBlockSize / 2 + 4;
                        const minY = Math.min(g.y, pg.y) - curBlockSize / 2 + 4;
                        const maxX = Math.max(g.x, pg.x) + curBlockSize / 2 - 4;
                        const maxY = Math.max(g.y, pg.y) + curBlockSize / 2 - 4;
                        outline.drawRoundedRect(0, 0, maxX - minX, maxY - minY, 12);
                        outline.x = minX; outline.y = minY;
                        processedGroups.add(block.groupId);
                    }
                }
            });
        });

        groupGraphicsMap.current.forEach((g, gid) => {
            if (!currentGroupIds.has(gid)) {
                linkLayer.removeChild(g); g.destroy();
                groupGraphicsMap.current.delete(gid);
            }
        });
    }, [curBlockSize]);

    const createBlockGraphics = useCallback((block: BlockData) => {
        const g = new PIXI.Graphics();
        const color = COLORS[block.type] ?? 0xffffff;
        const emoji = PIECE_EMOJIS[block.type] || '❓';
        
        g.beginFill(0x222222); 
        g.drawRoundedRect(-curBlockSize / 2 + 2, -curBlockSize / 2 + 2, curBlockSize - 4, curBlockSize - 4, 12);
        g.endFill();

        g.lineStyle(2, color, 0.4);
        g.drawRoundedRect(-curBlockSize / 2 + 6, -curBlockSize / 2 + 6, curBlockSize - 12, curBlockSize - 12, 10);
        
        const style = new PIXI.TextStyle({ fontSize: curBlockSize * 0.6, align: 'center' });
        const txt = new PIXI.Text(emoji, style);
        txt.anchor.set(0.5);
        g.addChild(txt);

        g.eventMode = 'static'; g.cursor = 'pointer';

        g.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            if (interactionParams.current.isDragging) return;
            let targetBlock: BlockData | null = null;
            for (let r = 0; r < curRows && !targetBlock; r++) {
                const row = gridRef.current[r];
                if (!row) continue;
                for (let c = 0; c < curCols && !targetBlock; c++)
                    if (row[c]?.id === block.id) targetBlock = row[c];
            }
            if (!targetBlock) return;

            let group: BlockData[] = [];
            if (targetBlock.groupId) {
                gridRef.current.forEach(row => {
                    if (!row) return;
                    row.forEach(candidate => {
                        if (candidate && candidate.groupId === targetBlock?.groupId) group.push(candidate);
                    });
                });
            } else { group = [targetBlock]; }

            interactionParams.current.selectedGroup = group;
            interactionParams.current.isDragging = true;
            
            const view = appRef.current?.view as HTMLCanvasElement;
            if (!view) return;
            const rect = view.getBoundingClientRect();
            const startMouseX = (event.clientX - rect.left) * (curWidth / rect.width);
            const startMouseY = (event.clientY - rect.top) * (curHeight / rect.height);
            const initialPositions = group.map(m => ({ 
                id: m.id, 
                x: blockGraphicsMap.current.get(m.id)?.x ?? (m.col * curBlockSize + curBlockSize/2), 
                y: blockGraphicsMap.current.get(m.id)?.y ?? (m.row * curBlockSize + curBlockSize/2)
            }));

            group.forEach(m => {
                const gm = blockGraphicsMap.current.get(m.id);
                if (gm) { gsap.killTweensOf(gm); gm.zIndex = 100; gm.scale.set(1.1); }
            });
            blocksLayerRef.current?.sortChildren();

            const onMove = (e: PointerEvent) => {
                if (!appRef.current || !interactionParams.current.isDragging) return;
                const r = (appRef.current.view as HTMLCanvasElement).getBoundingClientRect();
                const mouseX = (e.clientX - r.left) * (curWidth / r.width);
                const mouseY = (e.clientY - r.top) * (curHeight / r.height);
                const dx = mouseX - startMouseX; const dy = mouseY - startMouseY;
                initialPositions.forEach(pos => {
                    const gm = blockGraphicsMap.current.get(pos.id);
                    if (gm) { gm.x = pos.x + dx; gm.y = pos.y + dy; }
                });
                renderLinks();
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp);
                if (!appRef.current) return;
                const moves = group.map(m => {
                    const gm = blockGraphicsMap.current.get(m.id)!;
                    const tr = Math.round(gm.y / curBlockSize - 0.5);
                    const tc = Math.round(gm.x / curBlockSize - 0.5);
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
                            const otherGroupIds = new Set<string>();
                            gridRef.current.forEach(row => {
                                if (!row) return;
                                row.forEach(b => { if (b && b.groupId === target.groupId) otherGroupIds.add(b.id); });
                            });
                            const targetPointsIds = new Set<string>();
                            moves.forEach(mv => {
                                const t = gridRef.current[mv.tr]?.[mv.tc];
                                if (t) targetPointsIds.add(t.id);
                            });
                            otherGroupIds.forEach(oid => {
                                if (!targetPointsIds.has(oid)) validSwap = false;
                            });
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
                        gridRef.current = ng;
                        setGrid([...ng.map(row => [...row])]);
                    }
                }

                group.forEach(m => {
                    const gm = blockGraphicsMap.current.get(m.id);
                    if (gm) { gm.zIndex = 0; gm.scale.set(1); }
                });
                interactionParams.current.isDragging = false;
                setGrid([...gridRef.current.map(row => [...row])]);
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
        });
        return g;
    }, [renderLinks, curRows, curCols, curBlockSize, curWidth, curHeight]);

    const renderGrid = useCallback(() => {
        if (!blocksLayerRef.current || !usageLayerRef.current) return;
        const curIds = new Set<string>();
        const usageGfx = usageLayerRef.current;
        usageGfx.clear();

        gridRef.current.forEach(row => {
            if (!row) return;
            row.forEach(block => {
                if (!block) return; curIds.add(block.id);
                let g = blockGraphicsMap.current.get(block.id);
                if (!g) {
                    g = createBlockGraphics(block);
                    g.x = block.col * curBlockSize + curBlockSize / 2; g.y = -curBlockSize;
                    gsap.to(g, { y: block.row * curBlockSize + curBlockSize / 2, duration: 0.25, ease: 'bounce.out', onUpdate: renderLinks });
                    blocksLayerRef.current!.addChild(g); blockGraphicsMap.current.set(block.id, g);
                }
                const tx = block.col * curBlockSize + curBlockSize / 2;
                const ty = block.row * curBlockSize + curBlockSize / 2;
                const dragging = interactionParams.current.isDragging && interactionParams.current.selectedGroup.some(m => m.id === block.id);

                if (usedBlocks.has(block.id)) {
                    usageGfx.lineStyle(6, 0xffffff, 0.9);
                    usageGfx.drawRoundedRect(tx - curBlockSize / 2 - 3, ty - curBlockSize / 2 - 3, curBlockSize + 6, curBlockSize + 6, 12);
                }

                if (!dragging && (Math.abs(g.x - tx) > 1 || Math.abs(g.y - ty) > 1))
                    gsap.to(g, { x: tx, y: ty, duration: 0.1, ease: 'power2.out', onUpdate: renderLinks });
            });
        });
        blockGraphicsMap.current.forEach((g, id) => {
            if (!curIds.has(id)) {
                gsap.killTweensOf(g);
                if (!g.destroyed) {
                    gsap.to(g.scale, { x: 0, y: 0, duration: 0.1, onComplete: () => { if (!g.destroyed) g.destroy(); } });
                }
                blockGraphicsMap.current.delete(id);
            }
        });
        renderLinks();
    }, [createBlockGraphics, renderLinks, usedBlocks, curBlockSize]);

    // Resets on mount
    useEffect(() => {
        clearSummonedMonsters();
        activeRecipesRef.current = equippedRecipes
            .map(id => ALL_RECIPES.find(r => r.id === id))
            .filter((r): r is Recipe => !!r);
        initPool();
    }, [equippedRecipes, clearSummonedMonsters, initPool]);

    // Initialize Grid
    useEffect(() => {
        let initializedGrid: (BlockData | null)[][] | null = null;
        if (storedGrid && Array.isArray(storedGrid) && storedGrid.length === curRows) {
            initializedGrid = storedGrid.map(row => (Array.isArray(row) ? [...row] : Array(curCols).fill(null)));
        } else {
            initializedGrid = Array(curRows).fill(null).map(() => Array(curCols).fill(null));
        }
        
        gridRef.current = initializedGrid;
        setGrid([...initializedGrid.map(row => [...row])]);
        
        if (!storedGrid || storedGrid.length !== curRows) {
            scatterPieces(6, true); 
        }

        const tiles: {r: number, c: number, type: 'ATK'}[] = [];
        for(let i=0; i < (3 + Math.floor(Math.random() * 3)); i++) {
            tiles.push({ r: Math.floor(Math.random() * curRows), c: Math.floor(Math.random() * curCols), type: 'ATK' });
        }
        setBoostTiles(tiles);
    }, [curRows, curCols, storedGrid, scatterPieces]);

    // Calculate Expected Summons on grid/boost change
    useEffect(() => {
        if (grid && grid.length === curRows) {
            calculateExpectedSummons(grid, boostTiles);
        }
    }, [grid, boostTiles, calculateExpectedSummons, curRows]);

    // PIXI Lifecycle
    useEffect(() => {
        if (!pixiContainerRef.current) return;
        const app = new PIXI.Application({
            width: curWidth, height: curHeight, backgroundColor: 0x111111,
            resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true
        });
        pixiContainerRef.current.appendChild(app.view as unknown as Node);
        appRef.current = app;
        
        const stage = app.stage;
        const bgGr = new PIXI.Graphics();
        for (let r = 0; r < curRows; r++)
            for (let c = 0; c < curCols; c++) {
                bgGr.lineStyle(1, 0x333333, 0.5); bgGr.beginFill(0x1a1a1a);
                bgGr.drawRect(c * curBlockSize, r * curBlockSize, curBlockSize, curBlockSize); bgGr.endFill();
            }
        stage.addChild(bgGr);

        const boostLayer = new PIXI.Container(); stage.addChild(boostLayer);
        const usageLayer = new PIXI.Graphics(); stage.addChild(usageLayer); usageLayerRef.current = usageLayer;
        const bLayer = new PIXI.Container(); bLayer.sortableChildren = true; stage.addChild(bLayer); blocksLayerRef.current = bLayer;
        const linkLayer = new PIXI.Container(); stage.addChild(linkLayer); linksLayerRef.current = linkLayer;

        boostTiles.forEach(tile => {
            const container = new PIXI.Container();
            const bt = new PIXI.Graphics();
            bt.lineStyle(4, 0xffaa00, 0.4); bt.beginFill(0xffaa00, 0.1);
            bt.drawRoundedRect(tile.c * curBlockSize + 4, tile.r * curBlockSize + 4, curBlockSize - 8, curBlockSize - 8, 12);
            bt.endFill();
            
            const labelBg = new PIXI.Graphics();
            labelBg.beginFill(0xff3300, 0.8); labelBg.drawRoundedRect(-20, -8, 40, 16, 4); labelBg.endFill();
            labelBg.x = tile.c * curBlockSize + curBlockSize/2; labelBg.y = tile.r * curBlockSize + curBlockSize/2;

            const text = new PIXI.Text('ATK+', { fontSize: 12, fill: 0xffffff, fontWeight: 'bold' });
            text.anchor.set(0.5); text.x = labelBg.x; text.y = labelBg.y;

            container.addChild(bt); container.addChild(labelBg); container.addChild(text);
            boostLayer.addChild(container);
        });

        return () => {
            blockGraphicsMap.current.forEach(g => { if (!g.destroyed) g.destroy(); });
            blockGraphicsMap.current.clear();
            groupGraphicsMap.current.forEach(g => { if (!g.destroyed) g.destroy(); });
            groupGraphicsMap.current.clear();
            if (appRef.current) {
                appRef.current.destroy(true, { children: true });
                appRef.current = null;
            }
        };
    }, [curRows, curCols, boostTiles, curBlockSize, curWidth, curHeight]);

    useEffect(() => { renderGrid(); }, [grid, renderGrid]);

    const handleFinishRitual = () => {
        if (expectedSummons.length > 0) {
            expectedSummons.forEach(unit => addSummonedMonster(unit));
        }
        // ピースを消費せず、盤面をそのまま保存して翌日に引き継ぐ
        const finalGrid = gridRef.current.map(row => (row ? [...row] : null)) as any[][];
        saveRitualGrid(finalGrid);
        setPhase('BATTLE');
    };

    return (
        <div className="ritual-layout" style={{
            display: 'flex', gap: '20px', padding: '20px', backgroundColor: '#0a0a10', color: '#fff',
            height: '800px', width: '100%', justifyContent: 'center', alignItems: 'stretch', boxSizing: 'border-box'
        }}>
            <div style={{
                width: '260px', backgroundColor: '#1a1a24', padding: '15px', borderRadius: '10px', border: '2px solid #522',
                display: 'flex', flexDirection: 'column', gap: '15px', height: '100%', boxSizing: 'border-box'
            }}>
                <h3 style={{ margin: '0 0 10px 0', color: '#ff6666', borderBottom: '1px solid #522', paddingBottom: '5px' }}>召喚レシピ</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', overflowY: 'auto' }}>
                    {equippedRecipes.map(rid => {
                        const recipe = ALL_RECIPES.find(r => r.id === rid);
                        if (!recipe) return null;
                        return (
                            <div key={rid} style={{ 
                                backgroundColor: '#0d0d16', padding: '6px', borderRadius: '4px', border: '1px solid #444',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px'
                            }}>
                                <div style={{ color: '#ffd700', fontSize: '10px', fontWeight: 'bold' }}>{recipe.name}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                    {recipe.pattern.map((row, ri) => (
                                        <div key={ri} style={{ display: 'flex', gap: '1px' }}>
                                            {row.map((val, ci) => (
                                                <div key={ci} style={{ 
                                                    width: '12px', height: '12px', fontSize: '8px', display: 'flex', 
                                                    alignItems: 'center', justifyContent: 'center', backgroundColor: val === -1 ? 'transparent' : '#222'
                                                }}>
                                                    {val !== -1 && (PIECE_EMOJIS[val] || '❓')}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
                <h2 style={{ color: '#ff6666', margin: 0 }}>魔王の儀式 (Day {currentDay})</h2>
                <div ref={pixiContainerRef} style={{ border: '4px solid #522', borderRadius: '12px', boxShadow: '0 0 20px rgba(255,0,0,0.2)' }} />
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => scatterPieces(1)} style={{ padding: '8px 16px', background: '#333', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>魔力を注ぐ</button>
                    <button onClick={() => setIsBestiaryOpen(true)} style={{ padding: '8px 16px', background: '#522', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>図鑑</button>
                </div>
            </div>

            <div style={{
                width: '340px', backgroundColor: '#1a1a24', padding: '12px', borderRadius: '10px', border: '2px solid #522',
                display: 'flex', flexDirection: 'column', gap: '10px', height: '100%', boxSizing: 'border-box'
            }}>
                <h3 style={{ margin: '0 0 5px 0', color: '#ff6666', borderBottom: '1px solid #522', fontSize: '16px' }}>予測召喚</h3>
                <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '4px', padding: '10px', overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {expectedSummons.map((unit, idx) => (
                            <div key={idx} 
                                onPointerEnter={(e) => {
                                    setHoveredUnit(unit);
                                    setTooltipPos({ x: e.clientX, y: e.clientY });
                                }}
                                onPointerLeave={() => setHoveredUnit(null)}
                                onPointerMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                                style={{ 
                                    background: '#222', border: '1px solid #522', padding: '4px', borderRadius: '4px',
                                    fontSize: '10px', textAlign: 'center', color: '#ffaaaa', animation: 'pulse 2s infinite',
                                    cursor: 'help', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    overflow: 'hidden'
                                }}
                            >
                                {unit.type.length > 6 ? unit.type.substring(0, 5) + '..' : unit.type}
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={handleFinishRitual} style={{ padding: '12px', background: '#a22', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    儀式終了
                </button>
            </div>

            <BestiaryModal isOpen={isBestiaryOpen} onClose={() => setIsBestiaryOpen(false)} />

            {hoveredUnit && (
                <div style={{
                    position: 'fixed', 
                    top: Math.max(10, tooltipPos.y - 120), 
                    left: tooltipPos.x - 220, // パネルの左側（カーソルの左）に表示
                    backgroundColor: 'rgba(0,0,0,0.95)', color: '#fff', padding: '12px 18px',
                    borderRadius: '8px', pointerEvents: 'none', zIndex: 9999,
                    border: '1px solid #ff4444', boxShadow: '0 8px 16px rgba(0,0,0,0.6)',
                    minWidth: '180px', backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', color: '#ffaaaa', borderBottom: '1px solid #522', paddingBottom: '4px' }}>
                        {hoveredUnit.type}
                    </div>
                    {(() => {
                        const stats = UNIT_STATS[hoveredUnit.type] || { maxHp: '?', attack: '?', range: '?', speed: '?' };
                        const atk = typeof stats.attack === 'number' ? stats.attack + (hoveredUnit.attackBonus || 0) : stats.attack;
                        return (
                            <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                                <span style={{ color: '#aaa' }}>HP:</span> <span style={{ color: '#aaffaa', textAlign: 'right' }}>{stats.maxHp}</span>
                                <span style={{ color: '#aaa' }}>ATK:</span> <span style={{ color: '#ffaaaa', textAlign: 'right' }}>{atk} {hoveredUnit.attackBonus ? <span style={{fontSize: '10px'}}>(+{hoveredUnit.attackBonus})</span> : ''}</span>
                                <span style={{ color: '#aaa' }}>射程:</span> <span style={{ color: '#aaaaff', textAlign: 'right' }}>{stats.range}</span>
                                <span style={{ color: '#aaa' }}>速度:</span> <span style={{ color: '#ffff88', textAlign: 'right' }}>{stats.speed}</span>
                            </div>
                        );
                    })()}
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #444' }}>
                        <div style={{ color: '#ffcc44', fontSize: '11px', fontWeight: 'bold', marginBottom: '4px' }}>特殊能力:</div>
                        {(() => {
                            const unitData = UNIT_STATS[hoveredUnit.type];
                            if (unitData && unitData.passiveAbilities && unitData.passiveAbilities.length > 0) {
                                return unitData.passiveAbilities.map((pa, idx) => (
                                    <div key={idx} style={{ color: '#eee', fontSize: '11px', lineHeight: '1.4' }}>
                                        • {PASSIVE_DESCRIPTIONS[pa.type] || pa.type}
                                    </div>
                                ));
                            }
                            return <div style={{ color: '#666', fontSize: '11px', fontStyle: 'italic' }}>なし</div>;
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RitualPhase;
