import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGame } from '../contexts/GameContext';
import type { EntityState } from '../game/entities';
import { UNIT_STATS } from '../game/entities';


const FIELD_WIDTH = 1110;
const FIELD_HEIGHT = 500; // キャンバスの高さを拡大
const DEMON_BASE = { x: 130, y: FIELD_HEIGHT / 2 };
const BASE_MAX_HP = 500;
const MAX_WAVES = 4;

// Projectile visual type based on attacker role
type ProjectileStyle = 'arrow' | 'orb' | 'bomb' | 'sword_flash';

interface Projectile {
    id: string;
    x: number;
    y: number;
    targetId: string | 'base' | 'hero_base';
    // Snapshot of last known target position (fallback if target dies)
    targetX: number;
    targetY: number;
    speed: number;
    damage: number;
    color: number;
    style: ProjectileStyle;
    size: number;
    // For arrow: direction angle
    angle: number;
    // Trail positions
    trail: { x: number; y: number }[];
    // --- Special ---
    isPiercing?: boolean;
    hitIds?: Set<string>;
    maxDistance?: number;
    distanceTraveled?: number;
    isArea?: boolean;
    areaRadius?: number;
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
}

const HERO_ROSTER = {
    '村人': { maxHp: 20, attack: 4, range: 40, speed: 0.7, maxCooldown: 70, color: 0xddddbb },
    '農夫': { maxHp: 25, attack: 6, range: 40, speed: 0.65, maxCooldown: 60, color: 0xbbaa77 },
    '弓兵': { maxHp: 30, attack: 12, range: 180, speed: 0.75, maxCooldown: 80, color: 0xaaeeaa },
    '剣士': { maxHp: 70, attack: 18, range: 50, speed: 0.85, maxCooldown: 55, color: 0x8888ff },
    '重騎士': { maxHp: 160, attack: 25, range: 55, speed: 0.55, maxCooldown: 70, color: 0x5566cc },
    '魔法使い': { maxHp: 35, attack: 30, range: 160, speed: 0.7, maxCooldown: 100, color: 0xee88ff },
    '聖騎士': { maxHp: 300, attack: 40, range: 60, speed: 0.6, maxCooldown: 65, color: 0xffffff },
    '大魔道士': { maxHp: 80, attack: 55, range: 200, speed: 0.6, maxCooldown: 100, color: 0xcc44ff },
    // 新規追加
    'シーフ': { maxHp: 40, attack: 10, range: 30, speed: 1.4, maxCooldown: 40, color: 0x444444 },
    'パラディン': { maxHp: 400, attack: 20, range: 55, speed: 0.45, maxCooldown: 80, color: 0xffdd44 },
    'プリースト': { maxHp: 60, attack: -30, range: 150, speed: 0.55, maxCooldown: 90, color: 0xffccff }, // マイナスの攻撃力を設定し、後で回復として扱う
    '勇者': { maxHp: 800, attack: 65, range: 65, speed: 0.7, maxCooldown: 50, color: 0xff2222 },
};

type HeroType = keyof typeof HERO_ROSTER;

// Determine projectile style from attacker type name
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
    onStateChange?: (state: any) => void;
}

const DefensePhase: React.FC<DefensePhaseProps> = ({ registerSpawn, onStateChange }) => {
    const { summonedMonsters, setPhase, addGold, incrementDay, currentDay, ownedRelics, addPendingPuzzlePiece } = useGame();
    const spawnUnitFnRef = useRef<((type: string) => void) | null>(null);

    const actualMaxBaseHp = ownedRelics.includes('mana_prism') ? Math.floor(BASE_MAX_HP / 2) : BASE_MAX_HP;

    const pixiContainerRef = useRef<HTMLDivElement>(null);
    const appRef = useRef<PIXI.Application | null>(null);
    const entitiesLayerRef = useRef<PIXI.Container | null>(null);
    const particlesLayerRef = useRef<PIXI.Container | null>(null);
    const projectilesLayerRef = useRef<PIXI.Container | null>(null);
    const floatLayerRef = useRef<PIXI.Container | null>(null);
    const baseGraphicsRef = useRef<PIXI.Graphics | null>(null);
    // ── Object pools for performance ──
    const entityGfxPool = useRef<Map<string, PIXI.Graphics>>(new Map());
    const projGfxPool = useRef<Map<string, PIXI.Graphics>>(new Map());
    const floatTextPool = useRef<Map<string, PIXI.Text>>(new Map());
    const particleBatchRef = useRef<PIXI.Graphics | null>(null);

    const stateRef = useRef({
        entities: [] as EntityState[],
        projectiles: [] as Projectile[],
        particles: [] as { id: string, x: number, y: number, vx: number, vy: number, color: number, life: number }[],
        floatingTexts: [] as FloatingText[],
        baseHp: actualMaxBaseHp,
        maxBaseHp: actualMaxBaseHp,
        wave: 0,
        frameCount: 0,
        nextWaveCountdown: 0,
        waveInProgress: false,
        castleCooldown: 0,
        eliteIds: new Set<string>(),
        pendingGold: 0,
        killCount: 0,
        phaseEnded: false,
    });

    const [uiState, setUiState] = useState({
        baseHp: actualMaxBaseHp,
        maxBaseHp: actualMaxBaseHp,
        wave: 0,
        demonCount: 0,
        heroCount: 0,
        nextWaveIn: 0,
        killCount: 0,
    });

    // 定期的に親へUI用ステートを通知
    useEffect(() => {
        if (onStateChange) {
            onStateChange(uiState);
        }
    }, [uiState, onStateChange]);

    const [hoveredEntity, setHoveredEntity] = useState<EntityState | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });



    const generateId = () => Math.random().toString(36).substr(2, 9);

    // ── Initial demon spawn (role-based formation) ──
    useEffect(() => {
        const initialEntities: EntityState[] = [];

        const withStats = summonedMonsters.map(type => ({
            type,
            stats: UNIT_STATS[type] || UNIT_STATS['goblin']
        }));

        // Group entities exactly by their attack range
        const groupsByRange = new Map<number, typeof withStats>();
        withStats.forEach(item => {
            const r = item.stats.range!;
            if (!groupsByRange.has(r)) groupsByRange.set(r, []);
            groupsByRange.get(r)!.push(item);
        });

        // Unique sorted ranges (ascending: melee first, ranged last)
        const sortedRanges = Array.from(groupsByRange.keys()).sort((a, b) => a - b);

        const BASE_X = FIELD_WIDTH * 0.35; // Frontline X position
        const X_SCALE = 0.8; // Distance moved back per 1 unit of range difference
        const UNIT_SPACING = 40;

        const hasGiantHeart = ownedRelics.includes('giant_heart');
        const hasFireCrown = ownedRelics.includes('fire_crown');

        sortedRanges.forEach((range) => {
            const group = groupsByRange.get(range)!;
            // X position naturally decreases as range increases (spawn further left)
            const groupX = BASE_X - Math.max(0, range - 40) * X_SCALE;

            // Stack vertically, centered on FIELD_HEIGHT / 2
            const totalH = (group.length - 1) * UNIT_SPACING;
            const startY = FIELD_HEIGHT / 2 - totalH / 2;

            group.forEach(({ type, stats }, idx) => {
                let hpMult = hasGiantHeart ? 2.0 : 1.0;
                let spdMult = hasGiantHeart ? 0.7 : 1.0;
                let atkMult = hasFireCrown ? (stats.color === 0xff3333 ? 1.5 : 0.8) : 1.0;

                initialEntities.push({
                    id: generateId(), type, faction: 'DEMON',
                    x: groupX,
                    y: startY + idx * UNIT_SPACING,
                    hp: Math.floor(stats.maxHp! * hpMult), maxHp: Math.floor(stats.maxHp! * hpMult),
                    attack: Math.floor(stats.attack! * atkMult), range: stats.range!,
                    speed: stats.speed! * spdMult,
                    cooldown: Math.random() * (stats.maxCooldown! / 2),
                    maxCooldown: stats.maxCooldown!, color: stats.color!,
                    passiveAbilities: stats.passiveAbilities ? [...stats.passiveAbilities] : undefined
                });
            });
        });

        stateRef.current.entities = initialEntities;
        stateRef.current.nextWaveCountdown = 300; // 5秒猶予
    }, [summonedMonsters]);

    // ── Register external spawn callback ──
    useEffect(() => {
        const spawnFn = (type: string) => {
            const stats = UNIT_STATS[type] || UNIT_STATS['goblin'];
            const hasGiantHeart = ownedRelics.includes('giant_heart');
            const hasFireCrown = ownedRelics.includes('fire_crown');
            const hpMult = hasGiantHeart ? 2.0 : 1.0;
            const spdMult = hasGiantHeart ? 0.7 : 1.0;
            const atkMult = hasFireCrown ? (stats.color === 0xff3333 ? 1.5 : 0.8) : 1.0;
            const id = Math.random().toString(36).substr(2, 9);
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


    // ── Initialize Pixi ──────────────────
    useEffect(() => {
        if (!pixiContainerRef.current) return;

        const app = new PIXI.Application({
            width: FIELD_WIDTH, height: FIELD_HEIGHT,
            backgroundColor: 0x111a11,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true, antialias: true
        });

        pixiContainerRef.current.appendChild(app.view as unknown as Node);
        appRef.current = app;

        const baseGraphics = new PIXI.Graphics();
        app.stage.addChild(baseGraphics);
        baseGraphicsRef.current = baseGraphics;

        const entitiesLayer = new PIXI.Container();
        app.stage.addChild(entitiesLayer);
        entitiesLayerRef.current = entitiesLayer;

        const projectilesLayer = new PIXI.Container();
        app.stage.addChild(projectilesLayer);
        projectilesLayerRef.current = projectilesLayer;

        const particlesLayer = new PIXI.Container();
        app.stage.addChild(particlesLayer);
        particlesLayerRef.current = particlesLayer;

        const floatLayer = new PIXI.Container();
        app.stage.addChild(floatLayer);
        floatLayerRef.current = floatLayer;

        // Static background grid (draw once)
        const staticBgGr = new PIXI.Graphics();
        staticBgGr.lineStyle(1, 0x223322, 0.3);
        for (let x = 100; x < FIELD_WIDTH; x += 100) { staticBgGr.moveTo(x, 0); staticBgGr.lineTo(x, FIELD_HEIGHT); }
        staticBgGr.lineStyle(0);
        baseGraphics.addChild(staticBgGr);

        // Single shared Graphics for all particles (batch draw)
        const pBatch = new PIXI.Graphics();
        particlesLayerRef.current!.addChild(pBatch);
        particleBatchRef.current = pBatch;

        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, FIELD_WIDTH, FIELD_HEIGHT);


        app.ticker.add((delta) => { updateLogic(delta); renderGraphics(); });

        return () => {
            entityGfxPool.current.clear();
            projGfxPool.current.clear();
            floatTextPool.current.clear();
            particlesLayerRef.current = null;
            floatLayerRef.current = null;
            app.destroy(true, { children: true });
            appRef.current = null;
        };
    }, []);

    // ── Wave composition ──────────────────
    const buildWave = useCallback((waveNum: number): { type: HeroType, count: number }[] => {
        const day = currentDay;
        if (day === 1) {
            if (waveNum === 1) return [{ type: '村人', count: 4 }];
            if (waveNum === 2) return [{ type: '村人', count: 6 }, { type: '農夫', count: 2 }];
            if (waveNum === 3) return [{ type: '村人', count: 8 }, { type: '農夫', count: 4 }];
            return [{ type: '弓兵', count: 4 }, { type: '剣士', count: 3 }];
        }
        if (day === 2) {
            const base = 4 + waveNum * 2;
            if (waveNum <= 2) return [{ type: '農夫', count: base }, { type: '弓兵', count: Math.floor(base / 2) }];
            if (waveNum === 3) return [{ type: '剣士', count: 5 }, { type: '弓兵', count: 4 }, { type: '農夫', count: 3 }];
            return [{ type: '重騎士', count: 2 }, { type: '剣士', count: 5 }, { type: '弓兵', count: 5 }];
        }
        if (day === 3) {
            // シーフの登場
            if (waveNum === 1) return [{ type: '剣士', count: 5 }, { type: 'シーフ', count: 2 }];
            if (waveNum === 2) return [{ type: '弓兵', count: 5 }, { type: 'シーフ', count: 3 }, { type: '重騎士', count: 1 }];
            if (waveNum === 3) return [{ type: '剣士', count: 4 }, { type: '魔法使い', count: 2 }, { type: 'シーフ', count: 4 }];
            return [{ type: '重騎士', count: 3 }, { type: '大魔道士', count: 1 }, { type: 'シーフ', count: 5 }];
        }
        if (day === 4) {
            // プリーストとパラディンの登場
            if (waveNum <= 2) return [{ type: '剣士', count: 6 }, { type: 'プリースト', count: 1 }, { type: '弓兵', count: 3 }];
            if (waveNum === 3) return [{ type: '重騎士', count: 4 }, { type: 'プリースト', count: 2 }, { type: '魔法使い', count: 2 }];
            return [{ type: 'パラディン', count: 1 }, { type: 'プリースト', count: 2 }, { type: '剣士', count: 5 }, { type: '弓兵', count: 4 }];
        }
        if (day === 5 || day === 10) {
            // ボス：勇者パーティ（ウェーブ4で確定）
            const scale = day === 10 ? 2 : 1;
            if (waveNum <= 3) return [{ type: 'パラディン', count: scale }, { type: '聖騎士', count: 2 * scale }, { type: 'プリースト', count: 2 * scale }, { type: '大魔道士', count: scale }, { type: 'シーフ', count: 3 * scale }];
            return [{ type: '勇者', count: 1 }, { type: 'パラディン', count: 1 * scale }, { type: 'プリースト', count: 2 * scale }, { type: '大魔道士', count: 1 * scale }, { type: 'シーフ', count: 2 * scale }];
        }

        const scale = day - 5;
        if (waveNum <= 2) return [{ type: 'パラディン', count: 1 + Math.floor(scale / 2) }, { type: '聖騎士', count: 2 + scale }, { type: 'プリースト', count: 1 + scale }, { type: 'シーフ', count: 2 + scale }];
        if (waveNum === 3) return [{ type: '重騎士', count: 4 + scale }, { type: '大魔道士', count: 1 + scale }, { type: 'プリースト', count: 2 + scale }];
        return [{ type: '勇者', count: 1 + Math.floor(scale / 3) }, { type: 'パラディン', count: 2 + scale }, { type: 'プリースト', count: 2 + scale }, { type: '大魔道士', count: 2 + scale }];
    }, [currentDay]);

    const spawnWave = useCallback(() => {
        const s = stateRef.current;
        if (s.wave >= MAX_WAVES) return;
        s.wave++;
        s.waveInProgress = true;
        const composition = buildWave(s.wave);
        const newHeroes: EntityState[] = [];
        let offset = 0;
        composition.forEach(({ type, count }) => {
            const stats = HERO_ROSTER[type];
            for (let i = 0; i < count; i++) {
                // 15% chance for elite (gold glow, 2x stats, 3x gold reward)
                const isElite = Math.random() < 0.15;
                const id = generateId();
                if (isElite) s.eliteIds.add(id);
                newHeroes.push({
                    id, type, faction: 'HERO',
                    x: FIELD_WIDTH - 150 - offset * 8, // spawn near right side
                    y: FIELD_HEIGHT / 2 - 100 + Math.random() * 200,
                    hp: stats.maxHp * (isElite ? 2 : 1),
                    maxHp: stats.maxHp * (isElite ? 2 : 1),
                    attack: stats.attack * (isElite ? 1.8 : 1),
                    range: stats.range,
                    speed: stats.speed * (isElite ? 1.15 : 1),
                    cooldown: Math.random() * 30,
                    maxCooldown: stats.maxCooldown,
                    color: isElite ? 0xffd700 : stats.color,
                });
                offset++;
            }
        });
        s.entities.push(...newHeroes);
        setUiState(prev => ({ ...prev, wave: s.wave }));
    }, [buildWave]);

    // ── Spawn a projectile ────────────────
    const spawnProjectile = (attacker: EntityState, target: EntityState | 'base' | 'hero_base') => {
        const s = stateRef.current;
        const tx = (typeof target === 'string') ? DEMON_BASE.x : target.x;
        const ty = (typeof target === 'string') ? DEMON_BASE.y : target.y;
        const dx = tx - attacker.x;
        const dy = ty - attacker.y;
        const angle = Math.atan2(dy, dx);
        const style = getProjectileStyle(attacker.type);
        const projSpeed = style === 'arrow' ? 6 : style === 'bomb' ? 3.5 : style === 'orb' ? 5 : 4;

        let isPiercing = false;
        let maxDistance = Infinity;
        let isArea = false;
        let areaRadius = 0;

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
                }
            });
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
            size: (style === 'bomb' || isArea) ? 8 : style === 'orb' ? 5 : 3,
            angle,
            trail: [],
            isPiercing,
            hitIds: new Set(),
            maxDistance,
            distanceTraveled: 0,
            isArea,
            areaRadius,
            sourceId: attacker.id
        });
    };

    // ── Main logic ────────────────────────
    const updateLogic = (delta: number) => {
        const s = stateRef.current;

        // Wave countdown
        if (s.wave < MAX_WAVES && s.nextWaveCountdown > 0) {
            s.nextWaveCountdown -= delta;
            if (s.nextWaveCountdown <= 0) { spawnWave(); s.nextWaveCountdown = 0; }
        }

        // ── Castle auto-attack ──────────────
        const CASTLE_RANGE = 250;
        const CASTLE_DAMAGE = 15;
        const CASTLE_COOLDOWN = 90; // ~1.5s at 60fps
        if (s.castleCooldown > 0) s.castleCooldown -= delta;
        if (s.castleCooldown <= 0) {
            let castleTarget: EntityState | null = null;
            let castleMinDist = CASTLE_RANGE;
            for (const ent of s.entities) {
                if (ent.faction === 'HERO' && ent.hp > 0) {
                    const d = Math.hypot(DEMON_BASE.x - ent.x, DEMON_BASE.y - ent.y);
                    if (d < castleMinDist) { castleMinDist = d; castleTarget = ent; }
                }
            }
            if (castleTarget) {
                // Fire a dark orb from the castle
                const tx = castleTarget.x, ty = castleTarget.y;
                const angle = Math.atan2(ty - DEMON_BASE.y, tx - DEMON_BASE.x);
                s.projectiles.push({
                    id: generateId(),
                    x: DEMON_BASE.x, y: DEMON_BASE.y,
                    targetId: castleTarget.id,
                    targetX: tx, targetY: ty,
                    speed: 5,
                    damage: CASTLE_DAMAGE,
                    color: 0xcc00ff,
                    style: 'orb',
                    size: 7,
                    angle,
                    trail: [],
                });
                s.castleCooldown = CASTLE_COOLDOWN;
            }
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
                const hitColor = targetEnt.faction === 'DEMON' ? 0xff4444 : 0x88ff88;
                s.floatingTexts.push({ id: generateId(), x: targetEnt.x, y: targetEnt.y - 15, text: '-' + Math.floor(finalDamage), life: 55, maxLife: 55, color: hitColor });

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
                const pCount = Math.min(16, Math.floor(ent.maxHp / 30) + 5);
                for (let j = 0; j < pCount; j++) {
                    const a = Math.random() * Math.PI * 2;
                    const sp = 0.5 + Math.random() * 2.5;
                    s.particles.push({ id: generateId(), x: ent.x, y: ent.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.5, color: isElite ? 0xffdd00 : ent.color, life: 40 + Math.random() * 25 });
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
                                const expDmg = ability.value || 30;
                                // Visual & Damage
                                for (const hero of entities) {
                                    if (hero.faction === 'HERO' && hero.hp > 0 && Math.hypot(hero.x - ent.x, hero.y - ent.y) < 80) {
                                        applyDamage(hero, expDmg);
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

                // Gold reward on hero death
                if (ent.faction === 'HERO') {
                    const goldDrop = isElite ? 18 : 5;
                    s.pendingGold += goldDrop;
                    s.killCount++;
                    s.floatingTexts.push({ id: generateId(), x: ent.x, y: ent.y - 25, text: `+ ${goldDrop} G`, life: 70, maxLife: 70, color: 0xffd700 });
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
                const distToBase = Math.hypot(DEMON_BASE.x - ent.x, DEMON_BASE.y - ent.y);
                minDist = distToBase; // Default target is base

                if (ent.type === 'プリースト') {
                    // Priest targets wounded allies to heal
                    target = null;
                    minDist = Infinity;
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
                } else if (ent.type !== 'シーフ') {
                    // Everyone except Thief looks for Demons
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
                    target = null;
                    minDist = Infinity;
                    let lowestHpRatio = 1.0;
                    for (let j = 0; j < entities.length; j++) {
                        const other = entities[j];
                        if (other.faction === 'DEMON' && other.hp > 0 && other.hp < other.maxHp) {
                            const d = Math.hypot(other.x - ent.x, other.y - ent.y);
                            if (d <= ent.range + 50) { // Slight buffer for healers
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
                    // Update: Remove base distance bias so demons can chase heroes far away
                    minDist = Infinity;
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
                        const style = getProjectileStyle(ent.type);
                        if (style === 'sword_flash' || ent.range <= 60) {
                            // Melee: instant damage + small flash particle
                            applyDamage(target, ent.attack, ent);
                            for (let k = 0; k < 3; k++) {
                                const a = Math.random() * Math.PI * 2;
                                s.particles.push({ id: generateId(), x: target.x, y: target.y, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 1.5, color: 0xffffff, life: 10 });
                            }
                        } else {
                            // Ranged: fire projectile
                            spawnProjectile(ent, target);
                        }
                    }
                    // Removed retreat behavior; units will no longer run away when engaged
                } else {
                    // Chase toward target at full speed
                    const a = Math.atan2(target.y - ent.y, target.x - ent.x);
                    ent.x += Math.cos(a) * ent.speed * delta;
                    ent.y += Math.sin(a) * ent.speed * delta;
                }
            } else if (ent.faction === 'HERO') {
                // Slime slow aura: heroes near a slime move at 40% speed
                let speedMult = 1.0;
                for (const ally of entities) {
                    if (ally.faction === 'DEMON' && ally.hp > 0 && ally.type.includes('スライム')) {
                        if (Math.hypot(ally.x - ent.x, ally.y - ent.y) < 90) { speedMult = 0.4; break; }
                    }
                }
                if (minDist <= ent.range + 20) {
                    if (ent.cooldown <= 0) {
                        ent.cooldown = ent.maxCooldown;
                        const style = getProjectileStyle(ent.type);
                        if (style === 'sword_flash' || ent.range <= 60) {
                            s.baseHp -= ent.attack;
                            s.floatingTexts.push({ id: generateId(), x: DEMON_BASE.x + (Math.random() - 0.5) * 30, y: DEMON_BASE.y - 20, text: `- ${ent.attack} `, life: 55, maxLife: 55, color: 0xff2222 });
                            if (s.baseHp <= 0) setPhase('RESULT');
                        } else {
                            spawnProjectile(ent, 'base');
                        }
                    }
                } else {
                    const a = Math.atan2(DEMON_BASE.y - ent.y, DEMON_BASE.x - ent.x);
                    ent.x += Math.cos(a) * ent.speed * speedMult * delta;
                    ent.y += Math.sin(a) * ent.speed * speedMult * delta;
                }
            } else { // DEMON without target
                if (heroCount > 0) {
                    // Forward movement if heroes exist in field but no specific target discovered
                    ent.x += ent.speed * delta;
                } else {
                    // Alignment logic when no heroes are present
                    const alignX = 200 + (350 - Math.min(350, ent.range)) * 0.8;
                    const diffX = alignX - ent.x;
                    if (Math.abs(diffX) > 2) {
                        ent.x += (diffX > 0 ? 1 : -1) * ent.speed * delta;
                    }
                    // Gently move towards vertical center line
                    const centerY = FIELD_HEIGHT / 2;
                    const dy = centerY - ent.y;
                    if (Math.abs(dy) > 10) {
                        ent.y += (dy > 0 ? 0.2 : -0.2) * ent.speed * delta;
                    }
                }
            }

            // Separation (Avoid overlapping)
            const SEPARATION_RADIUS = 22;
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

            ent.x = Math.max(20, Math.min(FIELD_WIDTH - 20, ent.x));
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
            if (proj.targetId !== 'base' && proj.targetId !== 'hero_base' && !proj.isPiercing && !proj.isArea) {
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
            if (dist < proj.speed * delta + 10) {
                // Hit!
                if (proj.targetId === 'base') {
                    s.baseHp -= proj.damage;
                    s.floatingTexts.push({ id: generateId(), x: DEMON_BASE.x, y: DEMON_BASE.y - 20, text: `- ${proj.damage} `, life: 55, maxLife: 55, color: 0xff2222 });
                    if (s.baseHp <= 0) setPhase('RESULT');
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
                        if (d < (proj.size + 20)) { // slightly larger hit box for line attack
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
                                    applyDamage(targetEnt, proj.damage * 0.4, attacker);
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

            // Removing Piercing projectiles if they go too far
            if (proj.isPiercing && (proj.distanceTraveled || 0) > (proj.maxDistance || 600)) {
                continue;
            }

            aliveProjectiles.push(proj);
        }
        s.projectiles = aliveProjectiles;

        // Wave clear → schedule next
        if (s.waveInProgress && heroCount === 0 && s.wave < MAX_WAVES) {
            s.waveInProgress = false;
            s.nextWaveCountdown = 480; // 8秒に延長
        }

        // Win condition
        if (s.wave >= MAX_WAVES && heroCount === 0 && s.baseHp > 0 && !s.phaseEnded) {
            s.phaseEnded = true;
            addGold(120 + currentDay * 80);
            // Small delay before transition to show text
            setTimeout(() => {
                incrementDay();
                setPhase('PREPARATION');
            }, 1000);
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
            t.life -= delta; t.y -= 0.5 * delta;
            if (t.life > 0) aT.push(t);
        }
        s.floatingTexts = aT;

        s.frameCount++;
        if (s.frameCount % 6 === 0) {
            // Flush pending gold
            if (s.pendingGold > 0) { addGold(s.pendingGold); s.pendingGold = 0; }
            setUiState({
                baseHp: Math.max(0, s.baseHp), maxBaseHp: s.maxBaseHp,
                wave: s.wave, demonCount, heroCount,
                nextWaveIn: Math.ceil(s.nextWaveCountdown / 60), killCount: s.killCount,
            });
        }
    };

    // ── Render ────────────────────────────
    const renderGraphics = () => {
        if (!baseGraphicsRef.current || !entitiesLayerRef.current || !particlesLayerRef.current || !floatLayerRef.current || !projectilesLayerRef.current) return;

        // Demon base only (grid is static, drawn once)
        const bg = baseGraphicsRef.current;
        bg.clear();

        // Demon base
        const hpRatio = Math.max(0, stateRef.current.baseHp / stateRef.current.maxBaseHp);
        const baseColor = hpRatio > 0.5 ? 0x44aaff : hpRatio > 0.25 ? 0xffaa00 : 0xff3333;
        bg.lineStyle(3, baseColor, 0.9); bg.drawCircle(DEMON_BASE.x, DEMON_BASE.y, 42); bg.lineStyle(0);
        bg.beginFill(0x220000); bg.drawCircle(DEMON_BASE.x, DEMON_BASE.y, 38); bg.endFill();
        bg.beginFill(0xff2200); bg.drawCircle(DEMON_BASE.x, DEMON_BASE.y, 12); bg.endFill();
        bg.beginFill(0x111111); bg.drawRoundedRect(DEMON_BASE.x - 45, DEMON_BASE.y + 48, 90, 10, 3);
        bg.beginFill(baseColor); bg.drawRoundedRect(DEMON_BASE.x - 45, DEMON_BASE.y + 48, 90 * hpRatio, 10, 3); bg.endFill();

        // (Hero base rendering removed)

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
            const sz = ent.faction === 'HERO' ? 9 : 11;
            const isElite = ent.faction === 'HERO' && stateRef.current.eliteIds.has(ent.id);
            let g = entityGfxPool.current.get(ent.id);
            if (!g) {
                // Create once: base shape + outline + HP bar child
                g = new PIXI.Graphics();
                const outC = isElite ? 0xffd700 : ent.faction === 'HERO' ? 0xffaaaa : 0xaaffaa;
                g.beginFill(ent.color);
                if (ent.faction === 'HERO') g.drawRect(-sz, -sz, sz * 2, sz * 2);
                else g.drawCircle(0, 0, sz);
                g.endFill();
                g.lineStyle(1.5, outC, 0.8);
                if (ent.faction === 'HERO') g.drawRect(-sz, -sz, sz * 2, sz * 2);
                else g.drawCircle(0, 0, sz);
                g.lineStyle(0);
                // HP bar as child Graphics (index 0)
                g.addChild(new PIXI.Graphics());
                g.eventMode = 'static'; g.cursor = 'pointer';
                g.on('pointerover', (e) => { setHoveredEntity(ent); setTooltipPos({ x: e.client.x, y: e.client.y }); });
                g.on('pointerout', () => setHoveredEntity(null));
                g.on('pointermove', (e) => setTooltipPos({ x: e.client.x, y: e.client.y }));
                el.addChild(g);
                entityGfxPool.current.set(ent.id, g);
            }
            // Update position
            g.x = ent.x; g.y = ent.y;
            // Update HP bar (cheap: clear + redraw child)
            const hpR = Math.max(0, ent.hp / ent.maxHp);
            const barW = sz * 2 + 4;
            const hpBar = g.children[0] as PIXI.Graphics;
            hpBar.clear();
            hpBar.beginFill(0x000000, 0.7); hpBar.drawRect(-barW / 2, -sz - 9, barW, 5);
            const barC = hpR > 0.5 ? 0x44ff44 : hpR > 0.25 ? 0xffaa00 : 0xff3333;
            hpBar.beginFill(barC); hpBar.drawRect(-barW / 2, -sz - 9, barW * hpR, 5); hpBar.endFill();

            // --- Area Visualization (Aura) ---
            if (ent.faction === 'DEMON' && ent.passiveAbilities) {
                ent.passiveAbilities.forEach(pa => {
                    if (pa.type === 'AURA_REGEN') {
                        const range = pa.range || 100;
                        const pulse = 0.1 + 0.1 * Math.sin(stateRef.current.frameCount * 0.1);
                        hpBar.lineStyle(2, 0x44ff44, 0.3 + pulse);
                        hpBar.drawCircle(0, 0, range);
                        hpBar.lineStyle(0);
                        hpBar.beginFill(0x44ff44, 0.05 + pulse * 0.5);
                        hpBar.drawCircle(0, 0, range);
                        hpBar.endFill();
                    }
                });
            }

            // Elite glow (alpha update only)
            if (isElite) {
                const pulse = 0.5 + 0.5 * Math.sin(stateRef.current.frameCount * 0.15);
                g.alpha = 0.85 + pulse * 0.15;
                g.tint = 0xffd700;
            } else { g.alpha = 1; g.tint = 0xffffff; }
        });

        // ── Projectiles (pool by id) ──
        const pl = projectilesLayerRef.current;
        const livingProjIds = new Set(stateRef.current.projectiles.map(p => p.id));
        projGfxPool.current.forEach((g, id) => {
            if (!livingProjIds.has(id)) {
                pl.removeChild(g); g.destroy(); projGfxPool.current.delete(id);
            }
        });
        stateRef.current.projectiles.forEach(proj => {
            let g = projGfxPool.current.get(proj.id);
            if (!g) { g = new PIXI.Graphics(); pl.addChild(g); projGfxPool.current.set(proj.id, g); }
            g.clear();
            if (proj.isArea) {
                const range = proj.areaRadius || 60;
                const pulse = 0.15 + 0.1 * Math.sin(stateRef.current.frameCount * 0.2);
                g.beginFill(proj.color, 0.1 + pulse);
                g.drawCircle(0, 0, range);
                g.endFill();
                g.lineStyle(2, proj.color, 0.4 + pulse);
                g.drawCircle(0, 0, range);
                g.lineStyle(0);
                // Core
                g.beginFill(0xffffff, 0.8); g.drawCircle(0, 0, proj.size); g.endFill();
            } else if (proj.style === 'arrow') {
                proj.trail.forEach((pt, ti) => {
                    g!.beginFill(proj.color, (ti / proj.trail.length) * 0.4);
                    g!.drawCircle(pt.x - proj.x, pt.y - proj.y, 1.5); g!.endFill();
                });
                g.lineStyle(2, proj.color, 1);
                const len = 14;
                g.moveTo(-Math.cos(proj.angle) * len, -Math.sin(proj.angle) * len); g.lineTo(0, 0); g.lineStyle(0);
                g.beginFill(0xffffcc);
                g.drawPolygon([0, 0, -Math.cos(proj.angle - 0.5) * 6, -Math.sin(proj.angle - 0.5) * 6, -Math.cos(proj.angle + 0.5) * 6, -Math.sin(proj.angle + 0.5) * 6]);
                g.endFill();
            } else if (proj.style === 'orb') {
                g.beginFill(proj.color, 0.25); g.drawCircle(0, 0, proj.size * 2.5); g.endFill();
                proj.trail.forEach((pt, ti) => {
                    g!.beginFill(proj.color, (ti / proj.trail.length) * 0.35);
                    g!.drawCircle(pt.x - proj.x, pt.y - proj.y, proj.size * 0.8); g!.endFill();
                });
                g.beginFill(0xffffff, 0.8); g.drawCircle(0, 0, proj.size * 0.5); g.endFill();
                g.beginFill(proj.color, 0.9); g.drawCircle(0, 0, proj.size); g.endFill();
            } else if (proj.style === 'bomb') {
                g.beginFill(0xff6600, 0.4); g.drawCircle(0, 0, proj.size * 2.5); g.endFill();
                g.beginFill(0xff2200, 0.9); g.drawCircle(0, 0, proj.size); g.endFill();
                g.lineStyle(1.5, 0xffff00, 0.8);
                g.moveTo(0, -proj.size); g.lineTo(0, proj.size);
                g.moveTo(-proj.size, 0); g.lineTo(proj.size, 0); g.lineStyle(0);
            }
            g.x = proj.x; g.y = proj.y;
        });

        // ── Particles (single batched Graphics, no alloc) ──
        if (particleBatchRef.current) {
            const pb = particleBatchRef.current;
            pb.clear();
            stateRef.current.particles.forEach(p => {
                pb.beginFill(p.color, Math.min(1, p.life / 30));
                pb.drawCircle(p.x, p.y, 2.5); pb.endFill();
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
                t = new PIXI.Text(ft.text, { fontSize: 13, fill: ft.color, fontWeight: 'bold', dropShadow: true, dropShadowDistance: 1, dropShadowAlpha: 0.8 });
                t.anchor.set(0.5); fl.addChild(t); floatTextPool.current.set(ft.id, t);
            }
            t.alpha = ft.life / ft.maxLife;
            t.x = ft.x; t.y = ft.y;
        });
    };

    return (
        <div className="defense-phase" style={{ position: 'relative', width: '100%', height: '100%', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="canvas-container" ref={pixiContainerRef} style={{ cursor: 'default', border: '2px solid #330000', borderRadius: '4px', overflow: 'hidden' }} />

            {hoveredEntity && (
                <div style={{
                    position: 'fixed', top: tooltipPos.y + 15, left: tooltipPos.x + 15,
                    backgroundColor: 'rgba(0,0,0,0.9)', color: '#fff', padding: '10px 15px',
                    borderRadius: '5px', pointerEvents: 'none', zIndex: 100,
                    border: '1px solid ' + (hoveredEntity.faction === 'HERO' ? '#ff4444' : '#44ff44'),
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)', minWidth: '160px',
                }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '6px', color: hoveredEntity.faction === 'HERO' ? '#ffaaaa' : '#aaffaa' }}>
                        {hoveredEntity.type}
                        <span style={{ fontSize: '11px', marginLeft: '8px', color: '#888' }}>{hoveredEntity.faction === 'HERO' ? '英雄軍' : '魔王軍'}</span>
                    </div>
                    <div style={{ fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                        <span style={{ color: '#aaffaa' }}>HP: {Math.max(0, Math.floor(hoveredEntity.hp))}/{hoveredEntity.maxHp}</span>
                        <span style={{ color: '#ffaaaa' }}>ATK: {hoveredEntity.attack}</span>
                        <span style={{ color: '#aaaaff' }}>射程: {hoveredEntity.range}</span>
                        <span style={{ color: '#ffff88' }}>速度: {hoveredEntity.speed}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DefensePhase;
