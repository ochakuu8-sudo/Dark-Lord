import React from 'react';

interface UnitSpriteProps {
    unitId: string;
    width?: number;
    height?: number;
}

// ===== スケルトン SVG =====

const SKEL_THEME = {
    bone: {
        fill: '#f5f5ee',
        stroke: '#444444',
        eyeFill: '#444444',
        filter: undefined as string | undefined,
    },
    meat: {
        fill: '#ffe8dc',
        stroke: '#7a3a2a',
        eyeFill: '#7a3a2a',
        filter: undefined as string | undefined,
    },
    spirit: {
        fill: '#dde0ff',
        stroke: '#5555cc',
        eyeFill: '#5555cc',
        filter: 'url(#spirit-glow)',
    },
} as const;

type SkelMat = keyof typeof SKEL_THEME;

const SkeletonSVG: React.FC<{ mat: SkelMat; width: number; height: number }> = ({ mat, width, height }) => {
    const t = SKEL_THEME[mat];
    const sw = t.stroke;
    const fill = t.fill;
    const eye = t.eyeFill;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 100 100"
            width={width}
            height={height}
            style={{ display: 'block' }}
        >
            <defs>
                <filter id="drop-shadow">
                    <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#00000033" />
                </filter>
                {mat === 'spirit' && (
                    <filter id="spirit-glow">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#8888ff" floodOpacity="0.7" />
                    </filter>
                )}
            </defs>

            <g filter={t.filter ?? 'url(#drop-shadow)'}>
                {/* 頭蓋骨 */}
                <ellipse cx="50" cy="30" rx="18" ry="16" fill={fill} stroke={sw} strokeWidth="2" />

                {/* 目のくぼみ */}
                <ellipse cx="43" cy="28" rx="4" ry="5" fill={eye} />
                <ellipse cx="57" cy="28" rx="4" ry="5" fill={eye} />

                {/* 鼻の穴 */}
                <polygon points="50,33 48,36 52,36" fill={eye} />

                {/* 歯・顎 */}
                <ellipse cx="50" cy="40" rx="6" ry="1" fill={eye} />
                <ellipse cx="50" cy="40" rx="0.5" ry="3" fill={eye} />
                <ellipse cx="47" cy="40" rx="0.5" ry="3" fill={eye} />
                <ellipse cx="53" cy="40" rx="0.5" ry="3" fill={eye} />

                {/* 背骨・肋骨 */}
                <path
                    d="M50 46 V65 M45 50 Q50 48 55 50 M44 55 Q50 53 56 55 M46 60 Q50 58 54 60"
                    fill="none" stroke={sw} strokeWidth="3" strokeLinecap="round"
                />

                {/* 骨盤 */}
                <ellipse cx="50" cy="65" rx="10" ry="5" fill={fill} stroke={sw} strokeWidth="2" />

                {/* 腕 左 */}
                <path d="M42 48 L35 55 L38 62" fill="none" stroke={sw} strokeWidth="3" strokeLinecap="round" />
                {/* 腕 右 */}
                <path d="M58 48 L65 55 L62 62" fill="none" stroke={sw} strokeWidth="3" strokeLinecap="round" />

                {/* 脚 左 */}
                <path d="M45 68 L42 78 L45 88" fill="none" stroke={sw} strokeWidth="3" strokeLinecap="round" />
                {/* 脚 右 */}
                <path d="M55 68 L58 78 L55 88" fill="none" stroke={sw} strokeWidth="3" strokeLinecap="round" />

                {/* 肉バリアント: ほっぺの赤み */}
                {mat === 'meat' && <>
                    <ellipse cx="36" cy="31" rx="4" ry="2.5" fill="rgba(255,120,100,0.35)" />
                    <ellipse cx="64" cy="31" rx="4" ry="2.5" fill="rgba(255,120,100,0.35)" />
                </>}

                {/* 霊バリアント: 目の光 */}
                {mat === 'spirit' && <>
                    <ellipse cx="43" cy="28" rx="2.5" ry="3" fill="rgba(150,160,255,0.7)" />
                    <ellipse cx="57" cy="28" rx="2.5" ry="3" fill="rgba(150,160,255,0.7)" />
                </>}
            </g>
        </svg>
    );
};

// ━━━ 外部公開コンポーネント ━━━
const UnitSprite: React.FC<UnitSpriteProps> = ({ unitId, width = 64, height = 64 }) => {
    if (unitId.startsWith('skeleton_')) {
        const mat: SkelMat = unitId.endsWith('_meat') ? 'meat' : unitId.endsWith('_spirit') ? 'spirit' : 'bone';
        return <SkeletonSVG mat={mat} width={width} height={height} />;
    }
    return null;
};

export default UnitSprite;
