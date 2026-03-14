import React, { useState, useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js';

import { useGame } from '../contexts/GameContext';
import { ROWS, COLS, BLOCK_SIZE, BOARD_WIDTH, BOARD_HEIGHT, COLORS, COLOR_HEX, ALL_RECIPES, FUSION_RECIPES } from '../game/config';
import { UNIT_STATS } from '../game/entities';
import gsap from 'gsap';



interface BlockData {
    type: number;
    row: number;
    col: number;
    id: string;
    isMonster?: boolean;
    monsterId?: string;
}

const RitualPhase: React.FC = () => {
    const { setPhase, addSummonedMonster, clearSummonedMonsters, activeRecipes, currentDay, dailyPieces } = useGame();

    const [grid, setGrid] = useState<(BlockData | null)[][]>(() => Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
    const gridRef = useRef<(BlockData | null)[][]>(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));

    const [expectedSummons, setExpectedSummons] = useState<{ id: string, name: string, count: number }[]>([]);
    const [usedBlocks, setUsedBlocks] = useState<Set<string>>(new Set());



    const [hoveredRecipe, setHoveredRecipe] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    // Pixi Refs
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const blocksLayerRef = useRef<PIXI.Container | null>(null);
    const blockGraphicsMap = useRef<Map<string, PIXI.Graphics>>(new Map());
    const blockPool = useRef<number[]>([]);

    const interactionParams = useRef({
        selectedBlock: null as BlockData | null,
        startPos: { x: 0, y: 0 },
        isDragging: false
    });

    // Initialize Pixi
    useEffect(() => {
        clearSummonedMonsters();

        if (!pixiContainerRef.current) return;

        // Create PIXI Application
        const app = new PIXI.Application({
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            backgroundColor: 0x111111,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
            antialias: true
        });

        pixiContainerRef.current.appendChild(app.view as unknown as Node);
        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
        appRef.current = app;

        // Background Grid (clickable bounds but no action on empty click now)
        const bgLayer = new PIXI.Container();
        app.stage.addChild(bgLayer);
        const bgGr = new PIXI.Graphics();
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                bgGr.lineStyle(2, 0x333333, 0.5);
                bgGr.beginFill(0x1a1a1a);
                bgGr.drawRect(c * BLOCK_SIZE, r * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                bgGr.endFill();
            }
        }
        bgLayer.addChild(bgGr);

        const blocksLayer = new PIXI.Container();
        blocksLayer.sortableChildren = true;
        app.stage.addChild(blocksLayer);
        blocksLayerRef.current = blocksLayer;

        initializePool();
        scatterInitialPieces();

        return () => {
            app.destroy(true, { children: true, texture: true, baseTexture: true });
            appRef.current = null;
            blockGraphicsMap.current.clear(); // Important for React Strict Mode!
        };
    }, []);

    // Sync Grid State to Pixi Rendering
    useEffect(() => {
        if (!blocksLayerRef.current) return;
        renderGrid();
    }, [grid]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    const initializePool = () => {
        let newPool: number[] = [];
        const SETS_PER_RECIPE = 15;
        activeRecipes.forEach(recipe => {
            recipe.pattern.forEach(row => {
                row.forEach(val => {
                    if (val !== -1) {
                        for (let i = 0; i < SETS_PER_RECIPE; i++) {
                            newPool.push(val);
                        }
                    }
                });
            });
        });
        // Shuffle
        newPool.sort(() => Math.random() - 0.5);
        blockPool.current = newPool;
    };

    const drawFromPool = (): number | null => {
        if (blockPool.current.length === 0) return null;
        if (Math.random() < 0.05) {
            blockPool.current.pop(); // 消費
            return 5; // ワイルドカード
        }
        return blockPool.current.pop()!;
    };

    const scatterInitialPieces = () => {
        const newGrid = [...gridRef.current.map(row => [...row])];
        const emptySpots: { r: number, c: number }[] = [];

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!newGrid[r][c]) {
                    emptySpots.push({ r, c });
                }
            }
        }

        emptySpots.sort(() => Math.random() - 0.5);

        for (let i = 0; i < Math.min(dailyPieces, emptySpots.length); i++) {
            const spot = emptySpots[i];
            const type = drawFromPool();
            if (type !== null) {
                newGrid[spot.r][spot.c] = { type, row: spot.r, col: spot.c, id: generateId() };
            }
        }

        setGrid(newGrid);
        gridRef.current = newGrid;
        calculateExpectedSummons(newGrid);
    };

    const createBlockGraphics = (initBlock: BlockData) => {
        const g = new PIXI.Graphics();

        if (initBlock.isMonster && initBlock.monsterId) {
            const recipe = ALL_RECIPES.find(r => r.id === initBlock.monsterId) || FUSION_RECIPES.find(r => r.id === initBlock.monsterId);

            // Gold Background for Monsters
            g.beginFill(0xffd700);
            g.drawRoundedRect(-BLOCK_SIZE / 2 + 2, -BLOCK_SIZE / 2 + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 10);

            // Inner dark
            g.beginFill(0x222222);
            g.drawRoundedRect(-BLOCK_SIZE / 2 + 6, -BLOCK_SIZE / 2 + 6, BLOCK_SIZE - 12, BLOCK_SIZE - 12, 8);

            // Text (first character)
            const textStr = recipe ? recipe.name.charAt(0) : '?';
            const text = new PIXI.Text(textStr, { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
            text.anchor.set(0.5);
            g.addChild(text);
        } else {
            const color = COLORS[initBlock.type];

            // Background
            g.beginFill(0x333333);
            g.drawRoundedRect(-BLOCK_SIZE / 2 + 2, -BLOCK_SIZE / 2 + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4, 10);

            if (initBlock.type === 5) {
                // Wildcard (Rainbow/White)
                g.beginFill(0xFFFFFF);
                g.drawRoundedRect(-BLOCK_SIZE / 2 + 10, -BLOCK_SIZE / 2 + 10, BLOCK_SIZE - 20, BLOCK_SIZE - 20, 15);
                g.endFill();
                const starTxt = new PIXI.Text("★", { fontSize: 16, fill: 0xffaa00, fontWeight: 'bold' });
                starTxt.anchor.set(0.5);
                g.addChild(starTxt);
            } else {
                // Main Color
                g.beginFill(color);
                g.drawRoundedRect(-BLOCK_SIZE / 2 + 10, -BLOCK_SIZE / 2 + 10, BLOCK_SIZE - 20, BLOCK_SIZE - 20, 15);

                // Gloss
                g.beginFill(0xffffff, 0.3);
                g.drawRoundedRect(-BLOCK_SIZE / 2 + 14, -BLOCK_SIZE / 2 + 14, BLOCK_SIZE - 28, (BLOCK_SIZE - 28) / 2, 10);
                g.endFill();
            }
        }

        g.eventMode = 'static';
        g.cursor = 'pointer';

        g.on('pointerdown', (e) => {
            console.log('pointerdown triggered', e.client.x, e.client.y);
            if (interactionParams.current.isDragging) {
                console.log('already dragging, ignoring');
                return; // Prevent multiple drags
            }

            let currentBlock: BlockData | null = null;
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    if (gridRef.current[r][c]?.id === initBlock.id) {
                        currentBlock = gridRef.current[r][c];
                    }
                }
            }
            if (!currentBlock) {
                console.log('current block not found in gridRef');
                return;
            }

            console.log('starting drag for block:', currentBlock.id);
            interactionParams.current.selectedBlock = currentBlock;
            interactionParams.current.isDragging = true;
            gsap.killTweensOf(g); // Stop any drop-in/auto animations!
            g.zIndex = 100;
            g.scale.set(1.1);
            blocksLayerRef.current?.sortChildren();

            const resetDragLocal = (block: BlockData) => {
                const bg = blockGraphicsMap.current.get(block.id);
                if (bg) {
                    bg.zIndex = 0;
                    bg.scale.set(1.0);
                }
                interactionParams.current.isDragging = false;
                interactionParams.current.selectedBlock = null;
                // Force re-render just to snap back if not moved
                setGrid([...gridRef.current.map(row => [...row])]);
            };

            const onMove = (moveEvent: PointerEvent) => {
                const rect = (appRef.current?.view as HTMLCanvasElement).getBoundingClientRect();
                if (!rect) return;

                // Scale correct local coordinates
                const scaleX = BOARD_WIDTH / rect.width;
                const scaleY = BOARD_HEIGHT / rect.height;
                const localX = (moveEvent.clientX - rect.left) * scaleX;
                const localY = (moveEvent.clientY - rect.top) * scaleY;
                console.log('pointermove triggered', localX, localY);

                g.x = localX;
                g.y = localY;
            };

            const onUp = (upEvent: PointerEvent) => {
                console.log('pointerup/cancel triggered', upEvent.type);
                window.removeEventListener('pointermove', onMove);
                window.removeEventListener('pointerup', onUp);
                window.removeEventListener('pointercancel', onUp);

                const rect = (appRef.current?.view as HTMLCanvasElement).getBoundingClientRect();
                if (!rect) {
                    resetDragLocal(currentBlock!);
                    return;
                }
                const scaleX = BOARD_WIDTH / rect.width;
                const scaleY = BOARD_HEIGHT / rect.height;
                const localX = (upEvent.clientX - rect.left) * scaleX;
                const localY = (upEvent.clientY - rect.top) * scaleY;

                const c = Math.floor(localX / BLOCK_SIZE);
                const r = Math.floor(localY / BLOCK_SIZE);

                console.log('drop at r:', r, 'c:', c);

                if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                    if (!gridRef.current[r][c] || gridRef.current[r][c]?.id === currentBlock!.id) {
                        const newGrid = [...gridRef.current.map(row => [...row])];
                        newGrid[currentBlock!.row][currentBlock!.col] = null;
                        newGrid[r][c] = { ...currentBlock!, row: r, col: c };
                        gridRef.current = newGrid;
                        setGrid(newGrid);
                        calculateExpectedSummons(newGrid);
                    }
                }

                resetDragLocal(currentBlock!);
            };

            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
        });

        return g;
    };

    const renderGrid = () => {
        if (!blocksLayerRef.current) return;
        const layer = blocksLayerRef.current;
        const currentIds = new Set<string>();

        grid.forEach((row) => {
            row.forEach((block) => {
                if (!block) return;
                currentIds.add(block.id);

                let g = blockGraphicsMap.current.get(block.id);
                if (!g) {
                    g = createBlockGraphics(block);
                    g.x = block.col * BLOCK_SIZE + BLOCK_SIZE / 2;
                    const targetY = block.row * BLOCK_SIZE + BLOCK_SIZE / 2;
                    g.y = -BLOCK_SIZE; // Start above the board

                    // Drop-in animation
                    gsap.to(g, { y: targetY, duration: 0.25, ease: 'bounce.out', delay: block.row * 0.02 });

                    layer.addChild(g);
                    blockGraphicsMap.current.set(block.id, g);
                }

                const targetX = block.col * BLOCK_SIZE + BLOCK_SIZE / 2;
                const targetY = block.row * BLOCK_SIZE + BLOCK_SIZE / 2;

                const isBeingDragged = interactionParams.current.isDragging && interactionParams.current.selectedBlock?.id === block.id;

                if (!isBeingDragged) {
                    if (Math.abs(g.x - targetX) > 1 || Math.abs(g.y - targetY) > 1) {
                        gsap.to(g, { x: targetX, y: targetY, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });
                    }
                }
            });
        });

        // Cleanup
        blockGraphicsMap.current.forEach((g, id) => {
            if (!currentIds.has(id)) {
                // Animate out (scale down)
                gsap.to(g.scale, {
                    x: 0, y: 0, duration: 0.1, onComplete: () => {
                        layer.removeChild(g);
                        g.destroy();
                    }
                });
                blockGraphicsMap.current.delete(id);
            }
        });
    };





    const calculateExpectedSummons = (currentGrid: (BlockData | null)[][]) => {
        let baseMonsters: string[] = [];
        let usedBlockIds = new Set<string>();

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                activeRecipes.forEach(recipe => {
                    const pRows = recipe.pattern.length;
                    const pCols = recipe.pattern[0].length;
                    if (r + pRows <= ROWS && c + pCols <= COLS) {
                        let matches: BlockData[] = [];
                        let isValid = true;
                        for (let pr = 0; pr < pRows; pr++) {
                            for (let pc = 0; pc < pCols; pc++) {
                                const expectedType = recipe.pattern[pr][pc];
                                if (expectedType !== -1) {
                                    const block = currentGrid[r + pr][c + pc];
                                    if (!block || block.isMonster || (block.type !== expectedType && block.type !== 5)) {
                                        isValid = false;
                                    } else {
                                        matches.push(block);
                                    }
                                }
                            }
                        }
                        if (isValid && matches.length > 0) {
                            baseMonsters.push(recipe.id);
                            matches.forEach(b => usedBlockIds.add(b.id));
                        }
                    }
                });
            }
        }

        // Apply Automatic Fusions based on counts
        const monsterCounts = new Map<string, number>();
        baseMonsters.forEach(m => monsterCounts.set(m, (monsterCounts.get(m) || 0) + 1));

        let fusionMade = true;
        while (fusionMade) {
            fusionMade = false;
            for (const fusion of FUSION_RECIPES) {
                const needed = new Map<string, number>();
                for (const row of fusion.pattern) {
                    for (const id of row) {
                        if (id) needed.set(id, (needed.get(id) || 0) + 1);
                    }
                }

                let canFuse = true;
                for (const [id, count] of needed.entries()) {
                    if ((monsterCounts.get(id) || 0) < count) {
                        canFuse = false;
                        break;
                    }
                }

                if (canFuse) {
                    for (const [id, count] of needed.entries()) {
                        monsterCounts.set(id, monsterCounts.get(id)! - count);
                    }
                    monsterCounts.set(fusion.id, (monsterCounts.get(fusion.id) || 0) + 1);
                    fusionMade = true;
                    break;
                }
            }
        }

        // Convert counts to array
        const expected: { id: string, name: string, count: number }[] = [];
        monsterCounts.forEach((count, id) => {
            if (count > 0) {
                const rec = [...ALL_RECIPES, ...FUSION_RECIPES].find(r => r.id === id);
                if (rec) expected.push({ id, name: rec.name, count });
            }
        });

        setExpectedSummons(expected);
        setUsedBlocks(usedBlockIds);
    };

    const handleFinishRitual = () => {
        if (expectedSummons.length === 0) {
            if (!confirm("魔物が1体も完成していません。このまま防衛フェーズへ進みますか？")) return;
        }

        // Execute Summons
        expectedSummons.forEach(s => {
            for (let i = 0; i < s.count; i++) {
                addSummonedMonster(s.id);
            }
        });

        // Remove used blocks
        const nextGrid = [...gridRef.current.map(row => [...row])];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (nextGrid[r][c] && usedBlocks.has(nextGrid[r][c]!.id)) {
                    nextGrid[r][c] = null;
                }
            }
        }

        setPhase('BATTLE');
    };

    const availableFusions = FUSION_RECIPES; // 全てのフュージョンレシピを表示

    return (
        <div className="ritual-layout">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div className="canvas-container" ref={pixiContainerRef} style={{ position: 'relative', zIndex: 1, border: '1px solid #333' }}>
                    {/* PIXI Canvas is injected here */}
                </div>



                <div style={{ display: 'flex', gap: '15px', height: '100px', width: '100%', position: 'relative', zIndex: 10 }}>
                    <div className="summon-prediction" style={{ margin: 0, height: '100%', flexGrow: 1, overflowY: 'auto', backgroundColor: '#222', padding: '10px', borderRadius: '8px', border: '1px solid #555' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: '#ffbfff' }}>召喚予定リスト</h4>
                        {expectedSummons.length > 0 ? expectedSummons.map((summon, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #333' }}>
                                <span>{summon.name}</span>
                                <span style={{ fontWeight: 'bold', color: '#ffd700' }}>x{summon.count}</span>
                            </div>
                        )) : <div style={{ color: '#888', fontStyle: 'italic' }}>盤面に魔法陣がありません</div>}
                    </div>
                </div>
            </div>

            <div className="side-panel">
                <h2>魔王の儀式 (Day {currentDay})</h2>
                <div className="ap-display">毎ターンの散布数: <span>{dailyPieces}</span></div>

                <div className="recipes-list">
                    {activeRecipes.map(recipe => (
                        <div key={recipe.id} className="recipe-card" style={{ flexDirection: 'column', alignItems: 'flex-start' }}
                            onMouseEnter={() => setHoveredRecipe(recipe.name)}
                            onMouseLeave={() => setHoveredRecipe(null)}
                            onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                                <div className="recipe-name">{recipe.name}</div>
                                {expectedSummons.find(s => s.id === recipe.id) && (
                                    <div style={{ fontWeight: 'bold', color: '#ffd700' }}>x{expectedSummons.find(s => s.id === recipe.id)?.count}</div>
                                )}
                            </div>
                            <div className="recipe-pattern" style={{ gridTemplateColumns: `repeat(${recipe.pattern[0].length}, 1fr)` }}>
                                {recipe.pattern.map((row, ri) => row.map((val, ci) => (
                                    <div
                                        key={`${ri} -${ci} `}
                                        className="recipe-cell"
                                        style={{ backgroundColor: val !== -1 ? COLOR_HEX[val] : 'transparent' }}
                                    />
                                )))}
                            </div>
                        </div>
                    ))}
                    {availableFusions.map(fusion => (
                        <div key={fusion.id} className="recipe-card" style={{ borderLeft: '4px solid #ffaaee', flexDirection: 'column', alignItems: 'flex-start' }}
                            onMouseEnter={() => setHoveredRecipe(fusion.name)}
                            onMouseLeave={() => setHoveredRecipe(null)}
                            onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '4px' }}>
                                <div className="recipe-name" style={{ color: '#ffaaee' }}>{fusion.name}</div>
                                {expectedSummons.find(s => s.id === fusion.id) && (
                                    <div style={{ fontWeight: 'bold', color: '#ffd700' }}>x{expectedSummons.find(s => s.id === fusion.id)?.count}</div>
                                )}
                            </div>
                            <div style={{ display: 'grid', gap: '3px', marginTop: '4px', gridTemplateColumns: `repeat(${fusion.pattern[0].length}, max - content)` }}>
                                {fusion.pattern.map((row, ri) => row.map((val, ci) => {
                                    if (!val) return <div key={`${ri} -${ci} `} style={{ width: '20px', height: '20px' }} />;
                                    const subRecipe = ALL_RECIPES.find(r => r.id === val);
                                    return (
                                        <div key={`${ri} -${ci} `} style={{
                                            width: '20px', height: '20px', backgroundColor: '#ffd700',
                                            color: '#000', fontSize: '10px', display: 'flex',
                                            justifyContent: 'center', alignItems: 'center', borderRadius: '4px', fontWeight: 'bold'
                                        }} title={subRecipe?.name || val}>
                                            {subRecipe ? subRecipe.name.charAt(0) : '?'}
                                        </div>
                                    );
                                }))}
                            </div>
                        </div>
                    ))}
                </div>

                <button className="end-ritual-btn" onClick={handleFinishRitual}>
                    儀式終了 (防衛へ)
                </button>
            </div>

            {hoveredRecipe && UNIT_STATS[hoveredRecipe] && (
                <div style={{
                    position: 'fixed',
                    top: tooltipPos.y + 15,
                    left: tooltipPos.x + 15,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    color: '#fff',
                    padding: '10px 15px',
                    borderRadius: '5px',
                    pointerEvents: 'none',
                    zIndex: 100,
                    border: `1px solid #44ff44`,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '5px', color: '#aaffaa' }}>
                        {hoveredRecipe}
                    </div>
                    <div style={{ fontSize: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 15px' }}>
                        <span>HP: {UNIT_STATS[hoveredRecipe].maxHp}</span>
                        <span>攻撃力: {UNIT_STATS[hoveredRecipe].attack}</span>
                        <span>射程: {UNIT_STATS[hoveredRecipe].range}</span>
                        <span>速度: {UNIT_STATS[hoveredRecipe].speed}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RitualPhase;
