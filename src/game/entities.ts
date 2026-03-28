export interface PassiveAbility {
    type: 'REFLECT' | 'AURA_REGEN' | 'PIERCING' | 'PIECE_RETURN' | 'CLONE' | 'AREA_DOT' | 'ATK_BUFF' | 'HEAL_SHOT' | 'SUMMON' | 'CORPSE_EXPLOSION' | 'PROXIMITY_EXPLOSION' | 'INSTANT_AOE' |
        'BERSERK' | 'SELF_REGEN' | 'LIFESTEAL' | 'POISON' |
        'DOUBLE_SPAWN' | 'ON_DEATH_SPAWN' | 'UNTARGETABLE' |
        'RAPID_FIRE' | 'MACHINE_GUN' | 'BOUNCE_SHOT' |
        'HEAL_AURA' | 'AOE_ON_HIT' |
        'EXPLODE_PROJECTILE' | 'EXPLODE_HEAL' | 'CHARGE_EXPLOSION' |
        'ALLY_DEATH_EXPLOSION' | 'ENEMY_DEATH_SPAWN' |
        'CHARGE' | 'KNOCKBACK' | 'RANGED_RESIST' |
        'TARGET_LOWEST_HP' | 'MOVE_REGEN' | 'STEALTH';
    value?: number;
    range?: number;
    cooldown?: number;
}

export interface EntityState {
    id: string;
    type: string;
    faction: 'DEMON' | 'HERO';
    x: number;
    y: number;
    hp: number;
    maxHp: number;
    attack: number;
    range: number;
    speed: number;
    cooldown: number;
    maxCooldown: number;
    color: number;
    materialType?: number; // 0: Bone, 1: Meat, 2: Spirit
    attackType?: 'melee' | 'ranged';
    size?: number;         // pixel radius for rendering and hitbox
    accuracy?: number;     // 0-1: hit rate
    passiveAbilities?: PassiveAbility[];
    // Temporary runtime fields
    poisonedFrames?: number;
    stealthActive?: boolean;
    chargeFrames?: number;   // cooldown for CHARGE ability
    distanceTraveled?: number; // for MOVE_REGEN
    spawnedAt?: number;      // frame number when spawned (for CHARGE_EXPLOSION)
    prevX?: number;          // previous frame position for movement tracking
    prevY?: number;
}

export type HeroType = '村人' | '農夫' | '弓兵' | '剣士' | '魔法使い' | '重騎士' | 'プリースト' | '聖騎士' | 'パラディン' | '大魔道士' | '勇者';

export const HERO_ROSTER: HeroType[] = [
    '村人', '農夫', '弓兵', '剣士', '魔法使い', '重騎士', 'プリースト', '聖騎士', 'パラディン', '大魔道士', '勇者'
];

// 自軍ユニットの移動速度は一律 0.8 に設定
const DEMON_SPEED = 0.8;

export const UNIT_STATS: Record<string, Partial<EntityState>> = {
    // --- Skeleton Derivations (Base: 骨2+X, コモン・中距離) ---
    'skeleton_bone':   { maxHp: 700, attack: 80,  range: 150, speed: DEMON_SPEED * 0.9, maxCooldown: 50, color: 0xaaaacc, materialType: 0, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'DOUBLE_SPAWN' }] },
    'skeleton_meat':   { maxHp: 500, attack: 110, range: 150, speed: DEMON_SPEED,       maxCooldown: 45, color: 0xff9999, materialType: 1, attackType: 'ranged', size: 15, accuracy: 1, passiveAbilities: [{ type: 'ON_DEATH_SPAWN', value: 0 }] },
    'skeleton_spirit': { maxHp: 350, attack: 70,  range: 280, speed: DEMON_SPEED * 0.85, maxCooldown: 55, color: 0xcc88ff, materialType: 2, attackType: 'ranged', size: 12, accuracy: 1, passiveAbilities: [{ type: 'UNTARGETABLE' }] },

    // --- Cerberus Derivations (Base: 肉2+X, コモン・高速近接) ---
    'cerberus_bone':   { maxHp: 600, attack: 90,  range: 50, speed: DEMON_SPEED * 1.1, maxCooldown: 5,  color: 0xddccaa, materialType: 0, attackType: 'melee',  size: 22, accuracy: 1, passiveAbilities: [{ type: 'RAPID_FIRE' }] },
    'cerberus_meat':   { maxHp: 850, attack: 130, range: 50, speed: DEMON_SPEED * 1.2, maxCooldown: 35, color: 0xff7777, materialType: 1, attackType: 'melee',  size: 24, accuracy: 1, passiveAbilities: [{ type: 'LIFESTEAL', value: 0.3 }] },
    'cerberus_spirit': { maxHp: 400, attack: 85,  range: 180, speed: DEMON_SPEED,      maxCooldown: 50, color: 0xbb88ff, materialType: 2, attackType: 'ranged', size: 20, accuracy: 1, passiveAbilities: [{ type: 'POISON', value: 20, range: 180 }] },

    // --- Lich Derivations (Base: 霊3+X, コモン・遠距離浮遊) ---
    'lich_bone':   { maxHp: 550, attack: 130, range: 300, speed: DEMON_SPEED * 0.8, maxCooldown: 60, color: 0xeeeeff, materialType: 0, attackType: 'ranged', size: 16, accuracy: 1, passiveAbilities: [{ type: 'BOUNCE_SHOT', value: 2 }] },
    'lich_meat':   { maxHp: 750, attack: 110, range: 200, speed: DEMON_SPEED * 0.8, maxCooldown: 55, color: 0xffaaaa, materialType: 1, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'HEAL_AURA', value: 8, range: 120 }] },
    'lich_spirit': { maxHp: 350, attack: 160, range: 420, speed: DEMON_SPEED * 0.9, maxCooldown: 70, color: 0xaa55ff, materialType: 2, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'AOE_ON_HIT', value: 60, range: 80 }] },

    // --- Goblin Derivations (Base: 3マッチ雑魚・APループ燃料) ---
    'goblin_bone':   { maxHp: 80,  attack: 15, range: 40, speed: DEMON_SPEED * 1.2, maxCooldown: 40, color: 0xaaaaaa, materialType: 0, attackType: 'melee', size: 12, accuracy: 1 },
    'goblin_meat':   { maxHp: 120, attack: 20, range: 40, speed: DEMON_SPEED * 1.4, maxCooldown: 30, color: 0xff8888, materialType: 1, attackType: 'melee', size: 12, accuracy: 1 },
    'goblin_spirit': { maxHp: 60,  attack: 10, range: 80, speed: DEMON_SPEED * 1.5, maxCooldown: 25, color: 0xcc88ff, materialType: 2, attackType: 'melee', size: 10, accuracy: 1 },

    // --- Orc Derivations (Base: Melee) ---
    'orc_bone':   { maxHp: 2000, attack: 50, range: 45, speed: DEMON_SPEED,       maxCooldown: 60, color: 0xcccccc, materialType: 0, attackType: 'melee', size: 26, accuracy: 1, passiveAbilities: [{ type: 'REFLECT', value: 0.3 }] },
    'orc_meat':   { maxHp: 1250, attack: 75, range: 45, speed: DEMON_SPEED,       maxCooldown: 70, color: 0xff6666, materialType: 1, attackType: 'melee', size: 24, accuracy: 1, passiveAbilities: [{ type: 'BERSERK', value: 2.0 }] },
    'orc_spirit': { maxHp: 700,  attack: 60, range: 45, speed: DEMON_SPEED * 1.2, maxCooldown: 50, color: 0xaa66ff, materialType: 2, attackType: 'melee', size: 20, accuracy: 1, passiveAbilities: [{ type: 'SELF_REGEN', value: 30 }] },

    // --- Archer Derivations (Base: 骨3+X, コモン・遠距離) ---
    'archer_bone':   { maxHp: 300, attack: 200, range: 630, speed: DEMON_SPEED,       maxCooldown: 80, color: 0xdddddd, materialType: 0, attackType: 'ranged', size: 16, accuracy: 1 },
    'archer_meat':   { maxHp: 550, attack: 160, range: 210, speed: DEMON_SPEED * 0.9, maxCooldown: 18, color: 0xff9999, materialType: 1, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'MACHINE_GUN', value: 6 }] },
    'archer_spirit': { maxHp: 200, attack: 100, range: 360, speed: DEMON_SPEED,       maxCooldown: 30, color: 0xcc88ff, materialType: 2, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'PIERCING', value: 600 }] },

    // --- Necromancer Derivations (Base: Token/Death) ---
    'necromancer_bone':   { maxHp: 450, attack: 100, range: 200, speed: DEMON_SPEED * 0.7, maxCooldown: 100, color: 0xffffff, materialType: 0, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'SUMMON', value: 1 }] },
    'necromancer_meat':   { maxHp: 550, attack: 25,  range: 100, speed: DEMON_SPEED * 0.7, maxCooldown: 360, color: 0xff4444, materialType: 1, attackType: 'ranged', size: 20, accuracy: 1, passiveAbilities: [{ type: 'ALLY_DEATH_EXPLOSION', value: 150, range: 100 }] },
    'necromancer_spirit': { maxHp: 350, attack: 100, range: 180, speed: DEMON_SPEED * 0.8, maxCooldown: 80,  color: 0x7700cc, materialType: 2, attackType: 'ranged', size: 16, accuracy: 1, passiveAbilities: [{ type: 'ENEMY_DEATH_SPAWN', value: 2 }] },

    // --- Wisp Derivations ---
    'wisp_bone':   { maxHp: 250, attack: 300, range: 80,  speed: DEMON_SPEED * 1.8, maxCooldown: 60, color: 0xeeeeff, materialType: 0, attackType: 'melee', size: 12, accuracy: 1, passiveAbilities: [{ type: 'EXPLODE_PROJECTILE', value: 200 }] },
    'wisp_meat':   { maxHp: 450, attack: 400, range: 80,  speed: DEMON_SPEED * 1.6, maxCooldown: 60, color: 0xff9999, materialType: 1, attackType: 'melee', size: 14, accuracy: 1, passiveAbilities: [{ type: 'EXPLODE_HEAL', value: 300, range: 120 }] },
    'wisp_spirit': { maxHp: 200, attack: 250, range: 100, speed: DEMON_SPEED * 2.2, maxCooldown: 60, color: 0xcc88ff, materialType: 2, attackType: 'melee', size: 10, accuracy: 1, passiveAbilities: [{ type: 'CHARGE_EXPLOSION', value: 100 }] },

    // --- Minotaur Derivations (Base: 肉骨骨+X, レア・突進) ---
    'minotaur_bone':   { maxHp: 1200, attack: 150, range: 50, speed: DEMON_SPEED * 0.9, maxCooldown: 45, color: 0xddaa77, materialType: 0, attackType: 'melee', size: 24, accuracy: 1, passiveAbilities: [{ type: 'CHARGE', value: 300, range: 200 }] },
    'minotaur_meat':   { maxHp: 1500, attack: 130, range: 50, speed: DEMON_SPEED * 1.0, maxCooldown: 40, color: 0xff5555, materialType: 1, attackType: 'melee', size: 26, accuracy: 1, passiveAbilities: [{ type: 'RANGED_RESIST', value: 0.5 }, { type: 'CHARGE', value: 250, range: 150 }] },
    'minotaur_spirit': { maxHp: 900,  attack: 110, range: 50, speed: DEMON_SPEED * 1.1, maxCooldown: 35, color: 0x9966ff, materialType: 2, attackType: 'melee', size: 22, accuracy: 1, passiveAbilities: [{ type: 'CHARGE', value: 200, range: 150 }, { type: 'KNOCKBACK', value: 120 }] },

    // --- Ghoul Derivations (Base: 霊肉+X 十字, レア・高速) ---
    'ghoul_bone':   { maxHp: 500, attack: 80,  range: 50, speed: DEMON_SPEED * 1.5, maxCooldown: 30, color: 0xaaddaa, materialType: 0, attackType: 'melee', size: 16, accuracy: 1, passiveAbilities: [{ type: 'TARGET_LOWEST_HP' }] },
    'ghoul_meat':   { maxHp: 700, attack: 100, range: 50, speed: DEMON_SPEED * 1.4, maxCooldown: 30, color: 0xff9988, materialType: 1, attackType: 'melee', size: 18, accuracy: 1, passiveAbilities: [{ type: 'MOVE_REGEN', value: 0.05 }] },
    'ghoul_spirit': { maxHp: 400, attack: 70,  range: 50, speed: DEMON_SPEED * 1.6, maxCooldown: 25, color: 0x88aaff, materialType: 2, attackType: 'melee', size: 14, accuracy: 1, passiveAbilities: [{ type: 'STEALTH' }] },

    // --- Token Units ---
    'zombie': {
        maxHp: 250, attack: 125, range: 45, speed: DEMON_SPEED * 0.6, maxCooldown: 150, color: 0x446644, materialType: 1, attackType: 'melee', size: 18, accuracy: 1
    },
    // ===== 英雄軍（敵）=====
    '村人': { maxHp: 900, attack: 20, range: 40, speed: 1.1, maxCooldown: 70, color: 0xddddbb },
    '農夫': { maxHp: 1200, attack: 30, range: 40, speed: 1.0, maxCooldown: 60, color: 0xbbaa77 },
    '弓兵': { maxHp: 450, attack: 60, range: 400, speed: 1.2, maxCooldown: 80, color: 0xaaeeaa },
    '剣士': { maxHp: 2500, attack: 90, range: 50, speed: 1.3, maxCooldown: 55, color: 0x8888ff },
    '魔法使い': { maxHp: 550, attack: 150, range: 400, speed: 1.1, maxCooldown: 100, color: 0xee88ff },
    '重騎士': { maxHp: 5000, attack: 125, range: 55, speed: 0.9, maxCooldown: 70, color: 0x5566cc },
    'プリースト': { maxHp: 750, attack: -150, range: 150, speed: 0.9, maxCooldown: 90, color: 0xffccff },
    '聖騎士': { maxHp: 4000, attack: 200, range: 60, speed: 0.9, maxCooldown: 65, color: 0xffffff },
    'パラディン': { maxHp: 6000, attack: 100, range: 55, speed: 0.7, maxCooldown: 80, color: 0xffdd44 },
    '大魔道士': { maxHp: 1500, attack: 275, range: 400, speed: 0.9, maxCooldown: 100, color: 0xcc44ff },
    '勇者': { maxHp: 25000, attack: 325, range: 65, speed: 1.2, maxCooldown: 50, color: 0xff2222 },
    'ボス': { maxHp: 800, attack: 60, range: 9999, speed: 0, maxCooldown: 60, color: 0xff4400 },
};

export const PASSIVE_DESCRIPTIONS: Record<string, string> = {
    'REFLECT': 'ダメージの一部を常に反射する。',
    'AURA_REGEN': '周囲の味方のHPを徐々に回復する。',
    'PIERCING': '敵を貫通する遠距離攻撃を放つ。',
    'PIECE_RETURN': '死亡時、より広い範囲のピースを回収する。',
    'CLONE': '攻撃時、一時的に自身の分身を作り出す。',
    'AREA_DOT': '着弾地点に持続的なダメージ領域を生成する。',
    'ATK_BUFF': '周囲の味方の攻撃力を上昇させる。',
    'HEAL_SHOT': '最も傷ついた味方を魔法で癒やす。',
    'SUMMON': '一定時間ごとにスケルトンを召喚し続ける。',
    'CORPSE_EXPLOSION': '近くの味方の死を糧に爆発を引き起こす。',
    'PROXIMITY_EXPLOSION': '敵が一定距離まで近づくと自爆し、周囲に大ダメージを与える。',
    'INSTANT_AOE': '弾を放たず、敵の位置に直接範囲魔法を発動する。',
    'BERSERK': 'HP半分以下になると攻撃力が大幅に上昇する。',
    'SELF_REGEN': '一定時間ごとに自身のHPを回復する。',
    'LIFESTEAL': '与えたダメージの一部をHPとして吸収する。',
    'POISON': '攻撃ヒット時にターゲットを毒状態にする。',
    'DOUBLE_SPAWN': '召喚時に同じユニットが2体出現する。',
    'ON_DEATH_SPAWN': '死亡時に骨スケルトンを召喚する。',
    'UNTARGETABLE': '他に生きているDEMONがいる間、敵のターゲットにならない。',
    'RAPID_FIRE': '超高速で攻撃を繰り返す。',
    'MACHINE_GUN': '攻撃時に複数の弾を同時発射する。',
    'BOUNCE_SHOT': '弾が命中後に近くの別の敵へバウンスする。',
    'HEAL_AURA': '周囲の味方のHPを徐々に回復する。',
    'AOE_ON_HIT': '弾が命中した際に周囲の敵にも範囲ダメージを与える。',
    'EXPLODE_PROJECTILE': '死亡時に4方向へ貫通弾を発射する。',
    'EXPLODE_HEAL': '死亡時の爆発で周囲の味方を回復する。',
    'CHARGE_EXPLOSION': '生存時間が長いほど死亡時爆発ダメージが増加する。',
    'ALLY_DEATH_EXPLOSION': '味方が死亡した際に範囲爆発を起こす。',
    'ENEMY_DEATH_SPAWN': '敵が死亡した際に霊スケルトンを召喚する。',
    'CHARGE': '一定距離以内に敵が入ると突進して大ダメージを与える。',
    'KNOCKBACK': '攻撃ヒット時に敵を後方へ吹き飛ばす。',
    'RANGED_RESIST': '遠距離攻撃から受けるダメージを軽減する。',
    'TARGET_LOWEST_HP': '最もHPが低い敵を優先して攻撃する。',
    'MOVE_REGEN': '移動するごとにHPを少し回復する。',
    'STEALTH': '初回攻撃まで敵のターゲットにならない。',
};
