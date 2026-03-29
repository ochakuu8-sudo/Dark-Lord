import React, { useState } from 'react';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import {
    ALL_RECIPES, RELICS, COLOR_HEX, PIECE_EMOJIS,
    RARITY_COLOR, RARITY_LABEL, RARE_VARIANT_NAMES,
    type Recipe,
} from '../game/config';

// ── 素材テーマカラー ──────────────────────────────────────
const MAT: Record<number, { label: string; emoji: string; fg: string; border: string; glow: string; bg: string }> = {
    0: { label: '骨', emoji: '🦴', fg: '#cccccc', border: '#666688', glow: '#aaaacc', bg: '#0e0e1a' },
    1: { label: '肉', emoji: '🥩', fg: '#ff9999', border: '#aa3333', glow: '#ff6666', bg: '#160808' },
    2: { label: '霊', emoji: '🔮', fg: '#cc88ff', border: '#7733cc', glow: '#aa66ff', bg: '#0c0616' },
};

// ── モンスターファミリー定義 ──────────────────────────────
const FAMILIES = [
    { id: 'skeleton', label: 'スケルトン', icon: '💀', desc: '射程を持つ不死の骸骨兵士' },
    { id: 'orc',      label: 'オーク',     icon: '👹', desc: '前方を薙ぎ払う鬼族前衛' },
    { id: 'archer',   label: 'アーチャー', icon: '🏹', desc: '遠距離に特化した弓の使い手' },
    { id: 'cerberus', label: 'ケルベロス', icon: '🐕', desc: '噛みつきと毒を持つ冥界の猟犬' },
    { id: 'lich',     label: 'リッチ',     icon: '🧙', desc: '多彩な魔法攻撃を操る不死術師' },
    { id: 'wisp',     label: 'ウィスプ',   icon: '✨', desc: '高速突撃する爆発霊体' },
];

const HERO_IDS = ['村人', '農夫', '弓兵', '剣士', '魔法使い', '重騎士', 'プリースト', '聖騎士', 'パラディン', '大魔道士', '勇者'];

// ── レシピパターンプレビュー ──────────────────────────────
const PatternGrid: React.FC<{ pattern: number[][]; sz?: number }> = ({ pattern, sz = 18 }) => (
    <div style={{
        display: 'grid', gap: 2,
        gridTemplateColumns: `repeat(${pattern[0]?.length || 1}, ${sz}px)`,
        flexShrink: 0,
    }}>
        {pattern.map((row, ri) => row.map((val, ci) => (
            <div key={`${ri}-${ci}`} style={{
                width: sz, height: sz, borderRadius: 3,
                background: val === -1 ? 'transparent' : val === 9 ? '#2a1a3a' : COLOR_HEX[val] ?? '#333',
                border: val >= 0 ? '1px solid rgba(255,255,255,0.12)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: sz * 0.52,
            }}>
                {val === 9 ? '?' : val >= 0 ? PIECE_EMOJIS[val] : ''}
            </div>
        )))}
    </div>
);

// ── コモンユニットカード ──────────────────────────────────
const UnitCard: React.FC<{ recipe: Recipe; unitId: string; matIdx: number }> = ({ recipe, unitId, matIdx }) => {
    const [hov, setHov] = useState(false);
    const stats = UNIT_STATS[unitId];
    const mat = MAT[matIdx];
    if (!stats) return null;

    return (
        <div
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                background: hov ? '#111128' : mat.bg,
                border: `1px solid ${hov ? mat.border : mat.border + '55'}`,
                borderTop: `3px solid ${hov ? mat.glow : mat.border + 'aa'}`,
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 10,
                transition: 'all 0.18s ease',
                boxShadow: hov ? `0 6px 24px ${mat.border}55` : 'none',
                cursor: 'default',
            }}
        >
            {/* ヘッダー */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 16, fontWeight: 900, color: hov ? mat.glow : '#fff',
                        letterSpacing: '0.5px', transition: 'color 0.18s',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {recipe.name}
                    </div>
                    <div style={{ fontSize: 10, color: mat.fg + 'bb', marginTop: 3 }}>
                        {mat.emoji} {mat.label}素材
                    </div>
                </div>
                <PatternGrid pattern={recipe.pattern} sz={16} />
            </div>

            {/* ステータス */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 10px',
                background: 'rgba(0,0,0,0.45)', borderRadius: 7,
                padding: '8px 10px', fontSize: 11,
            }}>
                <span style={{ color: '#ff7777' }}>❤️ {stats.maxHp}</span>
                <span style={{ color: '#ffaa66' }}>⚔️ {stats.attack}</span>
                <span style={{ color: '#77aaff' }}>🏹 {stats.range}</span>
                <span style={{ color: '#77ff77' }}>⚡ {(stats.speed ?? 0).toFixed(1)}</span>
            </div>

            {/* パッシブ */}
            {stats.passiveAbilities && stats.passiveAbilities.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {stats.passiveAbilities.map((pa, i) => (
                        <div key={i} style={{
                            fontSize: 9, color: '#cc99ff', padding: '4px 8px',
                            background: 'rgba(100,0,200,0.22)',
                            borderLeft: '2px solid #7733cc',
                            borderRadius: '0 4px 4px 0', lineHeight: 1.4,
                        }}>
                            ◈ {PASSIVE_DESCRIPTIONS[pa.type] ?? pa.type}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── メインコンポーネント ──────────────────────────────────
const BestiaryModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [tab, setTab] = useState<'MONSTER' | 'RELIC' | 'HERO'>('MONSTER');
    const [hovHero, setHovHero] = useState<string | null>(null);

    if (!isOpen) return null;

    const commonByUnitId = Object.fromEntries(
        ALL_RECIPES.filter(r => r.rarity === 'common').map(r => [r.id, r])
    );
    const rareRecipes = ALL_RECIPES.filter(r => r.rarity === 'rare');
    const heroUnits = Object.entries(UNIT_STATS).filter(([id]) => HERO_IDS.includes(id));

    const TABS = [
        { key: 'MONSTER' as const, label: '☠ 魔物図鑑' },
        { key: 'RELIC'   as const, label: '✧ レリック' },
        { key: 'HERO'    as const, label: '⚔ 英雄' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.92)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(6px)',
        }}>
            <div style={{
                width: '1000px', maxHeight: '88vh',
                background: '#05050e',
                borderRadius: 18,
                border: '1px solid #2a1045',
                display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 0 80px rgba(100,0,200,0.18), inset 0 0 80px rgba(0,0,0,0.5)',
            }}>

                {/* ── ヘッダー ────────────────── */}
                <div style={{
                    padding: '16px 28px',
                    background: 'linear-gradient(180deg, #120825 0%, #05050e 100%)',
                    borderBottom: '1px solid #1e0a38',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <div>
                        <h2 style={{
                            margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: 4,
                            background: 'linear-gradient(90deg, #cc88ff, #8844ff)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            {tab === 'MONSTER' ? '☠ 魔軍図典'
                             : tab === 'RELIC' ? '✧ レリック目録'
                             : '⚔ 英雄調査録'}
                        </h2>
                        <div style={{ fontSize: 10, color: '#3a1855', marginTop: 2, letterSpacing: 3 }}>
                            DARK LORD'S COMPENDIUM
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: '1px solid #3a1855', color: '#553366',
                            width: 34, height: 34, borderRadius: '50%', cursor: 'pointer',
                            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#cc88ff'; e.currentTarget.style.color = '#cc88ff'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = '#3a1855'; e.currentTarget.style.color = '#553366'; }}
                    >
                        ×
                    </button>
                </div>

                {/* ── タブ ────────────────────── */}
                <div style={{ display: 'flex', background: '#08080f', borderBottom: '1px solid #160830' }}>
                    {TABS.map(t => (
                        <div
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            style={{
                                flex: 1, padding: '11px', textAlign: 'center', cursor: 'pointer',
                                fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
                                color: tab === t.key ? '#cc88ff' : '#332244',
                                borderBottom: tab === t.key ? '2px solid #8844ff' : '2px solid transparent',
                                transition: 'all 0.2s',
                            }}
                            onMouseOver={e => { if (tab !== t.key) (e.currentTarget as HTMLDivElement).style.color = '#886699'; }}
                            onMouseOut={e => { if (tab !== t.key) (e.currentTarget as HTMLDivElement).style.color = '#332244'; }}
                        >
                            {t.label}
                        </div>
                    ))}
                </div>

                {/* ── コンテンツ ───────────────── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', background: '#05050e' }}>

                    {/* ─── 魔物図鑑 ─── */}
                    {tab === 'MONSTER' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

                            {/* コモン: ファミリーごとに3枚横並び */}
                            {FAMILIES.map(fam => (
                                <section key={fam.id}>
                                    {/* ファミリーヘッダー */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        marginBottom: 12, paddingBottom: 10,
                                        borderBottom: '1px solid #1a0c2e',
                                    }}>
                                        <span style={{ fontSize: 22 }}>{fam.icon}</span>
                                        <div>
                                            <span style={{ fontSize: 15, fontWeight: 900, color: '#ccbbee', letterSpacing: 1 }}>
                                                {fam.label}系
                                            </span>
                                            <span style={{ fontSize: 10, color: '#443355', marginLeft: 10 }}>
                                                {fam.desc}
                                            </span>
                                        </div>
                                        <div style={{
                                            marginLeft: 'auto', fontSize: 9, color: '#3a2050',
                                            padding: '2px 8px', border: '1px solid #2a1540', borderRadius: 4,
                                            letterSpacing: 2,
                                        }}>
                                            COMMON
                                        </div>
                                    </div>

                                    {/* 3枚グリッド (骨・肉・霊) */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                        {([0, 1, 2] as const).map(matIdx => {
                                            const suffix = ['bone', 'meat', 'spirit'][matIdx];
                                            const unitId = `${fam.id}_${suffix}`;
                                            const recipe = commonByUnitId[unitId];
                                            return recipe
                                                ? <UnitCard key={unitId} recipe={recipe} unitId={unitId} matIdx={matIdx} />
                                                : null;
                                        })}
                                    </div>
                                </section>
                            ))}

                            {/* ── レアセクション ── */}
                            <section>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    marginBottom: 14, paddingBottom: 10,
                                    borderBottom: '1px solid #1a1040',
                                }}>
                                    <span style={{ fontSize: 22 }}>★</span>
                                    <div>
                                        <span style={{ fontSize: 15, fontWeight: 900, color: '#4488ff', letterSpacing: 1 }}>
                                            レア召喚
                                        </span>
                                        <span style={{ fontSize: 10, color: '#223355', marginLeft: 10 }}>
                                            ❓ ワイルドカードでバリアント決定
                                        </span>
                                    </div>
                                    <div style={{
                                        marginLeft: 'auto', fontSize: 9, color: '#224488',
                                        padding: '2px 8px', border: '1px solid #1a3366', borderRadius: 4, letterSpacing: 2,
                                    }}>
                                        RARE
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {rareRecipes.map(recipe => {
                                        const rc = RARITY_COLOR[recipe.rarity];
                                        return (
                                            <div key={recipe.id} style={{
                                                background: '#08091a', border: `1px solid ${rc}44`,
                                                borderRadius: 12, overflow: 'hidden',
                                            }}>
                                                {/* レアレシピヘッダー */}
                                                <div style={{
                                                    padding: '12px 18px', background: `${rc}12`,
                                                    borderBottom: `1px solid ${rc}28`,
                                                    display: 'flex', alignItems: 'center', gap: 16,
                                                }}>
                                                    <PatternGrid pattern={recipe.pattern} sz={22} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{recipe.name}</div>
                                                        <div style={{ fontSize: 10, color: '#443355', marginTop: 3 }}>
                                                            ❓ に入る素材でバリアントが変化
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        fontSize: 10, fontWeight: 'bold', color: rc,
                                                        background: `${rc}22`, border: `1px solid ${rc}66`,
                                                        borderRadius: 4, padding: '3px 12px',
                                                    }}>
                                                        {RARITY_LABEL[recipe.rarity]}
                                                    </div>
                                                </div>

                                                {/* 3バリアント列 */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                    {([0, 1, 2] as const).map((matIdx, col) => {
                                                        const unitId = recipe.resultMap?.[matIdx];
                                                        const stats = unitId ? UNIT_STATS[unitId] : null;
                                                        const mat = MAT[matIdx];
                                                        const displayName = unitId ? (RARE_VARIANT_NAMES[unitId] ?? unitId) : '???';
                                                        return (
                                                            <div key={matIdx} style={{
                                                                padding: '14px 16px',
                                                                borderLeft: col > 0 ? '1px solid #111' : 'none',
                                                                display: 'flex', flexDirection: 'column', gap: 9,
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                    <div style={{
                                                                        width: 10, height: 10, borderRadius: '50%',
                                                                        background: mat.fg, boxShadow: `0 0 6px ${mat.glow}`,
                                                                        flexShrink: 0,
                                                                    }} />
                                                                    <span style={{ fontSize: 13, fontWeight: 900, color: mat.fg }}>
                                                                        {displayName}
                                                                    </span>
                                                                    <span style={{ fontSize: 10, color: '#333' }}>{mat.emoji}</span>
                                                                </div>
                                                                {stats ? (
                                                                    <>
                                                                        <div style={{
                                                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px',
                                                                            background: 'rgba(0,0,0,0.35)', borderRadius: 6,
                                                                            padding: '6px 8px', fontSize: 10,
                                                                        }}>
                                                                            <span style={{ color: '#ff7777' }}>❤️ {stats.maxHp}</span>
                                                                            <span style={{ color: '#ffaa66' }}>⚔️ {stats.attack}</span>
                                                                            <span style={{ color: '#77aaff' }}>🏹 {stats.range}</span>
                                                                            <span style={{ color: '#77ff77' }}>⚡ {(stats.speed ?? 0).toFixed(1)}</span>
                                                                        </div>
                                                                        {stats.passiveAbilities && stats.passiveAbilities.length > 0 && (
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                                {stats.passiveAbilities.map((pa, i) => (
                                                                                    <div key={i} style={{
                                                                                        fontSize: 9, color: '#cc99ff', padding: '3px 7px',
                                                                                        background: 'rgba(80,0,160,0.22)',
                                                                                        borderLeft: '2px solid #7733cc',
                                                                                        borderRadius: '0 3px 3px 0', lineHeight: 1.4,
                                                                                    }}>
                                                                                        ◈ {PASSIVE_DESCRIPTIONS[pa.type] ?? pa.type}
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <div style={{ fontSize: 10, color: '#222', fontStyle: 'italic' }}>データなし</div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* ─── レリック ─── */}
                    {tab === 'RELIC' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                            {RELICS.map(relic => {
                                const rc = RARITY_COLOR[relic.rarity];
                                return (
                                    <div key={relic.id} style={{
                                        background: '#08081a', border: `1px solid ${rc}44`,
                                        borderRadius: 12, padding: '16px 18px',
                                        display: 'flex', gap: 14, alignItems: 'flex-start',
                                    }}>
                                        <div style={{ fontSize: 42, lineHeight: 1, flexShrink: 0 }}>{relic.icon}</div>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <div style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>{relic.name}</div>
                                                <div style={{
                                                    fontSize: 10, color: rc, background: `${rc}22`,
                                                    border: `1px solid ${rc}55`, borderRadius: 4, padding: '2px 8px',
                                                }}>
                                                    {RARITY_LABEL[relic.rarity]}
                                                </div>
                                            </div>
                                            <div style={{
                                                fontSize: 12, color: '#9988aa', lineHeight: 1.65,
                                                padding: '9px 12px', background: 'rgba(0,0,0,0.3)',
                                                borderRadius: 6, borderLeft: `3px solid ${rc}55`,
                                            }}>
                                                {relic.description}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ─── 英雄 ─── */}
                    {tab === 'HERO' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                            {heroUnits.map(([id, stats]) => {
                                const isHov = hovHero === id;
                                const col = `#${(stats.color || 0xffffff).toString(16).padStart(6, '0')}`;
                                return (
                                    <div
                                        key={id}
                                        onMouseEnter={() => setHovHero(id)}
                                        onMouseLeave={() => setHovHero(null)}
                                        style={{
                                            background: isHov ? '#101020' : '#0a0a16',
                                            border: `1px solid ${isHov ? '#444466' : '#181830'}`,
                                            borderRadius: 10, padding: '16px',
                                            display: 'flex', flexDirection: 'column', gap: 11,
                                            transition: 'all 0.2s',
                                            transform: isHov ? 'translateY(-2px)' : 'none',
                                            boxShadow: isHov ? `0 8px 28px rgba(0,0,0,0.5), 0 0 18px ${col}33` : 'none',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 42, height: 42, borderRadius: '50%',
                                                background: col, boxShadow: `0 0 14px ${col}99`,
                                                flexShrink: 0, border: '2px solid rgba(255,255,255,0.15)',
                                            }} />
                                            <div>
                                                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{id}</div>
                                                <div style={{ fontSize: 9, color: '#333355', letterSpacing: 2 }}>HERO UNIT</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px',
                                            padding: '9px 10px', background: 'rgba(0,0,0,0.35)', borderRadius: 7,
                                        }}>
                                            <div style={{ fontSize: 11, color: '#ff7777' }}>❤️ {stats.maxHp}</div>
                                            <div style={{ fontSize: 11, color: '#ffaa66' }}>⚔️ {Math.abs(stats.attack || 0)}</div>
                                            <div style={{ fontSize: 11, color: '#77aaff' }}>🏹 {stats.range}</div>
                                            <div style={{ fontSize: 11, color: '#77ff77' }}>⚡ {stats.speed}</div>
                                        </div>
                                        {stats.passiveAbilities && stats.passiveAbilities.length > 0 ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                {stats.passiveAbilities.map((pa, i) => (
                                                    <div key={i} style={{
                                                        fontSize: 10, color: '#bbb', padding: '4px 8px',
                                                        background: '#14142a',
                                                        borderLeft: '2px solid #8844ff',
                                                        borderRadius: '0 4px 4px 0',
                                                    }}>
                                                        <span style={{ color: '#8844ff', marginRight: 4 }}>◈</span>
                                                        {PASSIVE_DESCRIPTIONS[pa.type] || pa.type}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 10, color: '#222233', textAlign: 'center', fontStyle: 'italic' }}>
                                                ── no special abilities ──
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── フッター ────────────────── */}
                <div style={{
                    padding: '10px 24px', textAlign: 'center',
                    fontSize: 10, color: '#1e0a30', letterSpacing: 2, fontStyle: 'italic',
                    borderTop: '1px solid #110820', background: '#04040b',
                }}>
                    "Darkness holds no secrets from those who wield it with purpose."
                </div>
            </div>
        </div>
    );
};

export default BestiaryModal;
