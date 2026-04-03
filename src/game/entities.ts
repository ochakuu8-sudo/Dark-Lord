export interface PassiveAbility {
    type: 'REFLECT' | 'AURA_REGEN' | 'PIERCING' | 'PIECE_RETURN' | 'CLONE' | 'AREA_DOT' | 'ATK_BUFF' | 'HEAL_SHOT' | 'SUMMON' | 'CORPSE_EXPLOSION' | 'PROXIMITY_EXPLOSION' | 'INSTANT_AOE' |
        'BERSERK' | 'SELF_REGEN' | 'LIFESTEAL' | 'POISON' |
        'DOUBLE_SPAWN' | 'ON_DEATH_SPAWN' | 'UNTARGETABLE' |
        'RAPID_FIRE' | 'MACHINE_GUN' | 'BOUNCE_SHOT' |
        'HEAL_AURA' | 'AOE_ON_HIT' | 'FRONTAL_AOE' |
        'EXPLODE_PROJECTILE' | 'EXPLODE_HEAL' | 'CHARGE_EXPLOSION' |
        'ALLY_DEATH_EXPLOSION' | 'ENEMY_DEATH_SPAWN' |
        'CHARGE' | 'KNOCKBACK' | 'RANGED_RESIST' |
        'TARGET_LOWEST_HP' | 'MOVE_REGEN' | 'STEALTH' |
        'ON_DEATH_STUN' | 'EVADE' | 'ENEMY_DEATH_HEAL' | 'SPLIT';
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
    passiveCache?: Partial<Record<PassiveAbility['type'], PassiveAbility>>; // 毎フレームfind()を避けるキャッシュ
    isBoss?: boolean;    // ボス敵フラグ（撃破でレシピ獲得）
    // Temporary runtime fields
    poisonedFrames?: number;
    stunFrames?: number;
    stealthActive?: boolean;
    chargeFrames?: number;   // post-dash cooldown for CHARGE ability
    chargeWindup?: number;   // windup frames remaining (>0 = winding up)
    isDashing?: boolean;     // true while dashing
    dashVx?: number;
    dashVy?: number;
    dashFrames?: number;     // remaining dash duration
    machineGunQueue?: number;    // shots remaining in burst queue
    machineGunCooldown?: number; // frames until next queued shot
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
    // --- Skeleton Derivations (Base: 骨2+X, コモン・中距離射程)
    // DPS目安: bone≈66, meat≈107, spirit≈52
    'skeleton_bone':   { maxHp: 450, attack: 55,  range: 150, speed: DEMON_SPEED * 0.9,  maxCooldown: 50,  color: 0xaaaacc, materialType: 0, attackType: 'ranged', size: 10, accuracy: 1, passiveAbilities: [{ type: 'DOUBLE_SPAWN' }] },
    'skeleton_meat':   { maxHp: 350, attack: 75,  range: 150, speed: DEMON_SPEED,         maxCooldown: 42,  color: 0xff9999, materialType: 1, attackType: 'ranged', size: 11, accuracy: 1, passiveAbilities: [{ type: 'ON_DEATH_SPAWN', value: 0 }] },
    'skeleton_spirit': { maxHp: 220, attack: 48,  range: 280, speed: DEMON_SPEED * 0.85,  maxCooldown: 55,  color: 0xcc88ff, materialType: 2, attackType: 'ranged', size: 9,  accuracy: 1, passiveAbilities: [{ type: 'UNTARGETABLE' }] },

    // --- Cerberus Derivations (Base: 肉2+X, コモン・高速近接)
    // DPS目安: bone≈107(RAPID_FIRE), meat≈126, spirit≈67
    'cerberus_bone':   { maxHp: 500, attack: 25,  range: 50,  speed: DEMON_SPEED * 1.1,  maxCooldown: 14,  color: 0xddccaa, materialType: 0, attackType: 'melee',  size: 22, accuracy: 1, passiveAbilities: [{ type: 'RAPID_FIRE' }] },
    'cerberus_meat':   { maxHp: 700, attack: 80,  range: 50,  speed: DEMON_SPEED * 1.2,  maxCooldown: 38,  color: 0xff7777, materialType: 1, attackType: 'melee',  size: 24, accuracy: 1, passiveAbilities: [{ type: 'LIFESTEAL', value: 0.3 }] },
    'cerberus_spirit': { maxHp: 320, attack: 58,  range: 180, speed: DEMON_SPEED,         maxCooldown: 52,  color: 0xbb88ff, materialType: 2, attackType: 'ranged', size: 20, accuracy: 1, passiveAbilities: [{ type: 'POISON', value: 20, range: 180 }] },

    // --- Lich Derivations (Base: 霊3+X, コモン・魔法遠距離)
    // DPS目安: bone≈69+跳弾連鎖, meat≈91+回復, spirit≈84+範囲
    'lich_bone':   { maxHp: 420, attack: 75,  range: 280, speed: DEMON_SPEED * 0.8,  maxCooldown: 65,  color: 0xeeeeff, materialType: 0, attackType: 'ranged', size: 16, accuracy: 1, passiveAbilities: [{ type: 'BOUNCE_SHOT', value: 999 }] },
    'lich_meat':   { maxHp: 600, attack: 88,  range: 200, speed: DEMON_SPEED * 0.8,  maxCooldown: 58,  color: 0xffaaaa, materialType: 1, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'HEAL_AURA', value: 6, range: 120 }] },
    'lich_spirit': { maxHp: 260, attack: 105, range: 400, speed: DEMON_SPEED * 0.9,  maxCooldown: 75,  color: 0xaa55ff, materialType: 2, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'AOE_ON_HIT', value: 40, range: 80 }] },

    // --- Goblin Derivations (コモン・初期スターター)
    // 骨: 単体高火力  肉: 高HP耐久  霊: 範囲攻撃低火力
    'goblin_bone':   { maxHp: 110,  attack: 55, range: 40, speed: DEMON_SPEED,        maxCooldown: 42, color: 0xbbaa88, materialType: 0, attackType: 'melee',  size: 14, accuracy: 1 },
    'goblin_meat':   { maxHp: 400,  attack: 18, range: 40, speed: DEMON_SPEED * 0.85, maxCooldown: 50, color: 0xff9966, materialType: 1, attackType: 'melee',  size: 16, accuracy: 1 },
    'goblin_spirit': { maxHp: 80,   attack: 18, range: 100, speed: DEMON_SPEED,       maxCooldown: 50, color: 0xaa88ff, materialType: 2, attackType: 'ranged', size: 11, accuracy: 1, passiveAbilities: [{ type: 'INSTANT_AOE', value: 18, range: 80 }] },

    // --- Imp Derivations (コモン・中距離支援)
    // DPS目安: bone≈40+ピース回収, meat≈ヒール, spirit≈55+死体爆発
    'imp_bone':   { maxHp: 180, attack: 30, range: 60,  speed: DEMON_SPEED * 1.3, maxCooldown: 45, color: 0xddbb88, materialType: 0, attackType: 'melee',  size: 13, accuracy: 1, passiveAbilities: [{ type: 'PIECE_RETURN', range: 120 }] },
    'imp_meat':   { maxHp: 250, attack: 40, range: 180, speed: DEMON_SPEED * 1.0, maxCooldown: 60, color: 0xff9977, materialType: 1, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'HEAL_SHOT' }] },
    'imp_spirit': { maxHp: 150, attack: 55, range: 160, speed: DEMON_SPEED * 1.1, maxCooldown: 50, color: 0xbb77ff, materialType: 2, attackType: 'ranged', size: 12, accuracy: 1, passiveAbilities: [{ type: 'CORPSE_EXPLOSION', value: 80, range: 80 }] },

    // --- Banshee Derivations (コモン・霊体スクリーマー)
    // DPS目安: bone≈80+範囲, meat≈60+複製, spirit≈100+自爆
    'banshee_bone':   { maxHp: 200, attack: 90,  range: 300, speed: DEMON_SPEED * 0.9, maxCooldown: 70, color: 0xeeeeff, materialType: 0, attackType: 'ranged', size: 13, accuracy: 1, passiveAbilities: [{ type: 'INSTANT_AOE', value: 60, range: 100 }] },
    'banshee_meat':   { maxHp: 280, attack: 60,  range: 180, speed: DEMON_SPEED * 1.0, maxCooldown: 55, color: 0xffbbbb, materialType: 1, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'CLONE' }] },
    'banshee_spirit': { maxHp: 160, attack: 100, range: 60,  speed: DEMON_SPEED * 1.4, maxCooldown: 50, color: 0xaa66ff, materialType: 2, attackType: 'melee',  size: 11, accuracy: 1, passiveAbilities: [{ type: 'PROXIMITY_EXPLOSION', value: 150, range: 80 }] },

    // --- Orc Derivations (コモン・低速重装AOE)
    // DPS目安: bone≈24×AOE, meat≈28×AOE, spirit≈30×AOE
    'orc_bone':   { maxHp: 1200, attack: 42, range: 60, speed: DEMON_SPEED,        maxCooldown: 105, color: 0xcccccc, materialType: 0, attackType: 'melee', size: 26, accuracy: 1, passiveAbilities: [{ type: 'FRONTAL_AOE', range: 60, value: 1.0 }, { type: 'REFLECT', value: 0.3 }] },
    'orc_meat':   { maxHp: 850,  attack: 55, range: 60, speed: DEMON_SPEED,        maxCooldown: 120, color: 0xff6666, materialType: 1, attackType: 'melee', size: 24, accuracy: 1, passiveAbilities: [{ type: 'FRONTAL_AOE', range: 60, value: 1.0 }, { type: 'BERSERK', value: 2.0 }] },
    'orc_spirit': { maxHp: 500,  attack: 44, range: 60, speed: DEMON_SPEED * 1.2,  maxCooldown: 88,  color: 0xaa66ff, materialType: 2, attackType: 'melee', size: 20, accuracy: 1, passiveAbilities: [{ type: 'FRONTAL_AOE', range: 60, value: 1.0 }, { type: 'SELF_REGEN', value: 25 }] },

    // --- Archer Derivations (コモン・遠距離)
    // DPS目安: bone≈72(超長距離), meat≈キュー連射, spirit≈106(貫通)
    'archer_bone':   { maxHp: 230, attack: 105, range: 580, speed: DEMON_SPEED,        maxCooldown: 88, color: 0xdddddd, materialType: 0, attackType: 'ranged', size: 16, accuracy: 1 },
    'archer_meat':   { maxHp: 380, attack: 60,  range: 200, speed: DEMON_SPEED * 0.9,  maxCooldown: 22, color: 0xff9999, materialType: 1, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'MACHINE_GUN', value: 5 }] },
    'archer_spirit': { maxHp: 170, attack: 62,  range: 360, speed: DEMON_SPEED,        maxCooldown: 35, color: 0xcc88ff, materialType: 2, attackType: 'ranged', size: 14, accuracy: 1, passiveAbilities: [{ type: 'PIERCING', value: 600 }] },

    // --- Necromancer Derivations (レア・召喚/死亡利用)
    'necromancer_bone':   { maxHp: 380, attack: 85,  range: 200, speed: DEMON_SPEED * 0.7, maxCooldown: 100, color: 0xffffff, materialType: 0, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'SUMMON', value: 1 }] },
    'necromancer_meat':   { maxHp: 500, attack: 22,  range: 100, speed: DEMON_SPEED * 0.7, maxCooldown: 360, color: 0xff4444, materialType: 1, attackType: 'ranged', size: 20, accuracy: 1, passiveAbilities: [{ type: 'ENEMY_DEATH_HEAL', value: 0.2, range: 150 }] },
    'necromancer_spirit': { maxHp: 300, attack: 88,  range: 180, speed: DEMON_SPEED * 0.8, maxCooldown: 80,  color: 0x7700cc, materialType: 2, attackType: 'ranged', size: 16, accuracy: 1, passiveAbilities: [{ type: 'ALLY_DEATH_EXPLOSION', value: 120, range: 100 }] },

    // --- Wisp Derivations (コモン・高速突撃特攻)
    // DPS目安: bone≈148, meat≈203, spirit≈129 (低HP・高速・短命で実質は下振れ)
    'wisp_bone':   { maxHp: 200, attack: 160, range: 80,  speed: DEMON_SPEED * 1.8, maxCooldown: 65, color: 0xeeeeff, materialType: 0, attackType: 'melee', size: 12, accuracy: 1, passiveAbilities: [{ type: 'EXPLODE_PROJECTILE', value: 100 }] },
    'wisp_meat':   { maxHp: 320, attack: 220, range: 80,  speed: DEMON_SPEED * 1.6, maxCooldown: 65, color: 0xff9999, materialType: 1, attackType: 'melee', size: 14, accuracy: 1, passiveAbilities: [{ type: 'EXPLODE_HEAL', value: 150, range: 120 }] },
    'wisp_spirit': { maxHp: 160, attack: 140, range: 100, speed: DEMON_SPEED * 2.2, maxCooldown: 65, color: 0xcc88ff, materialType: 2, attackType: 'melee', size: 10, accuracy: 1, passiveAbilities: [{ type: 'ON_DEATH_STUN', value: 60, range: 120 }] },

    // --- Minotaur Derivations (レア・突進タンク)
    // DPS目安: bone≈156, meat≈149, spirit≈150 + 突進AoE
    // value=突進AoEダメージ, range=溜め開始トリガー距離, cooldown=突進後クールダウン(frames)
    'minotaur_bone':   { maxHp: 1100, attack: 130, range: 50, speed: DEMON_SPEED * 0.9, maxCooldown: 50, color: 0xddaa77, materialType: 0, attackType: 'melee', size: 24, accuracy: 1, passiveAbilities: [{ type: 'CHARGE', value: 300, range: 260, cooldown: 360 }] },
    'minotaur_meat':   { maxHp: 1350, attack: 112, range: 50, speed: DEMON_SPEED * 1.0, maxCooldown: 45, color: 0xff5555, materialType: 1, attackType: 'melee', size: 26, accuracy: 1, passiveAbilities: [{ type: 'RANGED_RESIST', value: 0.5 }, { type: 'CHARGE', value: 260, range: 220, cooldown: 300 }] },
    'minotaur_spirit': { maxHp: 820,  attack: 95,  range: 50, speed: DEMON_SPEED * 1.1, maxCooldown: 38, color: 0x9966ff, materialType: 2, attackType: 'melee', size: 22, accuracy: 1, passiveAbilities: [{ type: 'CHARGE', value: 220, range: 200, cooldown: 270 }, { type: 'KNOCKBACK', value: 120 }] },

    // --- Ghoul Derivations (レア・高速アサシン)
    // DPS目安: bone≈150, meat≈182, spirit≈150
    'ghoul_bone':   { maxHp: 220, attack: 70, range: 50, speed: DEMON_SPEED * 1.5, maxCooldown: 28, color: 0xaaddaa, materialType: 0, attackType: 'melee', size: 16, accuracy: 1, passiveAbilities: [{ type: 'SPLIT' }] },
    'ghoul_meat':   { maxHp: 600, attack: 85, range: 50, speed: DEMON_SPEED * 1.4, maxCooldown: 28, color: 0xff9988, materialType: 1, attackType: 'melee', size: 18, accuracy: 1, passiveAbilities: [{ type: 'EVADE', value: 0.9 }] },
    'ghoul_spirit': { maxHp: 340, attack: 60, range: 50, speed: DEMON_SPEED * 1.6, maxCooldown: 24, color: 0x88aaff, materialType: 2, attackType: 'melee', size: 14, accuracy: 1, passiveAbilities: [{ type: 'STEALTH' }] },

    // --- Gargoyle Derivations (コモン・重装近接)
    // DPS目安: bone≈60+反射, meat≈76+ノックバック, spirit≈68+継続ダメージ
    'gargoyle_bone':   { maxHp: 400, attack: 60,  range: 55, speed: DEMON_SPEED,        maxCooldown: 60, color: 0xbbbbcc, materialType: 0, attackType: 'melee', size: 20, accuracy: 1, passiveAbilities: [{ type: 'REFLECT', value: 0.25 }] },
    'gargoyle_meat':   { maxHp: 650, attack: 70,  range: 55, speed: DEMON_SPEED,        maxCooldown: 55, color: 0xff8866, materialType: 1, attackType: 'melee', size: 22, accuracy: 1, passiveAbilities: [{ type: 'KNOCKBACK', value: 80 }] },
    'gargoyle_spirit': { maxHp: 280, attack: 80,  range: 240, speed: DEMON_SPEED * 0.9, maxCooldown: 70, color: 0xaa88ff, materialType: 2, attackType: 'ranged', size: 18, accuracy: 1, passiveAbilities: [{ type: 'AREA_DOT', value: 15, range: 80 }] },

    // --- Token Units ---
    'zombie': {
        maxHp: 220, attack: 90, range: 45, speed: DEMON_SPEED * 0.6, maxCooldown: 150, color: 0x446644, materialType: 1, attackType: 'melee', size: 18, accuracy: 1
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
};

export const PASSIVE_DESCRIPTIONS: Record<string, string> = {
    'REFLECT':              '「被弾時」「攻撃者」へダメージの一部を「反射」する。',
    'AURA_REGEN':           '「常時」「周囲」の「味方」HPを「回復」する。',
    'PIERCING':             '「攻撃時」弾を「貫通」させる。',
    'PIECE_RETURN':         '「味方が死亡時」より広い範囲のピースを回収する。',
    'CLONE':                '「攻撃時」「自身」の分身を「召喚」する。',
    'AREA_DOT':             '「命中時」「着弾地点」に持続ダメージ領域を生成する。',
    'ATK_BUFF':             '「常時」「周囲」の「味方」に「攻撃力上昇」を「付与」する。',
    'HEAL_SHOT':            '「攻撃時」傷ついた「味方」を「回復」する。',
    'SUMMON':               '「1秒毎に」スケルトンを「召喚」する。',
    'CORPSE_EXPLOSION':     '「味方が死亡時」遺体を糧に「周囲」へ「爆発」する。',
    'PROXIMITY_EXPLOSION':  '「常時」敵が近づくと「周囲」へ「爆発」する。',
    'INSTANT_AOE':          '「攻撃時」「着弾地点」を直接「爆発」させる。',
    'BERSERK':              '「常時」HP半減で「自身」に「狂暴化」を「付与」する。',
    'SELF_REGEN':           '「常時」「自身」のHPを「再生」する。',
    'LIFESTEAL':            '「命中時」与ダメージの一部を「自身」に「回復」する。',
    'POISON':               '「命中時」「対象」に「毒」を「付与」する。',
    'DOUBLE_SPAWN':         '「召喚時」「自身」をもう1体「召喚」する。',
    'ON_DEATH_SPAWN':       '「死亡時」骨スケルトンを「召喚」する。',
    'UNTARGETABLE':         '「常時」他DEMONが生存中、「自身」に「ステルス」を「付与」する。',
    'RAPID_FIRE':           '「攻撃時」超高速で「連射」する。',
    'MACHINE_GUN':          '「攻撃時」複数の弾を「連射」する。',
    'BOUNCE_SHOT':          '「命中時」弾を別の敵へ「跳弾」させる。',
    'HEAL_AURA':            '「X秒毎に」「周囲」の「味方」HPを「回復」する。',
    'AOE_ON_HIT':           '「命中時」「着弾地点」を「爆発」させる。',
    'FRONTAL_AOE':          '「攻撃時」「前方」範囲を「範囲化」して攻撃する。',
    'EXPLODE_PROJECTILE':   '「死亡時」「周囲」の敵へ「爆発」ダメージを与える。',
    'EXPLODE_HEAL':         '「死亡時」「周囲」の「味方」を「回復」する。',
    'CHARGE_EXPLOSION':     '「死亡時」「周囲」へ「爆発」する（生存時間でダメージ増加）。',
    'ALLY_DEATH_EXPLOSION': '「味方が死亡時」「周囲」へ「爆発攻撃」する。',
    'ENEMY_DEATH_SPAWN':    '「敵が死亡時」スケルトンを「召喚」する。',
    'CHARGE':               '「戦闘開始時」「対象」へ「突進」し大ダメージを与える。',
    'KNOCKBACK':            '「命中時」「対象」を「ノックバック」する。',
    'RANGED_RESIST':        '「常時」「自身」に「遠距離耐性」を「付与」する。',
    'TARGET_LOWEST_HP':     '「常時」最もHPが低い敵を優先して攻撃する。',
    'MOVE_REGEN':           '「常時」移動するたびに「自身」HPを「再生」する。',
    'STEALTH':              '「常時」初回攻撃まで「自身」に「ステルス」を「付与」する。',
    'ON_DEATH_STUN':        '「死亡時」「周囲」の敵に「スタン」を「付与」する。',
    'EVADE':                '「被攻撃時」攻撃を「回避」する。',
    'ENEMY_DEATH_HEAL':     '「敵が死亡時」「周囲」の「味方」を「範囲回復」する。',
    'SPLIT':                '「死亡時」「自身」の分身を2体「召喚」する。',
};
