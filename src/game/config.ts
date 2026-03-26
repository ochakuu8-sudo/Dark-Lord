export type Rarity = 'common' | 'rare' | 'epic' | 'legend';

export const RARITY_LABEL: Record<Rarity, string> = {
    common: 'コモン',
    rare:   'レア',
    epic:   'エピック',
    legend: 'レジェンド',
};

export const RARITY_COLOR: Record<Rarity, string> = {
    common: '#aaaaaa',
    rare:   '#4488ff',
    epic:   '#aa44ff',
    legend: '#ffaa00',
};

export interface Recipe {
    id: string;      // 形状としてのID（例: 'melee', 'tank'）
    name: string;    // ロール名
    pattern: number[][]; // 0: 骨, 1: 肉, 2: 霊, 9: 変動スロット
    reward: number;  // 基本報酬AP
    rarity: Rarity;
    resultMap?: Record<number, string>; // 変動スロットに入ったピース(0|1|2)に対応するユニットID
}


// Colors: 0=赤(Fire), 1=青(Water), 2=緑(Earth), 3=黄(Light), 4=紫(Dark)

// 形ごとにロール（Melee=縦3, Tank=2x2, Ranged=横3, Magic=十字）を設定し、各色に用意する

export const ALL_RECIPES: Recipe[] = [
    {
        id: 'orc',
        name: 'オーク',
        rarity: 'common',
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
        rarity: 'common',
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
        rarity: 'rare',
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
        rarity: 'epic',
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
    },
    {
        id: 'gargoyle',
        name: 'ガーゴイル',
        rarity: 'common',
        pattern: [
            [0, -1], // 骨 ·
            [9,  0], // X  骨
        ],
        reward: 1,
        resultMap: {
            0: 'gargoyle_bone',
            1: 'gargoyle_meat',
            2: 'gargoyle_spirit',
        }
    },
    {
        id: 'cerberus',
        name: 'ケルベロス',
        rarity: 'common',
        pattern: [
            [1, 9, 1], // 肉 X 肉
        ],
        reward: 1,
        resultMap: {
            0: 'cerberus_bone',
            1: 'cerberus_meat',
            2: 'cerberus_spirit',
        }
    },
    {
        id: 'wraith',
        name: 'レイス',
        rarity: 'rare',
        pattern: [
            [2, -1], // 霊 ·
            [2,  9], // 霊 X
            [2, -1], // 霊 ·
        ],
        reward: 2,
        resultMap: {
            0: 'wraith_bone',
            1: 'wraith_meat',
            2: 'wraith_spirit',
        }
    },
    {
        id: 'wisp',
        name: 'ウィスプ',
        rarity: 'common',
        pattern: [
            [ 2, -1, -1], // 霊 .  .
            [-1,  9, -1], //  . X  .
            [-1, -1,  2], //  . .  霊
        ],
        reward: 2,
        resultMap: {
            0: 'wisp_bone',
            1: 'wisp_meat',
            2: 'wisp_spirit',
        }
    }
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

// レシピIDごとの絵文字
export const RECIPE_EMOJIS: Record<string, string> = {
    goblin:      '👺',
    orc:         '👹',
    skeleton:    '💀',
    wizard:      '🧙',
    necromancer: '🧟',
};

// ワイルドカード素材ごとのピース背景色 (0x形式)
export const MATERIAL_BG_COLORS: Record<string, number> = {
    bone:   0x2a2a3a, // 骨: 青白みかかった暗め
    meat:   0x3a1010, // 肉: 暗い赤
    spirit: 0x1a0a2e, // 霊: 濃い紫
};

export const ROWS = 9;
export const COLS = 9;
export const ENEMY_COLS = 9; // 敵陣の列数
export const BLOCK_SIZE = 54; // 9x9盤面 (9x54 = 486px)
export const BOARD_WIDTH = COLS * BLOCK_SIZE;
export const ENEMY_BOARD_WIDTH = ENEMY_COLS * BLOCK_SIZE;
export const BOARD_HEIGHT = ROWS * BLOCK_SIZE;
export const MAX_AP = 500; // ソウルの上限
export const AP_PER_DAY = 30; // day開始時のソウル配布

export interface Relic {
    id: string;
    name: string;
    description: string;
    price: number;
    icon: string;
    rarity: Rarity;
}

export const RELICS: Relic[] = [
    { id: 'giant_heart',       name: '巨人の心臓',       rarity: 'rare',  description: '全魔物のHPが2倍になる。ただし移動速度が30%低下する。',           price: 80,  icon: '❤️' },
    { id: 'fire_crown',        name: '炎の王冠',          rarity: 'rare',  description: '赤系ユニットの攻撃力が1.5倍になる。それ以外は0.8倍になる。',       price: 80,  icon: '👑' },
    { id: 'mana_prism',        name: 'マナの水晶',        rarity: 'epic',  description: '自拠点の最大HPが半分になる代わりに、強力な魔法効果を得る。',       price: 60,  icon: '💎' },
    { id: 'necromancer_guide', name: '死霊術師の手引き',  rarity: 'epic',  description: '敵ユニット撃破時25%の確率でスケルトンが召喚される。',               price: 100, icon: '📖' },
];
