export interface Recipe {
    id: string;      // 形状としてのID（例: 'melee', 'tank'）
    name: string;    // ロール名
    pattern: number[][]; // 0: 骨, 1: 肉, 2: 霊, 9: 変動スロット
    reward: number;  // 基本報酬AP
    resultMap?: Record<number, string>; // 変動スロットに入ったピース(0|1|2)に対応するユニットID
}


// Colors: 0=赤(Fire), 1=青(Water), 2=緑(Earth), 3=黄(Light), 4=紫(Dark)

// 形ごとにロール（Melee=縦3, Tank=2x2, Ranged=横3, Magic=十字）を設定し、各色に用意する
export const AP_GAUGE_MAX = 100;
export const AP_GAUGE_PER_MATCH = 20; // 1マッチあたりのゲージ増加量（5マッチ=1AP）

export const ALL_RECIPES: Recipe[] = [
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
