export type Rarity = 'common' | 'rare' | 'legend';

export const RARITY_LABEL: Record<Rarity, string> = {
    common: 'コモン',
    rare:   'レア',
    legend: 'レジェンド',
};

export const RARITY_COLOR: Record<Rarity, string> = {
    common: '#aaaaaa',
    rare:   '#4488ff',
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
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // COMMON: 単色形のみ  9形状 × 3素材 = 27種
    //
    //  形一覧:
    //   I3  縦3直線     → ゴブリン（初期固定）
    //   L3  L字(3)      → スケルトン
    //   I4  縦4直線     → アーチャー
    //   O4  2×2正方形   → オーク
    //   T4  T字         → リッチ
    //   L4  Lテトロミノ → ケルベロス
    //   J4  Jテトロミノ → ゴブリン
    //   S4  Sテトロミノ → インプ
    //   Z4  Zテトロミノ → バンシー
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // ── I3: 縦3直線 ── ゴブリン（初期固定レシピ）
    {
        id: 'goblin_bone',
        name: 'スラッシャー',
        rarity: 'common',
        pattern: [
            [0], // 骨
            [0], // 骨
            [0], // 骨
        ],
        reward: 1,
    },
    {
        id: 'goblin_meat',
        name: 'ブルート',
        rarity: 'common',
        pattern: [
            [1], // 肉
            [1], // 肉
            [1], // 肉
        ],
        reward: 1,
    },
    {
        id: 'goblin_spirit',
        name: 'グレネーダー',
        rarity: 'common',
        pattern: [
            [2], // 霊
            [2], // 霊
            [2], // 霊
        ],
        reward: 1,
    },

    // ── L3: L字(3) ── スケルトン
    {
        id: 'skeleton_bone',
        name: 'ドッペル',
        rarity: 'common',
        pattern: [
            [0,  0], // 骨 骨
            [0, -1], // 骨 ·
        ],
        reward: 1,
    },
    {
        id: 'skeleton_meat',
        name: 'マルティル',
        rarity: 'common',
        pattern: [
            [1,  1], // 肉 肉
            [1, -1], // 肉 ·
        ],
        reward: 1,
    },
    {
        id: 'skeleton_spirit',
        name: 'ファントム',
        rarity: 'common',
        pattern: [
            [2,  2], // 霊 霊
            [2, -1], // 霊 ·
        ],
        reward: 1,
    },

    // ── I4: 縦4直線 ── アーチャー
    {
        id: 'archer_bone',
        name: 'スナイパー',
        rarity: 'common',
        pattern: [
            [0], // 骨
            [0], // 骨
            [0], // 骨
            [0], // 骨
        ],
        reward: 2,
    },
    {
        id: 'archer_meat',
        name: 'ガトリング',
        rarity: 'common',
        pattern: [
            [1], // 肉
            [1], // 肉
            [1], // 肉
            [1], // 肉
        ],
        reward: 2,
    },
    {
        id: 'archer_spirit',
        name: 'ピアサー',
        rarity: 'common',
        pattern: [
            [2], // 霊
            [2], // 霊
            [2], // 霊
            [2], // 霊
        ],
        reward: 2,
    },

    // ── O4: 2×2正方形 ── オーク
    {
        id: 'orc_bone',
        name: 'バリケード',
        rarity: 'common',
        pattern: [
            [0, 0], // 骨 骨
            [0, 0], // 骨 骨
        ],
        reward: 2,
    },
    {
        id: 'orc_meat',
        name: 'バーサーカー',
        rarity: 'common',
        pattern: [
            [1, 1], // 肉 肉
            [1, 1], // 肉 肉
        ],
        reward: 2,
    },
    {
        id: 'orc_spirit',
        name: 'シャーマン',
        rarity: 'common',
        pattern: [
            [2, 2], // 霊 霊
            [2, 2], // 霊 霊
        ],
        reward: 2,
    },

    // ── T4: T字 ── リッチ
    {
        id: 'lich_bone',
        name: 'リコシェット',
        rarity: 'common',
        pattern: [
            [-1, 0, -1], // ·  骨 ·
            [ 0, 0,  0], // 骨 骨 骨
        ],
        reward: 2,
    },
    {
        id: 'lich_meat',
        name: 'サングレ',
        rarity: 'common',
        pattern: [
            [-1, 1, -1], // ·  肉 ·
            [ 1, 1,  1], // 肉 肉 肉
        ],
        reward: 2,
    },
    {
        id: 'lich_spirit',
        name: 'ノヴァ',
        rarity: 'common',
        pattern: [
            [-1, 2, -1], // ·  霊 ·
            [ 2, 2,  2], // 霊 霊 霊
        ],
        reward: 2,
    },

    // ── L4: Lテトロミノ ── ケルベロス
    {
        id: 'cerberus_bone',
        name: 'ヘルハウンド',
        rarity: 'common',
        pattern: [
            [0, -1], // 骨 ·
            [0, -1], // 骨 ·
            [0,  0], // 骨 骨
        ],
        reward: 2,
    },
    {
        id: 'cerberus_meat',
        name: 'ブラッドハウンド',
        rarity: 'common',
        pattern: [
            [1, -1], // 肉 ·
            [1, -1], // 肉 ·
            [1,  1], // 肉 肉
        ],
        reward: 2,
    },
    {
        id: 'cerberus_spirit',
        name: 'ヴェノムハウンド',
        rarity: 'common',
        pattern: [
            [2, -1], // 霊 ·
            [2, -1], // 霊 ·
            [2,  2], // 霊 霊
        ],
        reward: 2,
    },

    // ── 対角3: 斜め3連 ── ウィスプ（ワイルドカード＋resultMap）
    {
        id: 'wisp',
        name: 'ウィスプ',
        rarity: 'rare',
        pattern: [
            [ 9, -1, -1], // ？ ·  ·
            [-1,  9, -1], // ·  ？ ·
            [-1, -1,  9], // ·  ·  ？
        ],
        reward: 2,
        resultMap: { 0: 'wisp_bone', 1: 'wisp_meat', 2: 'wisp_spirit' },
    },

    // ── S4: Sテトロミノ ── インプ
    {
        id: 'imp_bone',
        name: 'テイカー',
        rarity: 'common',
        pattern: [
            [-1, 0, 0], // ·  骨 骨
            [ 0, 0, -1], // 骨 骨 ·
        ],
        reward: 2,
    },
    {
        id: 'imp_meat',
        name: 'ドクター',
        rarity: 'common',
        pattern: [
            [-1, 1, 1], // ·  肉 肉
            [ 1, 1, -1], // 肉 肉 ·
        ],
        reward: 2,
    },
    {
        id: 'imp_spirit',
        name: 'ネクロ',
        rarity: 'common',
        pattern: [
            [-1, 2, 2], // ·  霊 霊
            [ 2, 2, -1], // 霊 霊 ·
        ],
        reward: 2,
    },

    // ── Z4: Zテトロミノ ── バンシー
    {
        id: 'banshee_bone',
        name: 'スクリーム',
        rarity: 'common',
        pattern: [
            [ 0, 0, -1], // 骨 骨 ·
            [-1, 0,  0], // ·  骨 骨
        ],
        reward: 2,
    },
    {
        id: 'banshee_meat',
        name: 'ミラー',
        rarity: 'common',
        pattern: [
            [ 1, 1, -1], // 肉 肉 ·
            [-1, 1,  1], // ·  肉 肉
        ],
        reward: 2,
    },
    {
        id: 'banshee_spirit',
        name: 'ハンター',
        rarity: 'common',
        pattern: [
            [ 2, 2, -1], // 霊 霊 ·
            [-1, 2,  2], // ·  霊 霊
        ],
        reward: 2,
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RARE: ワイルドあり (❓でバリアント決定)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    {
        id: 'necromancer',
        name: 'ネクロマンサー',
        rarity: 'rare',
        pattern: [
            [ 2, 9,  2], // 霊 ❓ 霊
            [-1, 0, -1], // ·  骨 ·
            [-1, 0, -1], // ·  骨 ·
        ],
        reward: 4,
        resultMap: {
            0: 'necromancer_bone',
            1: 'necromancer_meat',
            2: 'necromancer_spirit',
        }
    },
    {
        id: 'minotaur',
        name: 'ミノタウロス',
        rarity: 'rare',
        pattern: [
            [-1, 1, 0,  0], // ·  肉 骨 骨
            [ 1, 9, -1, -1], // 肉 ❓ ·  ·
        ],
        reward: 3,
        resultMap: {
            0: 'minotaur_bone',
            1: 'minotaur_meat',
            2: 'minotaur_spirit',
        }
    },
    {
        id: 'ghoul',
        name: 'グール',
        rarity: 'rare',
        pattern: [
            [-1, 1, -1], // ·  肉 ·
            [ 2, 9,  1], // 霊 ❓ 肉
            [-1, 2, -1], // ·  霊 ·
        ],
        reward: 3,
        resultMap: {
            0: 'ghoul_bone',
            1: 'ghoul_meat',
            2: 'ghoul_spirit',
        }
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

// レシピIDごとの絵文字
export const RECIPE_EMOJIS: Record<string, string> = {
    // コモン
    skeleton_bone:   '💀',
    skeleton_meat:   '💀',
    skeleton_spirit: '💀',
    orc_bone:        '👹',
    orc_meat:        '👹',
    orc_spirit:      '👹',
    archer_bone:     '🏹',
    archer_meat:     '🏹',
    archer_spirit:   '🏹',
    cerberus_bone:   '🐕',
    cerberus_meat:   '🐕',
    cerberus_spirit: '🐕',
    lich_bone:       '🧙',
    lich_meat:       '🧙',
    lich_spirit:     '🧙',
    wisp:            '✨',
    wisp_bone:       '✨',
    wisp_meat:       '✨',
    wisp_spirit:     '✨',
    goblin_bone:     '👺',
    goblin_meat:     '👺',
    goblin_spirit:   '👺',
    imp_bone:        '😈',
    imp_meat:        '😈',
    imp_spirit:      '😈',
    banshee_bone:    '👻',
    banshee_meat:    '👻',
    banshee_spirit:  '👻',
    // レア
    necromancer: '🧟',
    minotaur:    '🐂',
    ghoul:       '👾',
};

// レアユニットのバリアント表示名
export const RARE_VARIANT_NAMES: Record<string, string> = {
    necromancer_bone:   'デスサモナー',
    necromancer_meat:   'デスウィッチ',
    necromancer_spirit: 'ソウルリーパー',
    minotaur_bone:      'ゴアホーン',
    minotaur_meat:      'バルワーク',
    minotaur_spirit:    'サンダーホーフ',
    ghoul_bone:         'フィニッシャー',
    ghoul_meat:         'ハングリーグール',
    ghoul_spirit:       'シャドウグール',
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
    { id: 'mana_prism',        name: 'マナの水晶',        rarity: 'rare',  description: '自拠点の最大HPが半分になる代わりに、強力な魔法効果を得る。',       price: 60,  icon: '💎' },
    { id: 'necromancer_guide', name: '死霊術師の手引き',  rarity: 'rare',  description: '敵ユニット撃破時25%の確率でスケルトンが召喚される。',               price: 100, icon: '📖' },
];
