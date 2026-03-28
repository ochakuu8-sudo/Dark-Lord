import React from 'react';

interface UnitSpriteProps {
    unitId: string;
    width?: number;
    height?: number;
}

// ===== スケルトン デフォルメ SVG =====

const SKEL_C = {
    bone: {
        skull: '#E8E0C8', skullStroke: '#AFA898',
        body: '#DDD8C0', limbs: '#C8C0A8',
        eye: '#08080f', highlight: 'rgba(255,255,255,0.35)',
        glow: null, blush: null,
    },
    meat: {
        skull: '#EDCFBF', skullStroke: '#BBA090',
        body: '#E0C0B0', limbs: '#CEB0A0',
        eye: '#08080f', highlight: 'rgba(255,210,195,0.45)',
        glow: null, blush: 'rgba(255,120,100,0.30)',
    },
    spirit: {
        skull: '#C0CCFF', skullStroke: '#8090CC',
        body: '#B0BCEE', limbs: '#98A8D8',
        eye: '#10083a', highlight: 'rgba(180,200,255,0.55)',
        glow: 'rgba(110,130,255,0.18)', blush: null,
    },
} as const;

type SkelMat = keyof typeof SKEL_C;

const SkeletonSVG: React.FC<{ mat: SkelMat; width: number; height: number }> = ({ mat, width, height }) => {
    const c = SKEL_C[mat];
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 44 60"
            width={width}
            height={height}
            style={{ display: 'block' }}
        >
            {/* ドロップシャドウ */}
            <ellipse cx="22" cy="57.5" rx="10" ry="2.8" fill="rgba(0,0,0,0.22)" />

            {/* 霊バリアント: オーラ */}
            {c.glow && <circle cx="22" cy="16" r="17" fill={c.glow} />}

            {/* ━━━ 頭蓋骨 ━━━ */}
            <circle cx="22" cy="16" r="14" fill={c.skull} stroke={c.skullStroke} strokeWidth="1.1" />

            {/* ほっぺの赤み (肉バリアント) */}
            {c.blush && <>
                <ellipse cx="12" cy="20" rx="4" ry="2.2" fill={c.blush} />
                <ellipse cx="32" cy="20" rx="4" ry="2.2" fill={c.blush} />
            </>}

            {/* 目のくぼみ (大きめでキュート) */}
            <ellipse cx="15.5" cy="15" rx="5" ry="6" fill={c.eye} />
            <ellipse cx="28.5" cy="15" rx="5" ry="6" fill={c.eye} />

            {/* 目のハイライト */}
            <circle cx="17" cy="12.5" r="1.6" fill={c.highlight} />
            <circle cx="30" cy="12.5" r="1.6" fill={c.highlight} />

            {/* 霊バリアント: 目の光 */}
            {mat === 'spirit' && <>
                <ellipse cx="15.5" cy="15" rx="3.2" ry="3.8" fill="rgba(100,130,255,0.55)" />
                <ellipse cx="28.5" cy="15" rx="3.2" ry="3.8" fill="rgba(100,130,255,0.55)" />
            </>}

            {/* 鼻の穴 */}
            <ellipse cx="20.5" cy="22.5" rx="1.4" ry="1.1" fill={c.eye} />
            <ellipse cx="23.5" cy="22.5" rx="1.4" ry="1.1" fill={c.eye} />

            {/* 顎・歯 */}
            <rect x="13.5" y="26" width="17" height="5.5" rx="2.5" fill={c.body} stroke={c.skullStroke} strokeWidth="0.9" />
            <line x1="17.5" y1="26" x2="17.5" y2="31.5" stroke={c.skullStroke} strokeWidth="0.9" />
            <line x1="22"   y1="26" x2="22"   y2="31.5" stroke={c.skullStroke} strokeWidth="0.9" />
            <line x1="26.5" y1="26" x2="26.5" y2="31.5" stroke={c.skullStroke} strokeWidth="0.9" />

            {/* ━━━ 胴体 (肋骨) ━━━ */}
            <rect x="15" y="31.5" width="14" height="12" rx="4" fill={c.body} stroke={c.skullStroke} strokeWidth="0.9" />

            {/* 肋骨のカーブ */}
            <path d="M15 36 Q11.5 36 11 39 Q11.5 41 15 40.5" fill="none" stroke={c.skullStroke} strokeWidth="1.2" />
            <path d="M29 36 Q32.5 36 33 39 Q32.5 41 29 40.5" fill="none" stroke={c.skullStroke} strokeWidth="1.2" />

            {/* 背骨 (点線) */}
            <line x1="22" y1="31.5" x2="22" y2="43.5" stroke={c.skullStroke} strokeWidth="0.7" strokeDasharray="1.8,1.8" />

            {/* 肉バリアント: 肉のパッチ */}
            {mat === 'meat' && <>
                <ellipse cx="19" cy="35" rx="2.5" ry="1.8" fill="rgba(255,150,130,0.38)" />
                <ellipse cx="25" cy="39" rx="2" ry="1.5" fill="rgba(255,140,120,0.30)" />
            </>}

            {/* ━━━ 腕 ━━━ */}
            <line x1="15" y1="33.5" x2="6.5" y2="43" stroke={c.limbs} strokeWidth="3" strokeLinecap="round" />
            <circle cx="6.5" cy="43" r="3" fill={c.limbs} stroke={c.skullStroke} strokeWidth="0.7" />

            <line x1="29" y1="33.5" x2="37.5" y2="43" stroke={c.limbs} strokeWidth="3" strokeLinecap="round" />
            <circle cx="37.5" cy="43" r="3" fill={c.limbs} stroke={c.skullStroke} strokeWidth="0.7" />

            {/* ━━━ 脚 ━━━ */}
            <line x1="19" y1="43.5" x2="17" y2="53.5" stroke={c.limbs} strokeWidth="3" strokeLinecap="round" />
            <line x1="25" y1="43.5" x2="27" y2="53.5" stroke={c.limbs} strokeWidth="3" strokeLinecap="round" />

            {/* 足先 */}
            <ellipse cx="16" cy="54" rx="4.5" ry="2.4" fill={c.limbs} stroke={c.skullStroke} strokeWidth="0.7" />
            <ellipse cx="28" cy="54" rx="4.5" ry="2.4" fill={c.limbs} stroke={c.skullStroke} strokeWidth="0.7" />
        </svg>
    );
};

// ━━━ 外部公開コンポーネント ━━━
const UnitSprite: React.FC<UnitSpriteProps> = ({ unitId, width = 64, height = 80 }) => {
    if (unitId.startsWith('skeleton_')) {
        const mat: SkelMat = unitId.endsWith('_meat') ? 'meat' : unitId.endsWith('_spirit') ? 'spirit' : 'bone';
        return <SkeletonSVG mat={mat} width={width} height={height} />;
    }
    // 他ユニットは将来実装
    return null;
};

export default UnitSprite;
