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

// 自軍ユニットの移動速度は一律 0.8 に設定
const DEMON_SPEED = 0.8;

export const UNIT_STATS: Record<string, Partial<EntityState>> = {
    // --- Orc Derivations (Base: Melee) ---
    'orc_bone': { 
        maxHp: 2000, attack: 50, range: 45, speed: DEMON_SPEED, maxCooldown: 60, color: 0xcccccc, materialType: 0,
        passiveAbilities: [{ type: 'REFLECT', value: 0.6 }] // 60% 反射
    },
    'orc_meat': { 
        maxHp: 1250, attack: 75, range: 45, speed: DEMON_SPEED, maxCooldown: 70, color: 0xff6666, materialType: 1
    },
    'orc_spirit': { 
        maxHp: 700, attack: 60, range: 45, speed: DEMON_SPEED * 1.2, maxCooldown: 50, color: 0xaa66ff, materialType: 2,
        passiveAbilities: [{ type: 'AURA_REGEN', value: 5, range: 100 }] // 周囲100pxに毎秒5回復
    },

    // --- Skeleton Derivations (Base: Ranged) ---
    'skeleton_bone': { 
        maxHp: 200, attack: 160, range: 350, speed: DEMON_SPEED, maxCooldown: 50, color: 0xdddddd, materialType: 0
    },
    'skeleton_meat': { 
        maxHp: 350, attack: 210, range: 120, speed: DEMON_SPEED * 0.9, maxCooldown: 22, color: 0xff9999, materialType: 1
    },
    'skeleton_spirit': { 
        maxHp: 150, attack: 70, range: 200, speed: DEMON_SPEED, maxCooldown: 70, color: 0xcc88ff, materialType: 2,
        passiveAbilities: [{ type: 'PIERCING', value: 600 }] // 600px 飛ぶ貫通弾
    },

    // --- Wizard Derivations (Base: Support/Magic) ---
    'wizard_bone': { 
        maxHp: 400, attack: 0, range: 160, speed: DEMON_SPEED * 0.8, maxCooldown: 60, color: 0xeeeeee, materialType: 0,
        passiveAbilities: [{ type: 'ATK_BUFF', value: 0.2, range: 120 }] // 周囲の味方のATK 1.2倍
    },
    'wizard_meat': { 
        maxHp: 500, attack: 150, range: 200, speed: DEMON_SPEED * 0.8, maxCooldown: 120, color: 0xffcccc, materialType: 1,
        passiveAbilities: [{ type: 'HEAL_SHOT' }] // 最低HPの味方を撃つ
    },
    'wizard_spirit': { 
        maxHp: 300, attack: 50, range: 180, speed: DEMON_SPEED * 0.9, maxCooldown: 100, color: 0x9900ff, materialType: 2,
        passiveAbilities: [{ type: 'AREA_DOT', value: 0.2, range: 60 }] // 攻撃力50 * 0.2 = 10ダメ (5倍)
    },

    // --- Necromancer Derivations (Base: Token/Death) ---
    'necromancer_bone': { 
        maxHp: 450, attack: 100, range: 200, speed: DEMON_SPEED * 0.7, maxCooldown: 100, color: 0xffffff, materialType: 0,
        passiveAbilities: [{ type: 'PIECE_RETURN', range: 250 }] // 回収範囲拡大 250px
    },
    'necromancer_meat': { 
        maxHp: 550, attack: 25, range: 100, speed: DEMON_SPEED * 0.7, maxCooldown: 360, color: 0xff4444, materialType: 1,
        passiveAbilities: [{ type: 'SUMMON', value: 1 }] // ゾンビ召喚
    },
    'necromancer_spirit': { 
        maxHp: 350, attack: 100, range: 180, speed: DEMON_SPEED * 0.8, maxCooldown: 80, color: 0x7700cc, materialType: 2,
        passiveAbilities: [{ type: 'CORPSE_EXPLOSION', value: 1.5, range: 150 }] // 攻撃力100 * 1.5 = 150ダメ (5倍)
    },

    // --- Token Units ---
    'zombie': {
        maxHp: 250, attack: 125, range: 45, speed: DEMON_SPEED * 0.6, maxCooldown: 150, color: 0x446644, materialType: 1
    },
    // ===== 英雄軍（敵）=====
    '村人': { maxHp: 300, attack: 20, range: 40, speed: 1.1, maxCooldown: 70, color: 0xddddbb },
    '農夫': { maxHp: 400, attack: 30, range: 40, speed: 1.0, maxCooldown: 60, color: 0xbbaa77 },
    '弓兵': { maxHp: 450, attack: 60, range: 180, speed: 1.2, maxCooldown: 80, color: 0xaaeeaa },
    '剣士': { maxHp: 1000, attack: 90, range: 50, speed: 1.3, maxCooldown: 55, color: 0x8888ff },
    'シーフ': { maxHp: 500, attack: 50, range: 30, speed: 2.2, maxCooldown: 40, color: 0x444444 },
    '魔法使い': { maxHp: 550, attack: 150, range: 160, speed: 1.1, maxCooldown: 100, color: 0xee88ff },
    '重騎士': { maxHp: 2250, attack: 125, range: 55, speed: 0.9, maxCooldown: 70, color: 0x5566cc },
    'プリースト': { maxHp: 750, attack: -150, range: 150, speed: 0.9, maxCooldown: 90, color: 0xffccff },
    '聖騎士': { maxHp: 4000, attack: 200, range: 60, speed: 0.9, maxCooldown: 65, color: 0xffffff },
    'パラディン': { maxHp: 6000, attack: 100, range: 55, speed: 0.7, maxCooldown: 80, color: 0xffdd44 },
    '大魔道士': { maxHp: 1500, attack: 275, range: 200, speed: 0.9, maxCooldown: 100, color: 0xcc44ff },
    '勇者': { maxHp: 25000, attack: 325, range: 65, speed: 1.2, maxCooldown: 50, color: 0xff2222 },
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
    'SUMMON': '一定時間ごとにゾンビを召喚し続ける。',
    'CORPSE_EXPLOSION': '近くの味方の死を糧に爆発を引き起こす。',
};
