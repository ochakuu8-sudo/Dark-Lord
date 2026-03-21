export interface Recipe {
    id: string;      // 形状としてのID（例: 'melee', 'tank'）
    name: string;    // ロール名
    pattern: number[][]; // 0: 骨, 1: 肉, 2: 霊, 9: 変動スロット
    reward: number;  // 基本報酬AP
    resultMap?: Record<number, string>; // 変動スロットに入ったピース(0|1|2)に対応するユニットID
}

export interface FusionRecipe {
    id: string;
    name: string;
    pattern: string[][];
}

// Colors: 0=赤(Fire), 1=青(Water), 2=緑(Earth), 3=黄(Light), 4=紫(Dark)

// 形ごとにロール（Melee=縦3, Tank=2x2, Ranged=横3, Magic=十字）を設定し、各色に用意する
export const AP_GAUGE_MAX = 100;
export const AP_GAUGE_PER_MATCH = 20; // 1マッチあたりのゲージ増加量（5マッチ=1AP）

export const ALL_RECIPES: Recipe[] = [
    {
        id: 'goblin',
        name: 'ゴブリン',
        pattern: [
            [9, 9, 9] // 同種3マス（どの素材でも可）
        ],
        reward: 0,
        resultMap: {
            0: 'goblin_bone',
            1: 'goblin_meat',
            2: 'goblin_spirit',
        }
    },
    {
        id: 'orc',
        name: 'オーク',
        pattern: [
            [1, 1], // 肉 肉
            [1, 9]  // 肉 X
        ],
        reward: 1,
        resultMap: {
            0: 'orc_bone',   // 肉肉肉骨
            1: 'orc_meat',   // 肉肉肉肉
            2: 'orc_spirit', // 肉肉肉霊
        }
    },
    {
        id: 'skeleton',
        name: 'スケルトン',
        pattern: [
            [0], // 骨
            [0], // 骨
            [0], // 骨
            [9]  // X
        ],
        reward: 2,
        resultMap: {
            0: 'skeleton_bone',
            1: 'skeleton_meat',
            2: 'skeleton_spirit',
        }
    },
    {
        id: 'wizard',
        name: 'ウィザード',
        pattern: [
            [-1, 2, -1], //   霊
            [ 2, 9,  2], // 霊 X 霊
            [-1, 2, -1], //   霊
        ],
        reward: 3,
        resultMap: {
            0: 'wizard_bone',
            1: 'wizard_meat',
            2: 'wizard_spirit',
        }
    },
    {
        id: 'necromancer',
        name: 'ネクロマンサー',
        pattern: [
            [ 2, 9,  2], // 霊 X 霊
            [-1, 0, -1], //   骨
            [-1, 0, -1], //   骨
        ],
        reward: 4,
        resultMap: {
            0: 'necromancer_bone',
            1: 'necromancer_meat',
            2: 'necromancer_spirit',
        }
    }
];

export const INITIAL_RECIPES: Recipe[] = [
    ALL_RECIPES[0], // orc
    ALL_RECIPES[1], // skeleton
    ALL_RECIPES[2], // wizard
    ALL_RECIPES[3], // necromancer
];
export const FUSION_RECIPES: FusionRecipe[] = [
    // ===== Tier 1: 同種配合 (5体) =====
    {
        id: 'hobgoblin',
        name: 'ホブゴブリン',
        pattern: [['goblin', 'goblin']]
    },
    {
        id: 'king_slime',
        name: 'キングスライム',
        pattern: [['slime', 'slime']]
    },
    {
        id: 'bone_warrior',
        name: 'ボーンウォーリアー',
        pattern: [['skeleton', 'skeleton']]
    },
    {
        id: 'demolisher',
        name: 'デモリッシャー',
        pattern: [['bomber', 'bomber']]
    },
    {
        id: 'arch_imp',
        name: 'アーチインプ',
        pattern: [['imp', 'imp']]
    },

    // ===== Tier 2: 異種配合 (10体) =====
    // goblin系
    {
        id: 'orc_warrior',
        name: 'オーク戦士',
        pattern: [['goblin', 'slime']]
    },
    {
        id: 'death_stalker',
        name: 'デスストーカー',
        pattern: [['goblin', 'skeleton']]
    },
    {
        id: 'suicide_squad',
        name: '特攻隊',
        pattern: [['goblin', 'bomber']]
    },
    {
        id: 'battle_shaman',
        name: '戦闘シャーマン',
        pattern: [['goblin', 'imp']]
    },
    // slime系
    {
        id: 'plague_slime',
        name: '疫病スライム',
        pattern: [['slime', 'skeleton']]
    },
    {
        id: 'toxic_bomb',
        name: 'トキシックボム',
        pattern: [['slime', 'bomber']]
    },
    {
        id: 'spirit_vessel',
        name: '霊魂の器',
        pattern: [['slime', 'imp']]
    },
    // skeleton系
    {
        id: 'cursed_knight',
        name: '呪われた騎士',
        pattern: [['skeleton', 'bomber']]
    },
    {
        id: 'soul_archer',
        name: 'ソウルアーチャー',
        pattern: [['skeleton', 'imp']]
    },
    // bomber系
    {
        id: 'chaos_imp',
        name: 'カオスインプ',
        pattern: [['bomber', 'imp']]
    },

    // ===== Tier 3: 配合体同士 (3体) =====
    {
        id: 'demon_general',
        name: '魔将軍',
        pattern: [['hobgoblin', 'orc_warrior']]
    },
    {
        id: 'death_cannon',
        name: '死の砲台',
        pattern: [['bone_warrior', 'plague_slime']]
    },
    {
        id: 'armageddon',
        name: 'アルマゲドン',
        pattern: [['demolisher', 'suicide_squad']]
    },
];

export const COLORS = [
    0xdddddd, // 0: Bone (White)
    0xcc4444, // 1: Meat (Red)
    0x8844ff, // 2: Spirit (Purple)
];

export const COLOR_HEX = [
    '#dddddd',
    '#cc4444',
    '#8844ff',
];

export const PIECE_EMOJIS: Record<number, string> = {
    0: '🦴',
    1: '🥩',
    2: '🔮',
    9: '❓',
};

export const ROWS = 7;
export const COLS = 7;
export const BLOCK_SIZE = 70; // 7x7盤面に合わせてブロックサイズを調整 (7x70 = 490px)
export const BOARD_WIDTH = COLS * BLOCK_SIZE;
export const BOARD_HEIGHT = ROWS * BLOCK_SIZE;
export const MAX_AP = 10;
export const AP_PER_DAY = 0; // AP is earned through summon combos only

export interface Relic {
    id: string;
    name: string;
    description: string;
    price: number;
    icon: string;
}

export const RELICS: Relic[] = [
    { id: 'giant_heart', name: '巨人の心臓', description: '全魔物のHPが2倍になる。ただし移動速度が30%低下する。', price: 150, icon: '❤️' },
    { id: 'fire_crown', name: '炎の王冠', description: '赤系ユニットの攻撃力が1.5倍になる。それ以外は0.8倍になる。', price: 150, icon: '👑' },
    { id: 'mana_prism', name: 'マナの水晶', description: '自拠点の最大HPが半分になる代わりに、強力な魔法効果を得る。', price: 100, icon: '💎' },
];
