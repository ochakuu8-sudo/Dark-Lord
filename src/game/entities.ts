export interface PassiveAbility {
    type: 'REFLECT' | 'AURA_REGEN' | 'PIERCING' | 'PIECE_RETURN' | 'CLONE' | 'AREA_DOT' | 'ATK_BUFF' | 'HEAL_SHOT' | 'SUMMON' | 'CORPSE_EXPLOSION';
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
    passiveAbilities?: PassiveAbility[];
}

// 自軍ユニットの移動速度は一律 0.4 に設定
const DEMON_SPEED = 0.4;

export const UNIT_STATS: Record<string, Partial<EntityState>> = {
    // --- Orc Derivations (Base: Melee) ---
    'orc_bone': { 
        maxHp: 180, attack: 10, range: 45, speed: DEMON_SPEED, maxCooldown: 60, color: 0xcccccc, materialType: 0,
        passiveAbilities: [{ type: 'REFLECT', value: 0.2 }] // 20% 反射
    },
    'orc_meat': { 
        maxHp: 250, attack: 15, range: 45, speed: DEMON_SPEED, maxCooldown: 70, color: 0xff6666, materialType: 1
    },
    'orc_spirit': { 
        maxHp: 140, attack: 12, range: 45, speed: DEMON_SPEED * 1.2, maxCooldown: 50, color: 0xaa66ff, materialType: 2,
        passiveAbilities: [{ type: 'AURA_REGEN', value: 1, range: 100 }] // 周囲100pxに毎秒1回復
    },

    // --- Skeleton Derivations (Base: Ranged) ---
    'skeleton_bone': { 
        maxHp: 40, attack: 22, range: 350, speed: DEMON_SPEED, maxCooldown: 50, color: 0xdddddd, materialType: 0
    },
    'skeleton_meat': { 
        maxHp: 70, attack: 28, range: 120, speed: DEMON_SPEED * 0.9, maxCooldown: 35, color: 0xff9999, materialType: 1
    },
    'skeleton_spirit': { 
        maxHp: 30, attack: 14, range: 200, speed: DEMON_SPEED, maxCooldown: 70, color: 0xcc88ff, materialType: 2,
        passiveAbilities: [{ type: 'PIERCING', value: 600 }] // 600px 飛ぶ貫通弾
    },

    // --- Wizard Derivations (Base: Support/Magic) ---
    'wizard_bone': { 
        maxHp: 80, attack: 0, range: 160, speed: DEMON_SPEED * 0.8, maxCooldown: 60, color: 0xeeeeee, materialType: 0,
        passiveAbilities: [{ type: 'ATK_BUFF', value: 0.2, range: 120 }] // 周囲の味方のATK 1.2倍
    },
    'wizard_meat': { 
        maxHp: 100, attack: 30, range: 200, speed: DEMON_SPEED * 0.8, maxCooldown: 120, color: 0xffcccc, materialType: 1,
        passiveAbilities: [{ type: 'HEAL_SHOT' }] // 最低HPの味方を撃つ
    },
    'wizard_spirit': { 
        maxHp: 60, attack: 10, range: 180, speed: DEMON_SPEED * 0.9, maxCooldown: 60, color: 0x9900ff, materialType: 2,
        passiveAbilities: [{ type: 'AREA_DOT', value: 2, range: 60 }] // 敵中心60pxに持続2ダメ
    },

    // --- Necromancer Derivations (Base: Token/Death) ---
    'necromancer_bone': { 
        maxHp: 90, attack: 20, range: 200, speed: DEMON_SPEED * 0.7, maxCooldown: 100, color: 0xffffff, materialType: 0,
        passiveAbilities: [{ type: 'PIECE_RETURN', range: 250 }] // 回収範囲拡大 250px
    },
    'necromancer_meat': { 
        maxHp: 110, attack: 5, range: 100, speed: DEMON_SPEED * 0.7, maxCooldown: 360, color: 0xff4444, materialType: 1,
        passiveAbilities: [{ type: 'SUMMON', value: 1 }] // ゾンビ召喚
    },
    'necromancer_spirit': { 
        maxHp: 70, attack: 20, range: 180, speed: DEMON_SPEED * 0.8, maxCooldown: 80, color: 0x7700cc, materialType: 2,
        passiveAbilities: [{ type: 'CORPSE_EXPLOSION', value: 30, range: 150 }] // 周囲の味方死亡時に爆発
    },

    // --- Token Units ---
    'zombie': {
        maxHp: 50, attack: 25, range: 45, speed: DEMON_SPEED * 0.6, maxCooldown: 150, color: 0x446644, materialType: 1
    },
    // ===== 英雄軍（敵）=====
    '村人': { maxHp: 20, attack: 4, range: 40, speed: 0.5, maxCooldown: 70, color: 0xddddbb },
    '農夫': { maxHp: 25, attack: 6, range: 40, speed: 0.4, maxCooldown: 60, color: 0xbbaa77 },
    '弓兵': { maxHp: 30, attack: 12, range: 180, speed: 0.6, maxCooldown: 80, color: 0xaaeeaa },
    '剣士': { maxHp: 70, attack: 18, range: 50, speed: 0.6, maxCooldown: 55, color: 0x8888ff },
    '魔法使い': { maxHp: 35, attack: 30, range: 160, speed: 0.5, maxCooldown: 100, color: 0xee88ff },
    '重騎士': { maxHp: 160, attack: 25, range: 55, speed: 0.35, maxCooldown: 70, color: 0x5566cc },
    '聖騎士': { maxHp: 300, attack: 40, range: 60, speed: 0.4, maxCooldown: 65, color: 0xffffff },
    '大魔道士': { maxHp: 80, attack: 55, range: 200, speed: 0.4, maxCooldown: 100, color: 0xcc44ff },
};
