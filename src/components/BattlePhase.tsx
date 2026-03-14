import React, { useState, useEffect, useRef, useCallback, useImperativeHandle } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { useGame } from '../contexts/GameContext';
import {
    ROWS, COLS, BLOCK_SIZE, BOARD_WIDTH, BOARD_HEIGHT,
    COLORS, COLOR_HEX, ALL_RECIPES, FUSION_RECIPES,
    type Recipe
} from '../game/config';
import DefensePhase from './DefensePhase';

const BASE_MAX_HP = 500;
const MAX_WAVES = 4;


interface BlockData {
    type: number; row: number; col: number; id: string;
    groupId?: string;
}

interface PuzzleCanvasProps {
    onSummon: (monsters: { id: string; name: string; count: number }[]) => void;
    ownedRelics: string[];
    onStateChange?: (state: { expectedSummons: { id: string; name: string; count: number }[], canSummon: boolean, summonCooldown: boolean }) => void;
}

export interface PuzzleCanvasRef {
    handleSummon: () => void;
}

const PuzzleCanvas = React.forwardRef<PuzzleCanvasRef, PuzzleCanvasProps>(({ onSummon, ownedRelics, onStateChange }, ref) => {
    const { equippedRecipes, pendingPuzzlePieces, consumePendingPuzzlePieces } = useGame();

    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const linksLayerRef = useRef<PIXI.Container | null>(null);
    const blocksLayerRef = useRef<PIXI.Container | null>(null);
    const blockGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
    const groupGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
    const interactionParams = useRef({ selectedGroup: [] as BlockData[], isDragging: false });
    // Pending window listeners for cleanup on unmount
    const pendingCleanup = useRef<(() => void)[]>([]);

    const gridRef = useRef<(BlockData | null)[][]>(
        Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
    );
    const [grid, setGrid] = useState<(BlockData | null)[][]>(
        Array(ROWS).fill(null).map(() => Array(COLS).fill(null))
    );
    const [expectedSummons, setExpectedSummons] = useState<{ id: string; name: string; count: number }[]>([]);
    const [usedBlocks, setUsedBlocks] = useState<Set<string>>(new Set());
    const [summonCooldown, setSummonCooldown] = useState(false);
    const [refillCountdown, setRefillCountdown] = useState(0);

    const blockPool = useRef<number[]>([]);
    const activeRecipesRef = useRef<(Recipe)[]>([]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    // Forward declaration ref for calculateExpectedSummons to avoid use-before-define
    const calculateExpectedSummonsRef = useRef<(g: (BlockData | null)[][]) => void>(() => { });

    // 戦闘フェーズからのフィードバック（ピース追加）の監視
    useEffect(() => {
        if (pendingPuzzlePieces.length > 0) {
            const colors = consumePendingPuzzlePieces();
            if (colors.length > 0) {
                const newGrid = gridRef.current.map(r => [...r]);
                let changed = false;

                colors.forEach(color => {
                    // 空きマスを探す
                    const emptyLocs: { r: number, c: number }[] = [];
                    for (let r = 0; r < ROWS; r++) {
                        for (let c = 0; c < COLS; c++) {
                            if (!newGrid[r][c]) emptyLocs.push({ r, c });
                        }
                    }

                    if (emptyLocs.length > 0) {
                        const loc = emptyLocs[Math.floor(Math.random() * emptyLocs.length)];
                        const id = generateId();
                        newGrid[loc.r][loc.c] = { type: color, row: loc.r, col: loc.c, id };
                        changed = true;
                    }
                });

                if (changed) {
                    gridRef.current = newGrid;
                    setGrid(newGrid);
                    calculateExpectedSummonsRef.current(newGrid);
                }
            }
        }
    }, [pendingPuzzlePieces, consumePendingPuzzlePieces]);

    useEffect(() => {
        activeRecipesRef.current = equippedRecipes
            .map(id => ALL_RECIPES.find(r => r.id === id))
            .filter((r): r is Recipe => r !== undefined);
    }, [equippedRecipes]);

    const initPool = useCallback(() => {
        const pool: number[] = [];
        activeRecipesRef.current.forEach(recipe => {
            recipe.pattern.forEach((row: number[]) => {
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

    // Always-current ref to calculateExpectedSummons to avoid stale closures
    const calcRef = useRef<(g: (BlockData | null)[][]) => void>(() => { });

    const calculateExpectedSummons = useCallback((currentGrid: (BlockData | null)[][]) => {
        const recipes = activeRecipesRef.current;
        const baseMonsters: string[] = []; // ID
        const usedIds = new Set<string>();
        const foundMatchGroups = new Set<string>(); // 重複マッチ（同じブロック群での複数回マッチ）を防ぐため追加

        const rotatePattern = (pattern: number[][]): number[][] => {
            const rows = pattern.length;
            const cols = pattern[0].length;
            const rotated = Array(cols).fill(0).map(() => Array(rows).fill(0));
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    rotated[c][rows - 1 - r] = pattern[r][c];
                }
            }
            return rotated;
        };

        const getUniquePatterns = (basePattern: number[][]): number[][][] => {
            const patterns = [basePattern];
            let current = basePattern;
            for (let i = 0; i < 3; i++) {
                current = rotatePattern(current);
                const isDuplicate = patterns.some(p => JSON.stringify(p) === JSON.stringify(current));
                if (!isDuplicate) patterns.push(current);
            }
            return patterns;
        };

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                recipes.forEach(recipe => {
                    const uniquePatterns = getUniquePatterns(recipe.pattern);

                    uniquePatterns.forEach(patternToMatch => {
                        const pRows = patternToMatch.length;
                        const pCols = patternToMatch[0].length;
                        if (r + pRows > ROWS || c + pCols > COLS) return;

                        const matches: BlockData[] = [];
                        let valid = true;
                        let variableType: number | null = null; // Type 0, 1, or 2 put into '9' (X) slot

                        for (let pr = 0; pr < pRows && valid; pr++) {
                            for (let pc = 0; pc < pCols && valid; pc++) {
                                const exp = patternToMatch[pr][pc];
                                if (exp === -1) continue;
                                const block = currentGrid[r + pr][c + pc];
                                if (!block) {
                                    valid = false;
                                    break;
                                }
                                if (exp === 9) {
                                    // Variable slot (X)
                                    if (variableType === null) variableType = block.type;
                                    else if (variableType !== block.type) valid = false; // All X in a pattern must match
                                } else if (block.type !== exp) {
                                    valid = false;
                                }
                                if (valid) matches.push(block);
                            }
                        }
                        if (valid && matches.length > 0) {
                            // まったく同じブロックの組み合わせで既に召喚判定済みの場合はスキップ
                            // （例：[1,1]が [9,1] と回転後の [1,9] の両方でマッチしてしまうのを防ぐ）
                            const matchGroupStr = matches.map(b => b.id).sort().join(',');
                            if (!foundMatchGroups.has(matchGroupStr)) {
                                foundMatchGroups.add(matchGroupStr);
                                let resultId = recipe.id;
                                if (recipe.resultMap && variableType !== null) {
                                    resultId = recipe.resultMap[variableType] || recipe.id;
                                }
                                baseMonsters.push(resultId);
                                matches.forEach(b => usedIds.add(b.id)); // 召喚時に消費するため記録
                            }
                        }
                    });
                });
            }
        }
        const counts = new Map<string, number>();
        baseMonsters.forEach(m => counts.set(m, (counts.get(m) || 0) + 1));
        let fused = true;
        while (fused) {
            fused = false;
            for (const fusion of FUSION_RECIPES) {
                const needed = new Map<string, number>();
                fusion.pattern.flat().forEach(id => { if (id) needed.set(id, (needed.get(id) || 0) + 1); });
                let can = true;
                for (const [id, cnt] of needed) { if ((counts.get(id) || 0) < cnt) { can = false; break; } }
                if (can) {
                    for (const [id, cnt] of needed) counts.set(id, counts.get(id)! - cnt);
                    counts.set(fusion.id, (counts.get(fusion.id) || 0) + 1);
                    fused = true; break;
                }
            }
        }
        const result: { id: string; name: string; count: number }[] = [];

        // FUSION logic removed/skipped for simplicity if we strictly follow 9 units,
        // but let's keep it harmless in case FUSION_RECIPES contains new things.
        counts.forEach((cnt, id) => {
            if (cnt > 0) {
                // Find name from config (need a way to look up derivation names)
                // For now, let's just make a simple name translation from ID if it's not in ALL_RECIPES
                const rec = [...ALL_RECIPES, ...FUSION_RECIPES].find(r => r.id === id);
                let name = rec?.name || id;
                // Quick hack to translate our derived IDs to Japanese UI names if it's derived
                if (id === 'orc_bone') name = '骨オーク (骨)';
                if (id === 'orc_meat') name = '肉オーク (肉)';
                if (id === 'orc_spirit') name = '霊オーク (霊)';
                if (id === 'skeleton_bone') name = '骨兵 (骨)';
                if (id === 'skeleton_meat') name = '肉骨兵 (肉)';
                if (id === 'skeleton_spirit') name = '霊骨兵 (霊)';
                if (id === 'necromancer_bone') name = 'ネクロマンサー (骨)';
                if (id === 'necromancer_meat') name = 'ネクロマンサー (肉)';
                if (id === 'necromancer_spirit') name = 'ネクロマンサー (霊)';

                result.push({ id, name, count: cnt });
            }
        });
        setExpectedSummons(result);
        setUsedBlocks(usedIds);
    }, []);

    // Keep calcRef always current
    useEffect(() => {
        calcRef.current = calculateExpectedSummons;
        calculateExpectedSummonsRef.current = calculateExpectedSummons;
    }, [calculateExpectedSummons]);

    const scatterPieces = useCallback((count: number, forceSingle: boolean = false) => {
        const newGrid = gridRef.current.map(r => [...r]);

        // count回分の「ペア配置」または「単体配置」を試行
        for (let i = 0; i < count; i++) {
            const emptyLocations: { r: number; c: number }[] = [];
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (!newGrid[r][c]) emptyLocations.push({ r, c });
                }
            }
            if (emptyLocations.length === 0) break;
            if (!forceSingle && emptyLocations.length < 2) break;

            // 配置可能なペア候補（縦・横）をリストアップ
            const pairChoices: { r1: number, c1: number, r2: number, c2: number }[] = [];
            if (!forceSingle) {
                emptyLocations.forEach(loc => {
                    // 右
                    if (loc.c + 1 < COLS && !newGrid[loc.r][loc.c + 1]) {
                        pairChoices.push({ r1: loc.r, c1: loc.c, r2: loc.r, c2: loc.c + 1 });
                    }
                    // 下
                    if (loc.r + 1 < ROWS && !newGrid[loc.r + 1][loc.c]) {
                        pairChoices.push({ r1: loc.r, c1: loc.c, r2: loc.r + 1, c2: loc.c });
                    }
                });
            }

            if (!forceSingle && pairChoices.length > 0) {
                const choice = pairChoices[Math.floor(Math.random() * pairChoices.length)];
                const groupId = `g-${generateId()}`;
                newGrid[choice.r1][choice.c1] = { type: drawFromPool(), row: choice.r1, col: choice.c1, id: generateId(), groupId };
                newGrid[choice.r2][choice.c2] = { type: drawFromPool(), row: choice.r2, col: choice.c2, id: generateId(), groupId };
            } else {
                // ペアで置けない場合は単体で1つだけ置く
                const loc = emptyLocations[Math.floor(Math.random() * emptyLocations.length)];
                newGrid[loc.r][loc.c] = { type: drawFromPool(), row: loc.r, col: loc.c, id: generateId() };
            }
        }

        gridRef.current = newGrid;
        setGrid(newGrid.map(row => [...row]));
        calcRef.current(newGrid);
    }, [drawFromPool]);

    const renderLinks = useCallback(() => {
        if (!linksLayerRef.current) return;
        const linkLayer = linksLayerRef.current;

        const currentGroupIds = new Set<string>();
        const processedGroups = new Set<string>();

        gridRef.current.forEach(row => row.forEach(block => {
            if (!block || !block.groupId || processedGroups.has(block.groupId)) return;
            currentGroupIds.add(block.groupId);

            // 相方を探す
            let partner: BlockData | null = null;
            gridRef.current.forEach(r => r.forEach(b => {
                if (b && b.groupId === block.groupId && b.id !== block.id) partner = b;
            }));

            if (partner) {
                const g = blockGraphicsMap.current.get(block.id);
                const pg = blockGraphicsMap.current.get((partner as BlockData).id);
                if (g && pg) {
                    let outline = groupGraphicsMap.current.get(block.groupId);
                    if (!outline) {
                        outline = new PIXI.Graphics();
                        linkLayer.addChild(outline);
                        groupGraphicsMap.current.set(block.groupId, outline);
                    }

                    outline.clear();
                    outline.lineStyle(4, 0xffffff, 0.8);
                    const minX = Math.min(g.x, pg.x) - BLOCK_SIZE / 2 + 4;
                    const minY = Math.min(g.y, pg.y) - BLOCK_SIZE / 2 + 4;
                    const maxX = Math.max(g.x, pg.x) + BLOCK_SIZE / 2 - 4;
                    const maxY = Math.max(g.y, pg.y) + BLOCK_SIZE / 2 - 4;
                    outline.drawRoundedRect(0, 0, maxX - minX, maxY - minY, 12);
                    outline.x = minX;
                    outline.y = minY;
                    processedGroups.add(block.groupId);
                }
            }
        }));

        // 不要なアウトラインを削除
        groupGraphicsMap.current.forEach((g, gid) => {
            if (!currentGroupIds.has(gid)) {
                linkLayer.removeChild(g);
                g.destroy();
                groupGraphicsMap.current.delete(gid);
            }
        });
    }, []);

    const createBlockGraphics = useCallback((block: BlockData) => {
        const g = new PIXI.Graphics();
        const color = COLORS[block.type];
        g.beginFill(0x333333);
        g.drawRoundedRect(-BLOCK_SIZE / 2 + 2, -BLOCK_SIZE / 2 + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 10);
        g.beginFill(color);
        g.drawRoundedRect(-BLOCK_SIZE / 2 + 10, -BLOCK_SIZE / 2 + 10, BLOCK_SIZE - 20, BLOCK_SIZE - 20, 15);
        g.beginFill(0xffffff, 0.3);
        g.drawRoundedRect(-BLOCK_SIZE / 2 + 14, -BLOCK_SIZE / 2 + 14, BLOCK_SIZE - 28, (BLOCK_SIZE - 28) / 2, 10);

        g.eventMode = 'static'; g.cursor = 'pointer';

        g.on('pointerdown', (event: PIXI.FederatedPointerEvent) => {
            if (interactionParams.current.isDragging) return;

            // ブロックIDで最新の状態を取得（ステイルな座標参照を避ける）
            let b: BlockData | null = null;
            for (let r = 0; r < ROWS && !b; r++) {
                for (let c = 0; c < COLS && !b; c++) {
                    if (gridRef.current[r][c]?.id === block.id) b = gridRef.current[r][c];
                }
            }
            if (!b) return;

            let group: BlockData[] = [];
            if (b.groupId) {
                gridRef.current.forEach(row => row.forEach(candidate => {
                    if (candidate && candidate.groupId === b!.groupId) group.push(candidate);
                }));
            } else {
                group = [b];
            }

            interactionParams.current.selectedGroup = group;
            interactionParams.current.isDragging = true;

            const rect = (appRef.current!.view as HTMLCanvasElement).getBoundingClientRect();
            const startMouseX = (event.clientX - rect.left) * (BOARD_WIDTH / rect.width);
            const startMouseY = (event.clientY - rect.top) * (BOARD_HEIGHT / rect.height);

            const initialPositions = group.map(member => {
                const gm = blockGraphicsMap.current.get(member.id);
                return { id: member.id, x: gm?.x || 0, y: gm?.y || 0 };
            });

            group.forEach(member => {
                const gm = blockGraphicsMap.current.get(member.id);
                if (gm) {
                    gsap.killTweensOf(gm);
                    gm.zIndex = 100;
                    gm.scale.set(1.1);
                }
            });
            blocksLayerRef.current?.sortChildren();

            const reset = () => {
                interactionParams.current.selectedGroup.forEach(member => {
                    const gm = blockGraphicsMap.current.get(member.id);
                    if (gm) {
                        gm.zIndex = 0;
                        gm.scale.set(1);
                    }
                });
                interactionParams.current.selectedGroup = [];
                interactionParams.current.isDragging = false;
                setGrid(gridRef.current.map(row => [...row]));
            };
            const onMove = (e: PointerEvent) => {
                if (!appRef.current || !interactionParams.current.isDragging) return;
                const r = (appRef.current.view as HTMLCanvasElement).getBoundingClientRect();
                const mouseX = (e.clientX - r.left) * (BOARD_WIDTH / r.width);
                const mouseY = (e.clientY - r.top) * (BOARD_HEIGHT / r.height);

                const dx = mouseX - startMouseX;
                const dy = mouseY - startMouseY;

                initialPositions.forEach(pos => {
                    const gm = blockGraphicsMap.current.get(pos.id);
                    if (gm) {
                        gm.x = pos.x + dx;
                        gm.y = pos.y + dy;
                    }
                });

                // ドラッグ中の枠線の追従（座標更新のみ）
                const leadBlock = interactionParams.current.selectedGroup[0];
                if (leadBlock?.groupId) {
                    const outline = groupGraphicsMap.current.get(leadBlock.groupId);
                    if (outline) {
                        // 相方を探して位置関係から枠線座標を決定
                        const partner = interactionParams.current.selectedGroup[1];
                        if (partner) {
                            const g1 = blockGraphicsMap.current.get(leadBlock.id);
                            const g2 = blockGraphicsMap.current.get(partner.id);
                            if (g1 && g2) {
                                outline.x = Math.min(g1.x, g2.x) - BLOCK_SIZE / 2 + 4;
                                outline.y = Math.min(g1.y, g2.y) - BLOCK_SIZE / 2 + 4;
                            }
                        }
                    }
                }
            };
            const onUp = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                pendingCleanup.current = pendingCleanup.current.filter(fn => fn !== cleanup);

                if (!appRef.current) { reset(); return; }

                const group = interactionParams.current.selectedGroup;
                if (group.length === 0) { reset(); return; }

                // メンバー全員の移動後ターゲット座標(r, c)を計算
                const moves: { block: BlockData, tr: number, tc: number }[] = group.map(member => {
                    const gm = blockGraphicsMap.current.get(member.id)!;
                    return {
                        block: member,
                        tr: Math.floor(gm.y / BLOCK_SIZE),
                        tc: Math.floor(gm.x / BLOCK_SIZE)
                    };
                });

                // バリデーション：全員が枠内か？
                const allInBounds = moves.every(m => m.tr >= 0 && m.tr < ROWS && m.tc >= 0 && m.tc < COLS);
                if (!allInBounds) { reset(); return; }

                // スワップバリデーション：ちぎれチェック
                // 移動先ターゲットエリア(T)にある全ての他ブロックを調べる
                const draggingIds = new Set(group.map(m => m.id));
                const targetBlocks: BlockData[] = [];
                moves.forEach(m => {
                    const tb = gridRef.current[m.tr][m.tc];
                    if (tb && !draggingIds.has(tb.id)) targetBlocks.push(tb);
                });

                // 各ターゲットブロックについて、そのグループ全体が T に含まれているかチェック
                const targetIds = new Set(moves.map(m => `${m.tr}-${m.tc}`));
                for (const tb of targetBlocks) {
                    if (tb.groupId) {
                        // そのグループの全メンバーを探す
                        const members: BlockData[] = [];
                        gridRef.current.forEach(row => row.forEach(b => {
                            if (b && b.groupId === tb.groupId) members.push(b);
                        }));
                        // 全メンバーがターゲット座標のいずれかに一致するか？
                        const allMatch = members.every(mb => targetIds.has(`${mb.row}-${mb.col}`));
                        if (!allMatch) { reset(); return; } // ちぎれるのでキャンセル
                    }
                }

                // 実際にグリッドを更新（スワップ）
                const ng = gridRef.current.map(row => [...row]);

                // 1. 移動するブロックを一旦消去
                group.forEach(m => { ng[m.row][m.col] = null; });

                // 2. 移動先にいたブロックを元の位置に移動（スワップ）
                moves.forEach(m => {
                    const targetBlock = gridRef.current[m.tr][m.tc];
                    if (targetBlock && !draggingIds.has(targetBlock.id)) {
                        ng[m.block.row][m.block.col] = { ...targetBlock, row: m.block.row, col: m.block.col };
                    }
                });

                // 3. 移動グループを新位置に配置
                moves.forEach(m => {
                    ng[m.tr][m.tc] = { ...m.block, row: m.tr, col: m.tc };
                });

                gridRef.current = ng;
                calcRef.current(ng);
                reset();
            };
            const cleanup = () => {
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);
                reset();
            };
            pendingCleanup.current.push(cleanup);
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });
        return g;
    }, []);

    const renderGrid = useCallback(() => {
        if (!blocksLayerRef.current || !linksLayerRef.current) return;
        const layer = blocksLayerRef.current;
        const curIds = new Set<string>();
        const fallDelays = new Map<string, number>(); // groupId -> delay

        gridRef.current.forEach(row => row.forEach(block => {
            if (!block) return;
            curIds.add(block.id);

            // 同じ塊内では落下ディレイを同期させる
            let delay = block.row * 0.02;
            if (block.groupId) {
                if (fallDelays.has(block.groupId)) {
                    delay = fallDelays.get(block.groupId)!;
                } else {
                    fallDelays.set(block.groupId, delay);
                }
            }

            let g = blockGraphicsMap.current.get(block.id);
            if (!g) {
                g = createBlockGraphics(block);
                g.x = block.col * BLOCK_SIZE + BLOCK_SIZE / 2;
                g.y = -BLOCK_SIZE;
                gsap.to(g, { y: block.row * BLOCK_SIZE + BLOCK_SIZE / 2, duration: 0.25, ease: 'bounce.out', delay, onUpdate: renderLinks });
                layer.addChild(g); blockGraphicsMap.current.set(block.id, g);
            }

            const tx = block.col * BLOCK_SIZE + BLOCK_SIZE / 2;
            const ty = block.row * BLOCK_SIZE + BLOCK_SIZE / 2;
            const dragging = interactionParams.current.isDragging && interactionParams.current.selectedGroup.some(m => m.id === block.id);
            if (!dragging && (Math.abs(g.x - tx) > 1 || Math.abs(g.y - ty) > 1))
                gsap.to(g, { x: tx, y: ty, duration: 0.1, ease: 'power2.out', overwrite: 'auto', onUpdate: renderLinks });
        }));

        renderLinks(); // リンク（枠線）を描画

        blockGraphicsMap.current.forEach((g, id) => {
            if (!curIds.has(id)) {
                gsap.to(g.scale, {
                    x: 0, y: 0, duration: 0.1, onComplete: () => {
                        if (layer.children.includes(g)) layer.removeChild(g);
                        g.destroy();
                    }
                });
                blockGraphicsMap.current.delete(id);
            }
        });
    }, [createBlockGraphics, renderLinks]);

    // Highlight used blocks
    useEffect(() => {
        blockGraphicsMap.current.forEach((g, id) => {
            g.alpha = usedBlocks.has(id) ? 1.0 : 0.75;
            g.tint = usedBlocks.has(id) ? 0xffff88 : 0xffffff;
        });
    }, [usedBlocks]);

    // Initialize Pixi
    useEffect(() => {
        if (!pixiContainerRef.current) return;
        const app = new PIXI.Application({
            width: BOARD_WIDTH, height: BOARD_HEIGHT, backgroundColor: 0x111111,
            resolution: window.devicePixelRatio || 1, autoDensity: true, antialias: true
        });
        pixiContainerRef.current.appendChild(app.view as unknown as Node);
        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        appRef.current = app;

        const bgGr = new PIXI.Graphics();
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++) {
                bgGr.lineStyle(2, 0x333333, 0.5); bgGr.beginFill(0x1a1a1a);
                bgGr.drawRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); bgGr.endFill();
            }
        app.stage.addChild(bgGr);

        const bLayer = new PIXI.Container(); bLayer.sortableChildren = true;
        app.stage.addChild(bLayer);
        blocksLayerRef.current = bLayer;

        const linkLayer = new PIXI.Container();
        app.stage.addChild(linkLayer);
        linksLayerRef.current = linkLayer;

        initPool();
        scatterPieces(3, true); // 最初は単体ピース3個から開始

        return () => {
            // Clean up any pending window listeners from mid-drag
            pendingCleanup.current.forEach(fn => fn());
            pendingCleanup.current = [];

            // Clean up GSAP tweens and Graphics to prevent errors after unmount
            blockGraphicsMap.current.forEach((g) => {
                gsap.killTweensOf(g);
                gsap.killTweensOf(g.scale);
                try { g.destroy(); } catch (e) { }
            });
            blockGraphicsMap.current.clear();
            groupGraphicsMap.current.forEach(g => {
                try { g.destroy(); } catch (e) { }
            });
            groupGraphicsMap.current.clear();
            blocksLayerRef.current = null;
            linksLayerRef.current = null;
            appRef.current = null;
            app.destroy(true, { children: true });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { renderGrid(); }, [grid, renderGrid]);

    // Auto-refill timer
    const REFILL_MS = ownedRelics.includes('mana_prism') ? 2000 : 3000;
    useEffect(() => {
        setRefillCountdown(REFILL_MS / 1000);
        const interval = setInterval(() => {
            scatterPieces(1);
            setRefillCountdown(REFILL_MS / 1000);
        }, REFILL_MS);
        const countdown = setInterval(() => {
            setRefillCountdown(prev => Math.max(0, prev - 0.5));
        }, 500);
        return () => { clearInterval(interval); clearInterval(countdown); };
    }, [REFILL_MS, scatterPieces]);

    const expectedSummonsRef = useRef(expectedSummons);
    useEffect(() => { expectedSummonsRef.current = expectedSummons; }, [expectedSummons]);
    const usedBlocksRef = useRef(usedBlocks);
    useEffect(() => { usedBlocksRef.current = usedBlocks; }, [usedBlocks]);

    const handleSummon = () => {
        const cur = expectedSummonsRef.current;
        const used = usedBlocksRef.current;
        if (cur.length === 0 || summonCooldown) return;
        onSummon(cur);
        const ng = gridRef.current.map(row => [...row]);
        for (let r = 0; r < ROWS; r++)
            for (let c = 0; c < COLS; c++)
                if (ng[r][c] && used.has(ng[r][c]!.id)) ng[r][c] = null;

        // 生き残ったブロックのグループチェック：相方が消えていたらグループ解除
        const remainingGroupIds = new Map<string, number>();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const b = ng[r][c];
                if (b?.groupId) {
                    remainingGroupIds.set(b.groupId, (remainingGroupIds.get(b.groupId) || 0) + 1);
                }
            }
        }
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const b = ng[r][c];
                if (b?.groupId && remainingGroupIds.get(b.groupId) === 1) {
                    delete b.groupId; // 相方がいないのでグループ解消
                }
            }
        }

        gridRef.current = ng;
        setGrid(ng.map(row => [...row]));
        setExpectedSummons([]);
        setUsedBlocks(new Set());
        setSummonCooldown(true);
        setTimeout(() => setSummonCooldown(false), 2000);
    };

    useImperativeHandle(ref, () => ({
        handleSummon
    }));

    useEffect(() => {
        onStateChange?.({
            expectedSummons,
            canSummon: expectedSummons.length > 0 && !summonCooldown,
            summonCooldown
        });
    }, [expectedSummons, summonCooldown, onStateChange]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', color: '#888', textAlign: 'center' }}>
                補充まで: <span style={{ color: '#ffaa00' }}>{refillCountdown.toFixed(1)}s</span>
            </div>
            <div
                ref={pixiContainerRef}
                style={{ border: '2px solid #522', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 20px rgba(200,50,50,0.2)', touchAction: 'none', userSelect: 'none' }}
            />
            {/* 召喚ボタンと予定ブロックは外出し */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                {activeRecipesRef.current.map(recipe => (
                    <div key={recipe.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '4px', padding: '4px 6px', fontSize: '11px' }}>
                        <div style={{ color: '#ccc', marginBottom: '3px' }}>{recipe.name}</div>
                        <div style={{ display: 'grid', gap: '1px', gridTemplateColumns: `repeat(${recipe.pattern[0].length}, 12px)` }}>
                            {recipe.pattern.map((row: number[], ri: number) => row.map((val: number, ci: number) => (
                                <div key={`${ri}-${ci}`} style={{
                                    width: 12, height: 12, borderRadius: 2,
                                    backgroundColor: val === 9 ? '#888' : (val !== -1 ? COLOR_HEX[val] : 'transparent'),
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '8px', color: '#fff'
                                }}>
                                    {val === 9 ? 'X' : ''}
                                </div>
                            )))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
PuzzleCanvas.displayName = 'PuzzleCanvas';

const BattlePhase: React.FC = () => {
    const { currentDay, gold, ownedRelics, setPhase } = useGame();
    const spawnFnRef = useRef<((type: string) => void) | null>(null);

    const actualMaxBaseHp = ownedRelics.includes('mana_prism') ? Math.floor(BASE_MAX_HP / 2) : BASE_MAX_HP;
    const heroBaseMaxHp = 1000 + currentDay * 300;

    const [uiState, setUiState] = useState({
        baseHp: actualMaxBaseHp,
        maxBaseHp: actualMaxBaseHp,
        heroBaseHp: heroBaseMaxHp,
        maxHeroBaseHp: heroBaseMaxHp,
        wave: 0,
        demonCount: 0,
        heroCount: 0,
        nextWaveIn: 0,
        killCount: 0,
    });

    const puzzleRef = useRef<PuzzleCanvasRef>(null);
    const [puzzleState, setPuzzleState] = useState({
        expectedSummons: [] as { id: string; name: string; count: number }[],
        canSummon: false,
        summonCooldown: false
    });

    const registerSpawn = useCallback((fn: (type: string) => void) => {
        spawnFnRef.current = fn;
    }, []);

    const handleSummon = useCallback((monsters: { id: string; name: string; count: number }[]) => {
        monsters.forEach(s => {
            for (let i = 0; i < s.count; i++) spawnFnRef.current?.(s.id);
        });
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0d0d14' }}>
            <div style={{ display: 'flex', flex: 1, gap: '0', overflow: 'hidden' }}>
                {/* 左側: パズル盤面 (画面幅の1/3程度に縮小) */}
                <div style={{
                    width: '560px', flexShrink: 0, padding: '24px 12px', background: '#12080f',
                    borderRight: '2px solid #401010', display: 'flex', flexDirection: 'column', gap: '8px',
                    overflowY: 'auto'
                }}>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <PuzzleCanvas ref={puzzleRef} onStateChange={setPuzzleState} onSummon={handleSummon} ownedRelics={ownedRelics} />
                    </div>
                </div>

                {/* 右側: 上下に分割 (戦闘キャンバス + ステータスUI) */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#050508' }}>
                    {/* 上段: 戦闘キャンバス (広くした) */}
                    <div style={{
                        height: '520px',
                        flexShrink: 0,
                        borderBottom: '2px solid #222',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#111',
                        position: 'relative'
                    }}>
                        <DefensePhase
                            registerSpawn={registerSpawn}
                            onStateChange={setUiState}
                        />
                    </div>

                    {/* 下段: UI (ステータス、魔法、召喚待ちなど) */}
                    <div id="battle-ui-container" style={{
                        flex: 1,
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                        overflowY: 'auto'
                    }}>
                        {/* 戦況サマリー (旧 stats-panel) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', color: '#ccc', fontSize: '14px', background: '#1a1a24', padding: '12px', borderRadius: '8px', border: '1px solid #334' }}>
                            <div style={{ color: '#ff6666', fontWeight: 'bold' }}>🏰 Day {currentDay}</div>
                            <div style={{ color: '#ffd700', fontWeight: 'bold' }}>💰 {gold} G</div>
                            <div style={{ color: (uiState.baseHp / uiState.maxBaseHp) > 0.5 ? '#44ff88' : '#ff3333' }}>自拠点HP: {uiState.baseHp} / {uiState.maxBaseHp}</div>
                            <div>WAVE {uiState.wave} / {MAX_WAVES}</div>
                            <div style={{ color: '#aaffaa' }}>自軍: {uiState.demonCount}</div>
                            <div style={{ color: '#ffaaaa' }}>敵軍: {uiState.heroCount}</div>
                            <div style={{ color: '#ff88ff' }}>撃破: {uiState.killCount}</div>
                            {uiState.nextWaveIn > 0 && uiState.wave < MAX_WAVES && (
                                <div style={{ color: '#ffff44' }}>次WAVEまで: {uiState.nextWaveIn}s</div>
                            )}
                            {uiState.wave >= MAX_WAVES && uiState.heroCount === 0 && (
                                <div style={{ color: '#44ffff', fontWeight: 'bold' }}>⚔ 全WAVE撃退！</div>
                            )}
                            <button onClick={() => setPhase('BATTLE')} style={{ marginLeft: 'auto', background: '#444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>強制撤退</button>
                        </div>

                        {/* 召喚 UI */}
                        <div style={{ display: 'flex', gap: '15px', alignItems: 'stretch' }}>
                            <div style={{ flex: 1, background: '#1a1a2a', border: '1px solid #444', borderRadius: '6px', padding: '12px', minHeight: '60px' }}>
                                <div style={{ fontSize: '12px', color: '#aaa', marginBottom: '8px' }}>召喚予定（儀式レシピ）</div>
                                {puzzleState.expectedSummons.length > 0
                                    ? puzzleState.expectedSummons.map((s, i) => (
                                        <span key={i} style={{ color: '#ffd700', fontSize: '15px', fontWeight: 'bold', marginRight: '16px' }}>
                                            {s.name} ×{s.count}
                                        </span>
                                    ))
                                    : <span style={{ color: '#555', fontSize: '13px' }}>パターンを完成させてください</span>
                                }
                            </div>
                            <button
                                onClick={() => puzzleRef.current?.handleSummon()}
                                disabled={!puzzleState.canSummon}
                                style={{
                                    width: '180px', fontSize: '20px', fontWeight: 'bold', borderRadius: '8px', border: 'none',
                                    cursor: puzzleState.canSummon ? 'pointer' : 'not-allowed',
                                    background: puzzleState.canSummon ? 'linear-gradient(135deg, #880000, #cc2200)' : '#333',
                                    color: puzzleState.canSummon ? '#fff' : '#666',
                                    boxShadow: puzzleState.canSummon ? '0 0 16px rgba(200,50,0,0.6)' : 'none',
                                    transition: 'all 0.2s',
                                    textShadow: puzzleState.canSummon ? '0 0 8px rgba(255,100,0,0.8)' : 'none'
                                }}
                            >
                                {puzzleState.summonCooldown ? '⏳ 召喚中…' : puzzleState.canSummon ? '⚡ 召喚！' : '盤面を整えよ'}
                            </button>
                        </div>


                    </div>
                </div>
            </div>
        </div>
    );
};

export default BattlePhase;
