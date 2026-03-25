import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import { useGame } from '../contexts/GameContext';
import type { EntityState } from '../game/entities';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import { ROWS, BLOCK_SIZE as CFG_BLOCK_SIZE, BOARD_WIDTH, ALL_RECIPES } from '../game/config';

const MATERIAL_PREFIX: Record<string, string> = { bone: '骨', meat: '肉', spirit: '霊' };
const getUnitDisplayName = (type: string): string => {
    const parts = type.split('_');
    const suffix = parts[parts.length - 1];
    const baseId = parts.slice(0, -1).join('_');
    const baseName = ALL_RECIPES.find(r => r.id === baseId)?.name;
    const prefix = MATERIAL_PREFIX[suffix];
    if (baseName && prefix) return prefix + baseName;
    if (baseName) return baseName;
    return type;
};

gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

const BLOCK_SIZE = CFG_BLOCK_SIZE;
const FIELD_HEIGHT = ROWS * BLOCK_SIZE;
const DEMON_BASE = { x: 40, y: FIELD_HEIGHT / 2 }; // 左端境界（城なし）

type ProjectileStyle = 'arrow' | 'orb' | 'bomb' | 'sword_flash';

interface Projectile {
    id: string;
    x: number;
    y: number;
    targetId: string | 'base' | 'hero_base';
    targetX: number;
    targetY: number;
    speed: number;
    damage: number;
    color: number;
    style: ProjectileStyle;
    size: number;
    angle: number;
    trail: { x: number; y: number }[];
    isPiercing?: boolean;
    hitIds?: Set<string>;
    maxDistance?: number;
    distanceTraveled?: number;
    isArea?: boolean;
    areaRadius?: number;
    areaMultiplier?: number;
    duration?: number;
    sourceId?: string;
}

interface FloatingText {
    id: string;
    x: number;
    y: number;
    text: string;
    life: number;
    maxLife: number;
    color: number;
    fontSize?: number;
}

function getProjectileStyle(type: string): ProjectileStyle {
    if (type.includes('ボマー') || type.includes('爆弾') || type.includes('特攻') || type.includes('デモリ') || type.includes('アルマゲ')) return 'bomb';
    if (type.includes('スライム') || type.includes('インプ') || type.includes('シャーマン') || type.includes('霊魂') || type.includes('精霊') || type.includes('魔') || type.includes('大魔')) return 'orb';
    if (type.includes('スケルトン') || type.includes('ボーン') || type.includes('ソウル') || type.includes('弓') || type.includes('死の砲台')) return 'arrow';
    if (type.includes('ゴブリン') || type.includes('オーク') || type.includes('騎士') || type.includes('将軍') || type.includes('村人') || type.includes('農夫') || type.includes('剣士') || type.includes('重騎士')) return 'sword_flash';
    return 'orb';
}

function getProjectileColor(type: string, unitColor: number): number {
    const style = getProjectileStyle(type);
    if (style === 'arrow') return 0xddcc88;
    if (style === 'bomb') return 0xff4400;
    if (style === 'orb') return unitColor;
    return unitColor;
}

interface DefensePhaseProps {
    registerSpawn?: (fn: (type: string) => void) => void;
    onStateChange?: (state: {
        wave: number;
        demonCount: number;
        heroCount: number;
        nextWaveIn: number;
        killCount: number;
    }) => void;
}

const DefensePhase: React.FC<DefensePhaseProps> = ({ registerSpawn, onStateChange }) => {
    const {
        summonedMonsters,
        currentDay, incrementDay, setPhase, phase,
        incomingEnemies, ownedRelics, addPendingPuzzlePiece,
        expectedSummons, fieldWidth, registerPixiApp, ritualGrid
    } = useGame();
    const spawnUnitFnRef = useRef<((type: string) => void) | null>(null);
    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const entitiesLayerRef = useRef<PIXI.Container | null>(null);
    const particlesLayerRef = useRef<PIXI.Container | null>(null);
    const projectilesLayerRef = useRef<PIXI.Container | null>(null);
    const floatLayerRef = useRef<PIXI.Container | null>(null);
    const ghostLayerRef = useRef<PIXI.Container | null>(null);
    const baseGraphicsRef = useRef<PIXI.Graphics | null>(null);
    const entityGfxPool = useRef<Map<string, PIXI.Graphics>>(new Map());
    const ghostGfxPool = useRef<Map<string, PIXI.Graphics>>(new Map());
    const floatTextPool = useRef<Map<string, PIXI.Text>>(new Map());
    const particleBatchRef = useRef<PIXI.Graphics | null>(null);
    const projContainerRef = useRef<PIXI.Container | null>(null);
    const projTexturesRef = useRef<Map<string, PIXI.Texture>>(new Map());
    const projSpritePool = useRef<Map<string, PIXI.Sprite>>(new Map());
    const areaBatchRef = useRef<PIXI.Graphics | null>(null);

    const stateRef = useRef({
        entities: [] as EntityState[],
        pendingHeroes: [] as { entity: EntityState, spawnAtFrames: number }[],
        projectiles: [] as Projectile[],
        particles: [] as { id: string, x: number, y: number, vx: number, vy: number, color: number, life: number, size?: number }[],
        floatingTexts: [] as FloatingText[],
        aoeFlashes: [] as { id: string, x: number, y: number, radius: number, maxRadius: number, life: number, maxLife: number, color: number }[],
        hitFlashMap: {} as Record<string, number>,
        wave: 0,
        frameCount: 0,
        nextWaveCountdown: 0,
        waveInProgress: false,
        eliteIds: new Set<string>(),
        killCount: 0,
        phaseEnded: false,
        currentPhase: phase,
        currentIncomingEnemies: incomingEnemies
    });

    useEffect(() => { stateRef.current.currentPhase = phase; }, [phase]);
    useEffect(() => { stateRef.current.currentIncomingEnemies = incomingEnemies; }, [incomingEnemies]);

    // RITUAL開始時に敵を実体スポーン（静止状態）
    useEffect(() => {
        if (phase !== 'RITUAL' || incomingEnemies.length === 0) return;
        const s = stateRef.current;
        s.entities = s.entities.filter(e => e.faction !== 'HERO');
        s.wave = 0; s.waveInProgress = false; s.phaseEnded = false;
        const dayHpMult = 1.0 + (currentDay - 1) * 0.4;
        incomingEnemies.forEach(en => {
            const stats = UNIT_STATS[en.type] || UNIT_STATS['村人'];
            const finalHp = Math.floor(stats.maxHp! * (en.isElite ? 2 : 1) * (en.hpScale ?? 1) * dayHpMult);
            s.entities.push({
                id: en.id, type: en.type, faction: 'HERO',
                x: BOARD_WIDTH + en.col * BLOCK_SIZE + BLOCK_SIZE / 2, y: en.row * BLOCK_SIZE + BLOCK_SIZE / 2,
                hp: finalHp, maxHp: finalHp,
                attack: stats.attack! * (en.isElite ? 1.8 : 1), range: stats.range!,
                speed: stats.speed! * (en.isElite ? 1.15 : 1),
                cooldown: Math.random() * 40, maxCooldown: stats.maxCooldown!,
                color: en.isElite ? 0xffd700 : stats.color!,
            });
        });
    }, [phase, incomingEnemies, currentDay]);

    const [uiState, setUiState] = useState({
        wave: 0,
        demonCount: 0, heroCount: 0, nextWaveIn: 0, killCount: 0,
    });

    useEffect(() => { if (onStateChange) onStateChange(uiState); }, [uiState, onStateChange]);
    const [pinnedEntity, setPinnedEntity] = useState<EntityState | null>(null);
    const [pinnedPos, setPinnedPos] = useState({ x: 0, y: 0 });
    const pinnedEntityInfoRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!pinnedEntity) return;
        const handler = (e: PointerEvent) => {
            const target = e.target as Node;
            const canvas = pixiContainerRef.current?.querySelector('canvas');
            const insideCanvas = canvas && (canvas === target || canvas.contains(target));
            const insideInfo = pinnedEntityInfoRef.current?.contains(target);
            if (!insideCanvas && !insideInfo) setPinnedEntity(null);
        };
        window.addEventListener('pointerdown', handler);
        return () => window.removeEventListener('pointerdown', handler);
    }, [pinnedEntity]);

    const generateId = () => Math.random().toString(36).substr(2, 9);

    useEffect(() => {
        const initialEntities: EntityState[] = [];
        const hasGiantHeart = ownedRelics.includes('giant_heart');
        const hasFireCrown = ownedRelics.includes('fire_crown');

        summonedMonsters.forEach(unit => {
            const stats = UNIT_STATS[unit.type] || UNIT_STATS['orc_bone'] || Object.values(UNIT_STATS)[0];

            let hpMult = hasGiantHeart ? 2.0 : 1.0;
            let atkMult = hasFireCrown ? (stats.color === 0xff3333 ? 1.5 : 0.8) : 1.0;

            // 隣接レベル計算: 上下左右の同タグ素材ピース数
            const unitMaterialType = stats.materialType ?? -1;
            const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
            let adjLevel = 0;
            if (unitMaterialType >= 0) {
                for (const [dr, dc] of dirs) {
                    const cell = ritualGrid[unit.r + dr]?.[unit.c + dc];
                    if (cell && !cell.isSummoned && cell.type === unitMaterialType) adjLevel++;
                }
            }
            const levelMult = 1 + adjLevel * 0.15;
            hpMult *= levelMult;
            atkMult *= levelMult;

            const finalAttack = Math.floor(stats.attack! * atkMult) + (unit.attackBonus || 0);

            const groupX = unit.c * BLOCK_SIZE + BLOCK_SIZE / 2;
            const groupY = unit.r * BLOCK_SIZE + BLOCK_SIZE / 2;

            initialEntities.push({
                id: unit.id, type: unit.type, faction: 'DEMON',
                x: groupX, y: groupY,
                hp: Math.floor(stats.maxHp! * hpMult), maxHp: Math.floor(stats.maxHp! * hpMult),
                attack: finalAttack, range: stats.range!,
                speed: stats.speed!,
                cooldown: Math.random() * (stats.maxCooldown! / 2),
                maxCooldown: stats.maxCooldown!, color: stats.color!,
                passiveAbilities: stats.passiveAbilities ? [...stats.passiveAbilities] : undefined
            });
        });

        // 既存のHEROエンティティを保持（RITUAL中に敵が表示される必要がある）
        const existingHeroes = stateRef.current.entities.filter(e => e.faction === 'HERO');
        stateRef.current.entities = [...initialEntities, ...existingHeroes];
        stateRef.current.nextWaveCountdown = 30;
    }, [summonedMonsters, ownedRelics]);

    useEffect(() => {
        const spawnFn = (type: string) => {
            const stats = UNIT_STATS[type] || UNIT_STATS['orc_bone'] || Object.values(UNIT_STATS)[0];
            const hasGiantHeart = ownedRelics.includes('giant_heart');
            const hasFireCrown = ownedRelics.includes('fire_crown');
            const hpMult = hasGiantHeart ? 2.0 : 1.0;
            const spdMult = hasGiantHeart ? 0.7 : 1.0;
            const atkMult = hasFireCrown ? ((stats.color || 0xffffff) === 0xff3333 ? 1.5 : 0.8) : 1.0;
            const id = generateId();
            const newEnt: EntityState = {
                id, type, faction: 'DEMON',
                x: DEMON_BASE.x + 60 + Math.random() * 60,
                y: 80 + Math.random() * (FIELD_HEIGHT - 160),
                hp: Math.floor(stats.maxHp! * hpMult), maxHp: Math.floor(stats.maxHp! * hpMult),
                attack: Math.floor(stats.attack! * atkMult), range: stats.range!,
                speed: stats.speed! * spdMult, cooldown: 0,
                maxCooldown: stats.maxCooldown!, color: stats.color!,
                passiveAbilities: stats.passiveAbilities ? [...stats.passiveAbilities] : undefined
            };
            stateRef.current.entities.push(newEnt);
        };
        spawnUnitFnRef.current = spawnFn;
        if (registerSpawn) registerSpawn(spawnFn);
    }, [registerSpawn, ownedRelics]);


    useEffect(() => {
        if (!pixiContainerRef.current) return;
        const devicePixelRatio = window.devicePixelRatio || 1;
        // モバイル等のテクスチャサイズ制限（通常4096pxや8192px）を考慮し、
        // 物理ピクセルサイズが巨大になりすぎる場合は解像度を下げてクラッシュを防ぐ
        const safeResolution = (fieldWidth * devicePixelRatio > 4096) ? Math.max(1, 4096 / fieldWidth) : devicePixelRatio;

        const app = new PIXI.Application({
            width: fieldWidth, height: FIELD_HEIGHT, backgroundColor: 0x111a11,
            resolution: safeResolution, autoDensity: true, antialias: false,
            powerPreference: 'high-performance'
        });
        pixiContainerRef.current.appendChild(app.view as unknown as Node);
        const canvas = app.view as HTMLCanvasElement;
        canvas.style.willChange = 'transform';
        canvas.style.transform = 'translateZ(0)';
        appRef.current = app;
        registerPixiApp(app); // 共有PIXIアプリとしてGameContextに登録

        const baseGraphics = new PIXI.Graphics(); app.stage.addChild(baseGraphics); baseGraphicsRef.current = baseGraphics;
        const entitiesLayer = new PIXI.Container(); app.stage.addChild(entitiesLayer); entitiesLayerRef.current = entitiesLayer;
        const projectilesLayer = new PIXI.Container(); app.stage.addChild(projectilesLayer); projectilesLayerRef.current = projectilesLayer;

        // ── Projectile textures (generated once, reused as sprites) ──
        const textures = new Map<string, PIXI.Texture>();

        const arrowG = new PIXI.Graphics();
        arrowG.lineStyle(2, 0xffffff, 1); arrowG.moveTo(0, 8); arrowG.lineTo(44, 8); arrowG.lineStyle(0);
        arrowG.beginFill(0xffffff); arrowG.drawPolygon([60, 8, 44, 2, 44, 14]); arrowG.endFill();
        textures.set('arrow', app.renderer.generateTexture(arrowG, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 1, region: new PIXI.Rectangle(0, 0, 60, 16) }));
        arrowG.destroy();

        const orbG = new PIXI.Graphics();
        orbG.beginFill(0xffffff, 0.25); orbG.drawCircle(16, 16, 16); orbG.endFill();
        orbG.beginFill(0xffffff, 0.9); orbG.drawCircle(16, 16, 8); orbG.endFill();
        orbG.beginFill(0xffffff, 1.0); orbG.drawCircle(16, 16, 4); orbG.endFill();
        textures.set('orb', app.renderer.generateTexture(orbG, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 1, region: new PIXI.Rectangle(0, 0, 32, 32) }));
        orbG.destroy();

        const bombG = new PIXI.Graphics();
        bombG.beginFill(0xff6600, 0.4); bombG.drawCircle(20, 20, 20); bombG.endFill();
        bombG.beginFill(0xff2200, 0.9); bombG.drawCircle(20, 20, 10); bombG.endFill();
        bombG.lineStyle(1.5, 0xffff00, 0.8);
        bombG.moveTo(20, 10); bombG.lineTo(20, 30); bombG.moveTo(10, 20); bombG.lineTo(30, 20); bombG.lineStyle(0);
        textures.set('bomb', app.renderer.generateTexture(bombG, { scaleMode: PIXI.SCALE_MODES.LINEAR, resolution: 1, region: new PIXI.Rectangle(0, 0, 40, 40) }));
        bombG.destroy();

        projTexturesRef.current = textures;
        const projContainer = new PIXI.Container(); projectilesLayer.addChild(projContainer); projContainerRef.current = projContainer;
        const areaBatch = new PIXI.Graphics(); projectilesLayer.addChild(areaBatch); areaBatchRef.current = areaBatch;
        const particlesLayer = new PIXI.Container(); app.stage.addChild(particlesLayer); particlesLayerRef.current = particlesLayer;
        const floatLayer = new PIXI.Container(); app.stage.addChild(floatLayer); floatLayerRef.current = floatLayer;
        const ghostLayer = new PIXI.Container(); ghostLayer.alpha = 0.5; app.stage.addChild(ghostLayer); ghostLayerRef.current = ghostLayer;

        // Static background (drawn once, never redrawn)
        const staticBgGr = new PIXI.Graphics();
        const gridWidth = BOARD_WIDTH;

        // 0. Demon area fill
        staticBgGr.beginFill(0x220022, 0.5);
        staticBgGr.drawRect(0, 0, gridWidth, FIELD_HEIGHT);
        staticBgGr.endFill();

        // 1. Grid lines
        staticBgGr.lineStyle(1, 0x223322, 0.4);
        for (let x = 0; x <= gridWidth; x += BLOCK_SIZE) {
            staticBgGr.moveTo(x, 0); staticBgGr.lineTo(x, FIELD_HEIGHT);
        }
        for (let y = 0; y <= FIELD_HEIGHT; y += BLOCK_SIZE) {
            staticBgGr.moveTo(0, y); staticBgGr.lineTo(fieldWidth, y);
        }

        // 2. Castle Wall boundary
        staticBgGr.lineStyle(4, 0x550055, 0.8);
        staticBgGr.moveTo(gridWidth, 0);
        staticBgGr.lineTo(gridWidth, FIELD_HEIGHT);
        for (let y = 20; y < FIELD_HEIGHT; y += 40) {
            staticBgGr.lineStyle(2, 0x333344, 0.6);
            staticBgGr.drawRect(gridWidth - 5, y, 10, 20);
        }

        // 3. Battlefield grid (right side)
        staticBgGr.lineStyle(1, 0x1a1a1a, 0.3);
        const startX = gridWidth + BLOCK_SIZE;
        for (let x = startX; x < fieldWidth; x += BLOCK_SIZE) {
            staticBgGr.moveTo(x, 0); staticBgGr.lineTo(x, FIELD_HEIGHT);
        }
        staticBgGr.lineStyle(0);
        baseGraphics.addChild(staticBgGr);

        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, fieldWidth, FIELD_HEIGHT);
        app.stage.on('pointerdown', () => setPinnedEntity(null));
        app.ticker.add((delta) => { updateLogic(delta); renderGraphics(); });

        return () => {
            entityGfxPool.current.clear(); floatTextPool.current.clear();
            projSpritePool.current.forEach(s => s.destroy());
            projSpritePool.current.clear();
            projTexturesRef.current.forEach(t => t.destroy());
            projTexturesRef.current.clear();
            registerPixiApp(null); // 共有登録解除
            app.destroy(true, { children: true }); appRef.current = null;
        };
    }, [fieldWidth, registerPixiApp]); // Add fieldWidth dependency to re-init app if it changes

    const spawnWave = useCallback(() => {
        const s = stateRef.current;
        if (s.waveInProgress) return;
        s.waveInProgress = true;

        // 既存HEROを削除してRITUALプレスポーン分と重複しないよう再配置
        s.entities = s.entities.filter(e => e.faction !== 'HERO');
        const dayHpMult = 1.0 + (currentDay - 1) * 0.4;

        s.currentIncomingEnemies.forEach(en => {
            const stats = UNIT_STATS[en.type] || UNIT_STATS['村人'];
            const isElite = en.isElite;
            if (isElite) s.eliteIds.add(en.id);
            const finalHp = Math.floor(stats.maxHp! * (isElite ? 2 : 1) * dayHpMult);
            s.entities.push({
                id: en.id, type: en.type, faction: 'HERO',
                x: BOARD_WIDTH + en.col * BLOCK_SIZE + BLOCK_SIZE / 2,
                y: en.row * BLOCK_SIZE + BLOCK_SIZE / 2,
                hp: finalHp, maxHp: finalHp,
                attack: stats.attack! * (isElite ? 1.8 : 1), range: stats.range!,
                speed: stats.speed! * (isElite ? 1.15 : 1),
                cooldown: Math.random() * 40, maxCooldown: stats.maxCooldown!,
                color: isElite ? 0xffd700 : stats.color!,
            });
        });

    }, [currentDay]);

    // ── Spawn a projectile ────────────────
    const spawnProjectile = (attacker: EntityState, target: EntityState | 'base' | 'hero_base' | 'forward') => {
        const s = stateRef.current;
        const tx = (target === 'forward') ? (attacker.x + 2000) : ((typeof target === 'string') ? DEMON_BASE.x : target.x);
        const ty = (target === 'forward') ? attacker.y : ((typeof target === 'string') ? DEMON_BASE.y : target.y);
        const dx = tx - attacker.x;
        const dy = ty - attacker.y;
        const angle = Math.atan2(dy, dx);
        const style = getProjectileStyle(attacker.type);
        const projSpeed = style === 'arrow' ? 6 : style === 'bomb' ? 3.5 : style === 'orb' ? 5 : 4;

        let isPiercing = false;
        let maxDistance = Infinity;
        let isArea = false;
        let areaRadius = 0;
        let areaMultiplier = 1;

        // Check for specific abilities
        if (attacker.passiveAbilities) {
            attacker.passiveAbilities.forEach(pa => {
                if (pa.type === 'PIERCING') {
                    isPiercing = true;
                    maxDistance = pa.value || 600;
                }
                if (pa.type === 'AREA_DOT') {
                    isArea = true;
                    areaRadius = pa.range || 60;
                    areaMultiplier = pa.value || 1;
                }
            });
        }

        // 非PIERCINGの通常弾もattacker.rangeを最大飛距離として設定（無限追跡防止）
        if (!isPiercing && maxDistance === Infinity) {
            maxDistance = attacker.range;
        }

        const isHeal = attacker.passiveAbilities?.some(pa => pa.type === 'HEAL_SHOT');
        const projDamage = isHeal ? -attacker.attack : attacker.attack; // Heal as negative damage
        const projColor = isHeal ? 0x44ff44 : getProjectileColor(attacker.type, attacker.color);

        const finalTargetX = isPiercing ? attacker.x + Math.cos(angle) * 2000 : tx;
        const finalTargetY = isPiercing ? attacker.y + Math.sin(angle) * 2000 : ty;

        s.projectiles.push({
            id: generateId(),
            x: attacker.x, y: attacker.y,
            targetId: (typeof target === 'string') ? target : target.id,
            targetX: finalTargetX, targetY: finalTargetY,
            speed: projSpeed,
            damage: projDamage,
            color: projColor,
            style,
            size: (style === 'bomb' || isArea) ? 14 : style === 'orb' ? 10 : 6,
            angle,
            trail: [],
            isPiercing,
            hitIds: new Set(),
            maxDistance,
            distanceTraveled: 0,
            isArea,
            areaRadius,
            areaMultiplier,
            sourceId: attacker.id
        });
    };

    // ── Main logic ────────────────────────
    const updateLogic = (delta: number) => {
        const s = stateRef.current;
        s.frameCount++;

        if (s.currentPhase !== 'BATTLE') return;

        // バトル開始トリガー（初回のみ）
        if (!s.waveInProgress) {
            spawnWave();
        }


        const entities = s.entities;
        const aliveEntities: EntityState[] = [];
        let heroCount = 0, demonCount = 0;

        const applyDamage = (targetEnt: EntityState, dmgRaw: number, attacker?: EntityState) => {
            if (dmgRaw < 0) {
                // Heal
                targetEnt.hp = Math.min(targetEnt.maxHp, targetEnt.hp - dmgRaw);
                s.floatingTexts.push({ id: generateId(), x: targetEnt.x, y: targetEnt.y - 15, text: '+' + Math.floor(-dmgRaw), life: 55, maxLife: 55, color: 0x44ff44 });
            } else {
                let finalDamage = dmgRaw;

                // ATK_BUFF (Bone Wizard) check
                if (attacker && attacker.faction === 'DEMON') {
                    let buffCount = 0;
                    for (const other of entities) {
                        if (other.hp > 0 && other.faction === 'DEMON' && other.passiveAbilities) {
                            const ba = other.passiveAbilities.find(pa => pa.type === 'ATK_BUFF');
                            if (ba && Math.hypot(other.x - attacker.x, other.y - attacker.y) < (ba.range || 120)) {
                                buffCount++;
                            }
                        }
                    }
                    if (buffCount > 0) {
                        finalDamage *= (1.0 + buffCount * 0.2); // 1.2x per wizard
                    }
                }

                // Paladin Damage Reduction Aura
                if (targetEnt.faction === 'HERO' && targetEnt.type !== 'パラディン') {
                    for (const p of entities) {
                        if (p.faction === 'HERO' && p.type === 'パラディン' && p.hp > 0 && p.id !== targetEnt.id) {
                            if (Math.hypot(p.x - targetEnt.x, p.y - targetEnt.y) < 150) {
                                finalDamage *= 0.5; // 50% damage blocked by Paladin
                                // Optional particle for block
                                if (Math.random() < 0.3) s.particles.push({ id: generateId(), x: targetEnt.x, y: targetEnt.y - 10, vx: 0, vy: -1, color: 0xffdd44, life: 20 });
                                break; // Only need one paladin buff
                            }
                        }
                    }
                }
                targetEnt.hp -= finalDamage;
                s.hitFlashMap[targetEnt.id] = 8;
                const hitColor = targetEnt.faction === 'DEMON' ? 0xff4444 : 0x88ff88;
                const dmgAmt = Math.floor(finalDamage);
                const dmgFontSize = Math.min(32, Math.max(16, 16 + Math.floor(dmgAmt / 20)));
                s.floatingTexts.push({ id: generateId(), x: targetEnt.x + (Math.random() - 0.5) * 20, y: targetEnt.y - 20, text: '-' + dmgAmt, life: 50, maxLife: 50, color: hitColor, fontSize: dmgFontSize });

                // REFLECT Ability (Bone Orc)
                if (targetEnt.passiveAbilities && attacker && attacker.hp > 0) {
                    const reflect = targetEnt.passiveAbilities.find(pa => pa.type === 'REFLECT');
                    if (reflect && reflect.value) {
                        const reflectedDmg = finalDamage * reflect.value;
                        attacker.hp -= reflectedDmg;
                        s.floatingTexts.push({ id: generateId(), x: attacker.x, y: attacker.y - 15, text: '💥反射 ' + Math.floor(reflectedDmg), life: 40, maxLife: 40, color: 0xcccccc });
                        // Reflection particles
                        for (let k = 0; k < 2; k++) {
                            s.particles.push({ id: generateId(), x: targetEnt.x, y: targetEnt.y, vx: (attacker.x - targetEnt.x) * 0.05, vy: (attacker.y - targetEnt.y) * 0.05, color: 0xdddddd, life: 15 });
                        }
                    }
                }
            }
        };

        for (let i = 0; i < entities.length; i++) {
            const ent = entities[i];
            if (ent.hp <= 0) {
                const isElite = s.eliteIds.has(ent.id);
                const pCount = Math.min(24, Math.floor(ent.maxHp / 20) + 8);
                for (let j = 0; j < pCount; j++) {
                    const a = Math.random() * Math.PI * 2;
                    const sp = 1.5 + Math.random() * 4.5;
                    const size = 2 + Math.random() * 4;
                    s.particles.push({ id: generateId(), x: ent.x, y: ent.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.5, color: isElite ? 0xffdd00 : ent.color, life: 35 + Math.random() * 30, size });
                }
                // Bomber/Demolisher/Armageddon: AoE death explosion
                const isBomberType = ['ボマー', 'デモリッシャー', 'アルマゲドン'].some(t => ent.type.includes(t));
                if (ent.faction === 'DEMON' && isBomberType) {
                    const aoeR = 100;
                    for (const other of entities) {
                        if (other.faction === 'HERO' && other.hp > 0 && Math.hypot(other.x - ent.x, other.y - ent.y) < aoeR) {
                            other.hp -= ent.attack * 0.8;
                        }
                    }
                    // Big explosion ring
                    for (let j = 0; j < 20; j++) {
                        const a = Math.random() * Math.PI * 2;
                        s.particles.push({ id: generateId(), x: ent.x, y: ent.y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4 - 1, color: 0xff6600, life: 50 });
                    }
                    s.floatingTexts.push({ id: generateId(), x: ent.x, y: ent.y - 20, text: '💥 AoE!', life: 70, maxLife: 70, color: 0xff6600 });
                }
                // PIECE_RETURN Ability (Bone Necromancer)
                if (ent.faction === 'DEMON') {
                    // Check if a Bone Necromancer is nearby
                    for (const other of entities) {
                        if (other.hp > 0 && other.faction === 'DEMON' && other.passiveAbilities) {
                            const ability = other.passiveAbilities.find(pa => pa.type === 'PIECE_RETURN');
                            if (ability && Math.hypot(other.x - ent.x, other.y - ent.y) < (ability.range || 150)) {
                                addPendingPuzzlePiece(0); // 常に骨を返却
                                s.floatingTexts.push({ id: generateId(), x: other.x, y: other.y - 30, text: '♻️骨の回収', life: 60, maxLife: 60, color: 0xffffff });
                                break;
                            }
                        }
                    }

                    // CORPSE_EXPLOSION Ability (Spirit Necromancer)
                    for (const other of entities) {
                        if (other.hp > 0 && other.faction === 'DEMON' && other.passiveAbilities) {
                            const ability = other.passiveAbilities.find(pa => pa.type === 'CORPSE_EXPLOSION');
                            if (ability && Math.hypot(other.x - ent.x, other.y - ent.y) < (ability.range || 150)) {
                                const expDmg = other.attack * (ability.value || 1);
                                // Visual & Damage
                                for (const hero of entities) {
                                    if (hero.faction === 'HERO' && hero.hp > 0 && Math.hypot(hero.x - ent.x, hero.y - ent.y) < 80) {
                                        applyDamage(hero, expDmg, other);
                                    }
                                }
                                for (let k = 0; k < 12; k++) {
                                    const a = Math.random() * Math.PI * 2;
                                    s.particles.push({ id: generateId(), x: ent.x, y: ent.y, vx: Math.cos(a) * 3, vy: Math.sin(a) * 3, color: 0xaa00ff, life: 30 });
                                }
                                s.floatingTexts.push({ id: generateId(), x: other.x, y: other.y - 30, text: '💥死霊爆発', life: 60, maxLife: 60, color: 0xaa00ff });
                                break;
                            }
                        }
                    }
                }

                // Kill count
                if (ent.faction === 'HERO') {
                    s.killCount++;
                    if (isElite) s.eliteIds.delete(ent.id);

                    // Necromancer Guide effect (Relic)
                    if (ownedRelics.includes('necromancer_guide') && Math.random() < 0.25) {
                        const skelStats = UNIT_STATS['skeleton'] || UNIT_STATS['goblin'];
                        const hasGiantHeart = ownedRelics.includes('giant_heart');
                        const hasFireCrown = ownedRelics.includes('fire_crown');
                        let hpMult = hasGiantHeart ? 2.0 : 1.0;
                        let spdMult = hasGiantHeart ? 0.7 : 1.0;
                        let atkMult = hasFireCrown ? (skelStats.color === 0xff3333 ? 1.5 : 0.8) : 1.0;

                        const newSkel = {
                            id: generateId(), type: 'skeleton', faction: 'DEMON' as const,
                            x: ent.x, y: ent.y,
                            hp: Math.floor(skelStats.maxHp! * hpMult), maxHp: Math.floor(skelStats.maxHp! * hpMult),
                            attack: Math.floor(skelStats.attack! * atkMult), range: skelStats.range!,
                            speed: skelStats.speed! * spdMult, cooldown: 0,
                            maxCooldown: skelStats.maxCooldown!, color: skelStats.color!
                        };
                        aliveEntities.push(newSkel);
                        for (let k = 0; k < 10; k++) {
                            const a = Math.random() * Math.PI * 2;
                            s.particles.push({ id: generateId(), x: ent.x, y: ent.y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 - 1, color: 0xaa00ff, life: 30 });
                        }
                    }
                }
                continue;
            }
            if (ent.faction === 'HERO') heroCount++; else demonCount++;


            let target: EntityState | null = null;
            let minDist = Infinity;

            if (ent.faction === 'HERO') {
                if (ent.type === 'プリースト') {
                    // Priest targets wounded allies to heal
                    let lowestHpRatio = 1.0;
                    for (let j = 0; j < entities.length; j++) {
                        const other = entities[j];
                        if (other.faction === 'HERO' && other.hp > 0 && other.id !== ent.id && other.hp < other.maxHp) {
                            const d = Math.hypot(other.x - ent.x, other.y - ent.y);
                            if (d <= ent.range) {
                                const hpRatio = other.hp / other.maxHp;
                                if (hpRatio < lowestHpRatio) {
                                    lowestHpRatio = hpRatio;
                                    target = other;
                                    minDist = d;
                                }
                            }
                        }
                    }
                } else {
                    // 最近の魔物（レーン無制限）
                    for (let j = 0; j < entities.length; j++) {
                        const other = entities[j];
                        if (other.faction === 'DEMON' && other.hp > 0) {
                            const d = Math.hypot(other.x - ent.x, other.y - ent.y);
                            if (d < minDist) { minDist = d; target = other; }
                        }
                    }
                }
            } else {
                const isHealer = ent.passiveAbilities?.some(pa => pa.type === 'HEAL_SHOT');

                if (isHealer) {
                    // Support Logic: Target lowest HP ally
                    let lowestHpRatio = 1.0;
                    for (let j = 0; j < entities.length; j++) {
                        const other = entities[j];
                        if (other.faction === 'DEMON' && other.hp > 0 && other.hp < other.maxHp) {
                            const d = Math.hypot(other.x - ent.x, other.y - ent.y);
                            if (d <= ent.range + 50) {
                                const hpRatio = other.hp / other.maxHp;
                                if (hpRatio < lowestHpRatio) {
                                    lowestHpRatio = hpRatio;
                                    target = other;
                                    minDist = d;
                                }
                            }
                        }
                    }
                } else {
                    // その他魔物: 射程内の最近敵をオートエイム
                    for (let j = 0; j < entities.length; j++) {
                        const other = entities[j];
                        if (other.faction === 'HERO' && other.hp > 0) {
                            const d = Math.hypot(other.x - ent.x, other.y - ent.y);
                            if (d < minDist) { minDist = d; target = other; }
                        }
                    }
                }
            }

            if (ent.cooldown > 0) ent.cooldown -= delta;

            if (target) {
                if (minDist <= ent.range) {
                    if (ent.cooldown <= 0) {
                        ent.cooldown = ent.maxCooldown;
                        const instantAoe = ent.passiveAbilities?.find(pa => pa.type === 'INSTANT_AOE');
                        if (instantAoe) {
                            // 弾なし：敵の位置に直接範囲ダメージ
                            const aoeRadius = instantAoe.range || 120;
                            const aoeDamage = instantAoe.value || ent.attack;
                            entities.forEach(other => {
                                if (other.faction === 'HERO' && other.hp > 0) {
                                    if (Math.hypot(other.x - target.x, other.y - target.y) <= aoeRadius) {
                                        applyDamage(other, aoeDamage, ent);
                                    }
                                }
                            });
                            // 爆発エフェクト：AoEフラッシュ円 + パーティクル
                            s.aoeFlashes.push({ id: generateId(), x: target.x, y: target.y, radius: 10, maxRadius: aoeRadius, life: 25, maxLife: 25, color: 0x9900ff });
                            for (let k = 0; k < 18; k++) {
                                const a = Math.random() * Math.PI * 2;
                                const spd = 1.5 + Math.random() * 3;
                                s.particles.push({ id: generateId(), x: target.x, y: target.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, color: k % 2 === 0 ? 0xcc44ff : 0xffffff, life: 30, size: 3 });
                            }
                        } else {
                            const style = getProjectileStyle(ent.type);
                            if (style === 'sword_flash' || ent.range <= 60) {
                                applyDamage(target, ent.attack, ent);
                                for (let k = 0; k < 3; k++) {
                                    const a = Math.random() * Math.PI * 2;
                                    s.particles.push({ id: generateId(), x: target.x, y: target.y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, color: 0xffffff, life: 10 });
                                }
                            } else {
                                spawnProjectile(ent, target);
                            }
                        }
                    }
                } else if (ent.faction === 'DEMON') {
                    const a = Math.atan2(target.y - ent.y, target.x - ent.x);
                    ent.x += Math.cos(a) * ent.speed * delta;
                    ent.y += Math.sin(a) * ent.speed * delta;
                }
            } else if (ent.faction === 'DEMON') {
                // ターゲットなし: 敵陣中央へ前進
                const a = Math.atan2(FIELD_HEIGHT / 2 - ent.y, BOARD_WIDTH * 1.5 - ent.x);
                ent.x += Math.cos(a) * ent.speed * delta;
                ent.y += Math.sin(a) * ent.speed * delta;
            }


            // Separation
            const SEPARATION_RADIUS = 36;
            for (let j = 0; j < entities.length; j++) {
                if (i === j) continue;
                const other = entities[j];
                if (other.faction === ent.faction && other.hp > 0) {
                    const dx = ent.x - other.x;
                    const dy = ent.y - other.y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq < SEPARATION_RADIUS * SEPARATION_RADIUS) {
                        if (distSq < 0.01) {
                            ent.x += (Math.random() - 0.5) * 2;
                            ent.y += (Math.random() - 0.5) * 2;
                        } else {
                            const dist = Math.sqrt(distSq);
                            const pushForce = (SEPARATION_RADIUS - dist) / SEPARATION_RADIUS;
                            ent.x += (dx / dist) * pushForce * 2.0;
                            ent.y += (dy / dist) * pushForce * 2.0;
                        }
                    }
                }
            }

            // --- Passive Ability Updates (AURA, CLONE) ---
            if (ent.hp > 0 && ent.faction === 'DEMON' && ent.passiveAbilities) {
                ent.passiveAbilities.forEach(pa => {
                    if (pa.type === 'AURA_REGEN' && s.frameCount % 60 === 0) {
                        // Healing Aura (every 1s)
                        const range = pa.range || 100;
                        const heel = pa.value || 1;
                        entities.forEach(other => {
                            if (other.faction === 'DEMON' && other.hp > 0 && Math.hypot(other.x - ent.x, other.y - ent.y) < range) {
                                applyDamage(other, -heel);
                                // Healing upward particles
                                if (Math.random() < 0.4) {
                                    s.particles.push({ id: generateId(), x: other.x + (Math.random() - 0.5) * 15, y: other.y, vx: 0, vy: -1.2, color: 0x44ff44, life: 25 });
                                }
                            }
                        });
                        // Visual effect for aura
                        for (let k = 0; k < 6; k++) {
                            const a = Math.random() * Math.PI * 2;
                            s.particles.push({ id: generateId(), x: ent.x + Math.cos(a) * range, y: ent.y + Math.sin(a) * range, vx: -Math.cos(a) * 0.5, vy: -Math.sin(a) * 0.5, color: 0x44ff44, life: 30 });
                        }
                    }
                    if (pa.type === 'ATK_BUFF' && s.frameCount % 60 === 0) {
                        // Attack Buff Visual (Orange ring)
                        const range = pa.range || 120;
                        for (let k = 0; k < 8; k++) {
                            const a = Math.random() * Math.PI * 2;
                            s.particles.push({
                                id: generateId(),
                                x: ent.x + Math.cos(a) * range,
                                y: ent.y + Math.sin(a) * range,
                                vx: -Math.cos(a) * 0.3,
                                vy: -Math.sin(a) * 0.3,
                                color: 0xffaa44,
                                life: 35
                            });
                        }
                    }
                    if (pa.type === 'SUMMON') {
                        if (s.frameCount % (pa.cooldown || 360) === 0) {
                            // Summons a Zombie
                            const stats = UNIT_STATS['zombie']!;
                            const zombie: EntityState = {
                                id: generateId(), type: 'ゾンビ', faction: 'DEMON',
                                x: ent.x + (Math.random() - 0.5) * 40,
                                y: ent.y + (Math.random() - 0.5) * 40,
                                hp: stats.maxHp!, maxHp: stats.maxHp!,
                                attack: stats.attack!, range: stats.range!,
                                speed: stats.speed!, cooldown: 0,
                                maxCooldown: stats.maxCooldown!, color: stats.color!
                            };
                            aliveEntities.push(zombie);
                            s.floatingTexts.push({ id: generateId(), x: ent.x, y: ent.y - 20, text: '🧟召喚', life: 60, maxLife: 60, color: 0x44aa44 });
                        }
                    }
                });
            }

            ent.x = Math.max(20, Math.min(fieldWidth - 20, ent.x));
            ent.y = Math.max(20, Math.min(FIELD_HEIGHT - 20, ent.y));
            aliveEntities.push(ent);
        }
        s.entities = aliveEntities;

        // ── Update projectiles ──────────────
        const entityMap = new Map<string, EntityState>();
        aliveEntities.forEach(e => entityMap.set(e.id, e));

        const aliveProjectiles: Projectile[] = [];
        for (const proj of s.projectiles) {
            // Update target position if target still alive (EXCEPT for Piercing/Area which are coordinate-based)
            if (proj.targetId !== 'base' && proj.targetId !== 'hero_base' && proj.targetId !== 'forward' && !proj.isPiercing && !proj.isArea) {
                const liveTarget = entityMap.get(proj.targetId);
                if (liveTarget) {
                    proj.targetX = liveTarget.x;
                    proj.targetY = liveTarget.y;
                } else {
                    // Target died and not a coordinate-based bullet -> disappear
                    continue;
                }
            }

            // Save trail
            proj.trail.push({ x: proj.x, y: proj.y });
            if (proj.trail.length > 5) proj.trail.shift();

            // Move toward target
            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const dist = Math.hypot(dx, dy);
            proj.angle = Math.atan2(dy, dx);

            let hitAnything = false;

            // 'forward' 弾: 毎フレーム近接チェックで最初に触れた敵に命中
            if (proj.targetId === 'forward') {
                for (const t of aliveEntities) {
                    if (t.faction === 'HERO' && t.hp > 0) {
                        if (Math.hypot(t.x - proj.x, t.y - proj.y) < BLOCK_SIZE / 2) {
                            const attacker = proj.sourceId ? entityMap.get(proj.sourceId) : undefined;
                            applyDamage(t, proj.damage, attacker);
                            hitAnything = true;
                            break;
                        }
                    }
                }
                // 画面外に出たら削除
                if (proj.x > fieldWidth + 50) hitAnything = true;
            } else if (dist < proj.speed * delta + 10) {
                // Hit!
                if (proj.targetId === 'base') {
                    // 城への攻撃は無効（敵の目的は味方の全滅）
                    hitAnything = true;
                } else if (!proj.isArea) {
                    // Single target (Non-piercing) logic
                    const t = entityMap.get(proj.targetId!);
                    if (t && t.hp > 0) {
                        const attacker = proj.sourceId ? entityMap.get(proj.sourceId) : undefined;
                        applyDamage(t, proj.damage, attacker);
                        hitAnything = true;
                    }
                }
            }

            if (hitAnything) {
                // Hit particles
                const hitCount = proj.style === 'bomb' ? 10 : 4;
                for (let k = 0; k < hitCount; k++) {
                    const a = Math.random() * Math.PI * 2;
                    const sp = 1 + Math.random() * 3;
                    s.particles.push({ id: generateId(), x: proj.x, y: proj.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, color: proj.color, life: 25 + Math.random() * 15 });
                }
                continue; // remove projectile
            }

            // --- Piercing collision check (every frame while moving) ---
            if (proj.isPiercing) {
                entities.forEach(t => {
                    if (t && t.hp > 0 && t.faction === 'HERO' && !proj.hitIds?.has(t.id)) {
                        const d = Math.hypot(t.x - proj.x, t.y - proj.y);
                        if (d < BLOCK_SIZE / 2) {
                            const attacker = proj.sourceId ? entityMap.get(proj.sourceId) : undefined;
                            applyDamage(t, proj.damage, attacker);
                            if (proj.hitIds) proj.hitIds.add(t.id);
                            // Visual feedback for piercing hit
                            for (let k = 0; k < 2; k++) {
                                const a = Math.random() * Math.PI * 2;
                                s.particles.push({ id: generateId(), x: proj.x, y: proj.y, vx: Math.cos(a), vy: Math.sin(a), color: proj.color, life: 10 });
                            }
                        }
                    }
                });
            }

            // Zone Damage (DOT)
            if (proj.isArea) {
                const zoneR = proj.areaRadius || 60;
                if (proj.duration === undefined && dist < proj.speed * delta + 10) {
                    proj.duration = 180; // 3 seconds
                    proj.speed = 0;
                }
                if (proj.duration !== undefined && proj.duration > 0) {
                    proj.duration -= delta;
                    if (s.frameCount % 20 === 0) { // every 0.33s
                        entities.forEach(targetEnt => {
                            if (targetEnt.faction === 'HERO' && targetEnt.hp > 0) {
                                const d = Math.hypot(targetEnt.x - proj.x, targetEnt.y - proj.y);
                                if (d < zoneR) {
                                    const attacker = proj.sourceId ? entityMap.get(proj.sourceId) : undefined;
                                    applyDamage(targetEnt, proj.damage * (proj.areaMultiplier || 1), attacker);
                                }
                            }
                        });
                    }
                    if (proj.duration <= 0) continue; // remove zone
                }
            }

            if (proj.speed > 0) {
                const stepX = (dx / dist) * proj.speed * delta;
                const stepY = (dy / dist) * proj.speed * delta;
                proj.x += stepX;
                proj.y += stepY;
                proj.distanceTraveled = (proj.distanceTraveled || 0) + Math.hypot(stepX, stepY);
            }

            // 飛距離超過で消滅（PIERCINGも通常弾も共通）
            if ((proj.distanceTraveled || 0) > (proj.maxDistance || Infinity)) {
                continue;
            }

            aliveProjectiles.push(proj);
        }
        s.projectiles = aliveProjectiles;

        // Lose condition: DEMONが全滅
        if (demonCount === 0 && heroCount > 0 && !s.phaseEnded) {
            s.phaseEnded = true;
            setTimeout(() => setPhase('RESULT'), 1500);
        }

        // Win condition: 城が破壊された
        const castleAlive = aliveEntities.some(e => e.type === 'ボス' && e.faction === 'HERO');
        if (!castleAlive && s.waveInProgress && !s.phaseEnded) {
            s.phaseEnded = true;
            setTimeout(() => {
                incrementDay();
                setPhase('RITUAL');
            }, 2000);
        }

        // Particles
        const aP = [];
        for (const p of s.particles) {
            p.life -= delta; p.x += p.vx * delta; p.y += p.vy * delta; p.vy += 0.05 * delta;
            if (p.life > 0) aP.push(p);
        }
        s.particles = aP;

        // Floating texts
        const aT = [];
        for (const t of s.floatingTexts) {
            t.life -= delta; t.y -= 1.2 * delta;
            if (t.life > 0) aT.push(t);
        }
        s.floatingTexts = aT;

        // AoE flashes
        const aF = [];
        for (const f of s.aoeFlashes) {
            f.life -= delta;
            f.radius = f.maxRadius * (1 - f.life / f.maxLife);
            if (f.life > 0) aF.push(f);
        }
        s.aoeFlashes = aF;

        for (const id in s.hitFlashMap) {
            s.hitFlashMap[id] -= delta;
            if (s.hitFlashMap[id] <= 0) delete s.hitFlashMap[id];
        }

        if (s.frameCount % 6 === 0) {
            setUiState({
                wave: s.wave, demonCount, heroCount,
                nextWaveIn: Math.ceil(s.nextWaveCountdown / 60),
                killCount: s.killCount
            });
        }
    };

    const renderGhostUnits = () => {
        if (!ghostLayerRef.current) return;
        const layer = ghostLayerRef.current;
        const pool = ghostGfxPool.current;
        const currentIds = new Set<string>();

        expectedSummons.forEach((sum, idx) => {
            const id = `ghost-${idx}-${sum.type}`;
            currentIds.add(id);
            let g = pool.get(id);
            if (!g) {
                g = new PIXI.Graphics();
                pool.set(id, g);
                layer.addChild(g);
            }
            g.clear();
            const stats = UNIT_STATS[sum.type] || { color: 0xffffff };
            const color = stats.color || 0xffffff;

            // Draw a simplified ghost circle/rect
            g.beginFill(color, 0.4);
            g.lineStyle(2, 0xffffff, 0.6);
            g.drawCircle(0, 0, 20);
            g.endFill();

            // Position at the matching material column
            g.x = sum.c * BLOCK_SIZE + BLOCK_SIZE / 2;
            g.y = sum.r * BLOCK_SIZE + BLOCK_SIZE / 2;

            // Floating animation
            g.y += Math.sin(stateRef.current.frameCount * 0.1 + idx) * 5;
        });

        // Cleanup unused ghost graphics
        pool.forEach((g, id) => {
            if (!currentIds.has(id)) {
                g.destroy();
                pool.delete(id);
            }
        });
    };

    const renderHeroForecast = () => {
        if (!ghostLayerRef.current) return;
        ghostLayerRef.current.removeChildren();
    };

    // ── Render ────────────────────────────
    const renderGraphics = () => {
        if (!baseGraphicsRef.current || !entitiesLayerRef.current || !particlesLayerRef.current || !floatLayerRef.current || !projectilesLayerRef.current) return;

        if (phase === 'RITUAL') {
            renderGhostUnits();
            renderHeroForecast();
        } else {
            if (ghostLayerRef.current) ghostLayerRef.current.removeChildren();
            ghostGfxPool.current.clear();
        }

        // ── Entities (object pool) ──
        const el = entitiesLayerRef.current;
        const livingIds = new Set(stateRef.current.entities.map(e => e.id));

        // Remove dead entities from pool
        entityGfxPool.current.forEach((g, id) => {
            if (!livingIds.has(id)) {
                el.removeChild(g);
                g.destroy({ children: true });
                entityGfxPool.current.delete(id);
            }
        });

        stateRef.current.entities.forEach(ent => {
            const isBoss = ent.id.startsWith('boss-');
            const sz = ent.type === 'ボス' ? 35 : isBoss ? 30 : (ent.faction === 'HERO' ? 15 : 18);
            const isElite = ent.faction === 'HERO' && stateRef.current.eliteIds.has(ent.id);
            let g = entityGfxPool.current.get(ent.id);

            if (!g || g.destroyed) {
                g = new PIXI.Graphics();
                el.addChild(g);
                entityGfxPool.current.set(ent.id, g);

                // Initial persistent elements (drawn once per entity creation)
                const outC = isElite ? 0xffd700 : ent.faction === 'HERO' ? 0xffaaaa : 0xaaffaa;
                g.beginFill(ent.color);
                if (ent.type === 'ボス') {
                    // ボス: 星形っぽく大きい菱形
                    g.drawPolygon([0, -sz, sz * 0.6, -sz * 0.6, sz, 0, sz * 0.6, sz * 0.6, 0, sz, -sz * 0.6, sz * 0.6, -sz, 0, -sz * 0.6, -sz * 0.6]);
                } else if (ent.faction === 'HERO') {
                    g.drawRect(-sz, -sz, sz * 2, sz * 2);
                } else {
                    g.drawCircle(0, 0, sz);
                }
                g.endFill();
                g.lineStyle(ent.type === 'ボス' ? 3 : 1.5, ent.type === 'ボス' ? 0xffff00 : outC, 0.9);
                if (ent.type === 'ボス') {
                    g.drawPolygon([0, -sz, sz * 0.6, -sz * 0.6, sz, 0, sz * 0.6, sz * 0.6, 0, sz, -sz * 0.6, sz * 0.6, -sz, 0, -sz * 0.6, -sz * 0.6]);
                } else if (ent.faction === 'HERO') {
                    g.drawRect(-sz, -sz, sz * 2, sz * 2);
                } else {
                    g.drawCircle(0, 0, sz);
                }
                g.lineStyle(0);

                // HP bar container child at index 0
                g.addChild(new PIXI.Graphics());

                // Interaction
                g.eventMode = 'static'; g.cursor = 'pointer';
                g.on('pointerdown', (e: PIXI.FederatedPointerEvent) => {
                    e.stopPropagation();
                    setPinnedEntity(prev => prev?.id === ent.id ? null : ent);
                    setPinnedPos({ x: e.global.x, y: e.global.y });
                });

                // Summon Animation
                if (ent.faction === 'DEMON') {
                    g.alpha = 0; g.scale.set(0.2);
                    gsap.to(g, { alpha: 1, pixi: { scale: 1 }, duration: 0.5, ease: "back.out(1.5)" });
                }
            }

            g.x = ent.x; g.y = ent.y;

            // Hit flash scale
            const flashFrames = stateRef.current.hitFlashMap[ent.id] || 0;
            g.scale.set(flashFrames > 0 ? 1 + 0.3 * (flashFrames / 8) : 1);

            // Dynamic HP Bar Update
            const hpBar = g.children[0] as PIXI.Graphics;
            if (hpBar) {
                hpBar.clear();
                const hpR = Math.max(0, ent.hp / ent.maxHp);
                const barW = sz * 2 + 10;
                hpBar.beginFill(0x000000, 0.7);
                hpBar.drawRect(-barW / 2, -sz - 15, barW, 8);
                const barC = hpR > 0.5 ? 0x44ff44 : hpR > 0.25 ? 0xffaa00 : 0xff3333;
                hpBar.beginFill(barC);
                hpBar.drawRect(-barW / 2, -sz - 15, barW * hpR, 8);
                hpBar.endFill();

                if (ent.faction === 'DEMON' && ent.passiveAbilities) {
                    ent.passiveAbilities.forEach(pa => {
                        if (pa.type === 'AURA_REGEN') {
                            const auraRange = pa.range || 100;
                            const pulse = 0.1 + 0.1 * Math.sin(stateRef.current.frameCount * 0.1);
                            hpBar.lineStyle(2, 0x44ff44, 0.3 + pulse);
                            hpBar.drawCircle(0, 0, auraRange);
                            hpBar.lineStyle(0);
                            hpBar.beginFill(0x44ff44, 0.05 + pulse * 0.5);
                            hpBar.drawCircle(0, 0, auraRange);
                            hpBar.endFill();
                        }
                    });
                }
            }

            // Elite glow (alpha update only)
            if (isElite) {
                const pulse = 0.5 + 0.5 * Math.sin(stateRef.current.frameCount * 0.15);
                g.alpha = 0.85 + pulse * 0.15;
                g.tint = 0xffd700;
            } else {
                g.alpha = 1;
                g.tint = 0xffffff;
            }
        });

        // ── Projectiles (pool by id) ──
        // ── Area projectiles: batched Graphics (pulsing animation, few in number) ──
        if (areaBatchRef.current) {
            const ab = areaBatchRef.current;
            ab.clear();
            const fc = stateRef.current.frameCount;
            stateRef.current.projectiles.forEach(proj => {
                if (!proj.isArea) return;
                const range = proj.areaRadius || 60;
                const pulse = 0.15 + 0.1 * Math.sin(fc * 0.2);
                ab.beginFill(proj.color, 0.1 + pulse); ab.drawCircle(proj.x, proj.y, range); ab.endFill();
                ab.lineStyle(2, proj.color, 0.4 + pulse); ab.drawCircle(proj.x, proj.y, range); ab.lineStyle(0);
                ab.beginFill(0xffffff, 0.8); ab.drawCircle(proj.x, proj.y, proj.size); ab.endFill();
            });
            // AoE flashes（即時範囲攻撃の拡大円エフェクト）
            stateRef.current.aoeFlashes.forEach(f => {
                const alpha = f.life / f.maxLife;
                ab.beginFill(f.color, 0.18 * alpha);
                ab.drawCircle(f.x, f.y, f.radius);
                ab.endFill();
                ab.lineStyle(3, f.color, 0.9 * alpha);
                ab.drawCircle(f.x, f.y, f.radius);
                ab.lineStyle(0);
            });
        }

        // ── Non-area projectiles: Sprite pool (position/tint update only, no tessellation) ──
        if (projContainerRef.current) {
            const pc = projContainerRef.current;
            const activeIds = new Set(stateRef.current.projectiles.filter(p => !p.isArea).map(p => p.id));

            projSpritePool.current.forEach((sprite, id) => {
                if (!activeIds.has(id)) { pc.removeChild(sprite); sprite.destroy(); projSpritePool.current.delete(id); }
            });

            stateRef.current.projectiles.forEach(proj => {
                if (proj.isArea) return;
                let sprite = projSpritePool.current.get(proj.id);
                if (!sprite) {
                    const tex = projTexturesRef.current.get(proj.style);
                    if (!tex) return;
                    sprite = new PIXI.Sprite(tex);
                    sprite.anchor.set(0.5);
                    pc.addChild(sprite);
                    projSpritePool.current.set(proj.id, sprite);
                }
                sprite.x = proj.x;
                sprite.y = proj.y;
                sprite.rotation = proj.angle;
                sprite.tint = proj.color;
                const scale = proj.size / 10;
                sprite.scale.set(proj.style === 'arrow' ? 1 : scale);
            });
        }

        // ── Particles (single batched Graphics, no alloc) ──
        if (particleBatchRef.current) {
            const pb = particleBatchRef.current;
            pb.clear();
            stateRef.current.particles.forEach(p => {
                pb.beginFill(p.color, Math.min(1, p.life / 30));
                pb.drawCircle(p.x, p.y, p.size ?? 3); pb.endFill();
            });
        }

        // ── Floating texts (pool) ──
        const fl = floatLayerRef.current;
        const livingTextIds = new Set(stateRef.current.floatingTexts.map(t => t.id));
        floatTextPool.current.forEach((t, id) => {
            if (!livingTextIds.has(id)) { fl.removeChild(t); t.destroy(); floatTextPool.current.delete(id); }
        });
        stateRef.current.floatingTexts.forEach(ft => {
            let t = floatTextPool.current.get(ft.id);
            if (!t) {
                t = new PIXI.Text(ft.text, { fontSize: ft.fontSize ?? 18, fill: ft.color, fontWeight: 'bold', dropShadow: true, dropShadowDistance: 2, dropShadowAlpha: 0.9, stroke: 0x000000, strokeThickness: 3 });
                t.anchor.set(0.5); fl.addChild(t); floatTextPool.current.set(ft.id, t);
            }
            t.alpha = ft.life / ft.maxLife;
            t.x = ft.x; t.y = ft.y;
        });
    };

    return (
        <div className="defense-phase" style={{ position: 'relative', width: '100%', height: '100%', padding: 0, display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start' }}>
            <div className="canvas-container" ref={pixiContainerRef} style={{
                cursor: 'default', overflow: 'hidden',
                border: '1px solid rgba(180,60,60,0.6)',
                outline: '1px solid rgba(120,20,20,0.4)',
                outlineOffset: '3px',
                borderRadius: '2px',
                boxShadow: '0 0 0 5px rgba(40,0,0,0.5), 0 0 0 6px rgba(160,40,40,0.25), 0 0 0 9px rgba(80,0,0,0.3), 0 0 20px rgba(200,20,20,0.15), inset 0 0 12px rgba(0,0,0,0.6)',
            }} />

            {pinnedEntity && (() => {
                const isHero = pinnedEntity.faction === 'HERO';
                const borderColor = isHero ? '#ff4444' : '#44ff44';
                const nameColor = isHero ? '#ffaaaa' : '#aaffaa';
                const liveEnt = stateRef.current.entities.find(e => e.id === pinnedEntity.id) ?? pinnedEntity;
                return (
                    <div ref={pinnedEntityInfoRef} style={{
                            position: 'absolute', top: pinnedPos.y + 15, left: Math.max(4, pinnedPos.x - 190),
                            backgroundColor: 'rgba(0,0,0,0.92)', color: '#fff', padding: '10px 15px',
                            borderRadius: '6px', pointerEvents: 'auto', zIndex: 9999,
                            border: '1px solid ' + borderColor,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.6)', minWidth: '170px',
                        }} onPointerDown={e => e.stopPropagation()}>
                            <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '6px', color: nameColor }}>
                                {getUnitDisplayName(liveEnt.type)}
                                <span style={{ fontSize: '11px', marginLeft: '8px', color: '#888' }}>{isHero ? '英雄軍' : '魔王軍'}</span>
                            </div>
                            <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                                <span style={{ color: '#aaffaa' }}>HP: {Math.max(0, Math.floor(liveEnt.hp))}/{liveEnt.maxHp}</span>
                                <span style={{ color: '#ffaaaa' }}>ATK: {Math.floor(liveEnt.attack)}</span>
                                <span style={{ color: '#aaaaff' }}>射程: {liveEnt.range}</span>
                                <span style={{ color: '#ffff88' }}>速度: {liveEnt.speed.toFixed(1)}</span>
                            </div>
                            {liveEnt.passiveAbilities && liveEnt.passiveAbilities.length > 0 && (
                                <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #333', fontSize: '11px', color: '#cc88ff' }}>
                                    {liveEnt.passiveAbilities.map((pa, i) => (
                                        <div key={i}>★ {PASSIVE_DESCRIPTIONS[pa.type] ?? pa.type}</div>
                                    ))}
                                </div>
                            )}
                    </div>
                );
            })()}
        </div>
    );
};

export default DefensePhase;
