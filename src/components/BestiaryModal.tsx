import React, { useState } from 'react';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import {
    ALL_RECIPES, RELICS, COLOR_HEX, PIECE_EMOJIS,
    RARITY_COLOR, RARITY_LABEL, RARE_VARIANT_NAMES,
    type Recipe,
} from '../game/config';

// ── 素材テーマ ────────────────────────────────────────────
const MAT: Record<number, { label: string; emoji: string; fg: string; border: string; glow: string; bg: string }> = {
    0: { label: '骨', emoji: '🦴', fg: '#cccccc', border: '#666688', glow: '#aaaacc', bg: '#0e0e1a' },
    1: { label: '肉', emoji: '🥩', fg: '#ff9999', border: '#aa3333', glow: '#ff6666', bg: '#160808' },
    2: { label: '霊', emoji: '🔮', fg: '#cc88ff', border: '#7733cc', glow: '#aa66ff', bg: '#0c0616' },
};

const HERO_IDS = ['村人', '農夫', '弓兵', '剣士', '魔法使い', '重騎士', 'プリースト', '聖騎士', 'パラディン', '大魔道士', '勇者'];

// ── パターンプレビュー ────────────────────────────────────
const PatternGrid: React.FC<{ pattern: number[][]; sz?: number }> = ({ pattern, sz = 16 }) => (
    <div style={{
        display: 'grid', gap: 2,
        gridTemplateColumns: `repeat(${pattern[0]?.length || 1}, ${sz}px)`,
        flexShrink: 0,
    }}>
        {pattern.map((row, ri) => row.map((val, ci) => (
            <div key={`${ri}-${ci}`} style={{
                width: sz, height: sz, borderRadius: 2,
                background: val === -1 ? 'transparent' : val === 9 ? '#2a1a3a' : COLOR_HEX[val] ?? '#333',
                border: val >= 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: sz * 0.5,
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
                borderRadius: 10, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 9,
                transition: 'all 0.18s ease',
                boxShadow: hov ? `0 6px 22px ${mat.border}55` : 'none',
                cursor: 'default',
            }}
        >
            {/* ヘッダー: 名前 + パターン */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 15, fontWeight: 900,
                        color: hov ? mat.glow : '#fff',
                        transition: 'color 0.18s',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {recipe.name}
                    </div>
                    <div style={{ fontSize: 10, color: mat.fg + 'aa', marginTop: 3 }}>
                        {mat.emoji} {mat.label}素材
                    </div>
                </div>
                <PatternGrid pattern={recipe.pattern} sz={15} />
            </div>

            {/* ステータス */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px',
                background: 'rgba(0,0,0,0.45)', borderRadius: 6,
                padding: '7px 9px', fontSize: 11,
            }}>
                <span style={{ color: '#ff7777' }}>❤️ {stats.maxHp}</span>
                <span style={{ color: '#ffaa66' }}>⚔️ {stats.attack}</span>
                <span style={{ color: '#77aaff' }}>🏹 {stats.range}</span>
                <span style={{ color: '#77ff77' }}>⚡ {(stats.speed ?? 0).toFixed(1)}</span>
            </div>

            {/* パッシブ */}
            {stats.passiveAbilities && stats.passiveAbilities.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {stats.passiveAbilities.map((pa, i) => (
                        <div key={i} style={{
                            fontSize: 9, color: '#cc99ff', padding: '3px 7px',
                            background: 'rgba(100,0,200,0.2)',
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

// ── セクションヘッダー ────────────────────────────────────
const SectionHeader: React.FC<{ label: string; sub?: string; color: string }> = ({ label, sub, color }) => (
    <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: `${color}10`,
        border: `1px solid ${color}30`,
        borderLeft: `3px solid ${color}`,
        borderRadius: '0 8px 8px 0',
        marginBottom: 14,
    }}>
        <span style={{ fontSize: 14, fontWeight: 900, color, letterSpacing: 2 }}>{label}</span>
        {sub && <span style={{ fontSize: 10, color: color + '77', letterSpacing: 1 }}>{sub}</span>}
    </div>
);

// ── メイン ────────────────────────────────────────────────
const BestiaryModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const [tab, setTab] = useState<'MONSTER' | 'RELIC' | 'HERO'>('MONSTER');
    const [hovHero, setHovHero] = useState<string | null>(null);

    if (!isOpen) return null;

    const commonRecipes = ALL_RECIPES.filter(r => r.rarity === 'common');
    const rareRecipes   = ALL_RECIPES.filter(r => r.rarity === 'rare');
    const heroUnits     = Object.entries(UNIT_STATS).filter(([id]) => HERO_IDS.includes(id));

    const TABS = [
        { key: 'MONSTER' as const, label: '☠ 魔物図鑑' },
        { key: 'RELIC'   as const, label: '✧ レリック' },
        { key: 'HERO'    as const, label: '⚔ 英雄' },
    ];

    return (
        <div style={{
            position: 'fixed', inset: 0,
            zIndex: 1000,
            background: '#05050e',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

                {/* ── ヘッダー ── */}
                <div style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(180deg, #110822 0%, #05050e 100%)',
                    borderBottom: '1px solid #1e0a38',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    flexShrink: 0,
                }}>
                    <div>
                        <h2 style={{
                            margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: 4,
                            background: 'linear-gradient(90deg, #cc88ff, #8844ff)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        }}>
                            {tab === 'MONSTER' ? '☠ 魔軍図典'
                             : tab === 'RELIC' ? '✧ レリック目録'
                             : '⚔ 英雄調査録'}
                        </h2>
                        <div style={{ fontSize: 9, color: '#3a1855', marginTop: 1, letterSpacing: 3 }}>
                            DARK LORD'S COMPENDIUM
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: '1px solid #3a1855', color: '#553366',
                            width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                            fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = '#cc88ff'; e.currentTarget.style.color = '#cc88ff'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = '#3a1855'; e.currentTarget.style.color = '#553366'; }}
                    >×</button>
                </div>

                {/* ── タブ ── */}
                <div style={{ display: 'flex', background: '#07070f', borderBottom: '1px solid #160830', flexShrink: 0 }}>
                    {TABS.map(t => (
                        <div key={t.key} onClick={() => setTab(t.key)} style={{
                            flex: 1, padding: '10px', textAlign: 'center', cursor: 'pointer',
                            fontSize: 13, fontWeight: 'bold', letterSpacing: 1,
                            color: tab === t.key ? '#cc88ff' : '#332244',
                            borderBottom: tab === t.key ? '2px solid #8844ff' : '2px solid transparent',
                            transition: 'all 0.15s',
                        }}>
                            {t.label}
                        </div>
                    ))}
                </div>

                {/* ── コンテンツ ── */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px', background: '#05050e' }}>

                    {/* ─── 魔物図鑑 ─── */}
                    {tab === 'MONSTER' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                            {/* コモン */}
                            <div>
                                <SectionHeader
                                    label="COMMON"
                                    sub={`${commonRecipes.length}種 · ワイルドカードなし`}
                                    color="#aaaaaa"
                                />
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                    {commonRecipes.map(recipe =>
                                        ([0, 1, 2] as const).map(matIdx => {
                                            const unitId = recipe.resultMap?.[matIdx];
                                            if (!unitId) return null;
                                            return (
                                                <UnitCard
                                                    key={unitId}
                                                    recipe={recipe}
                                                    unitId={unitId}
                                                    matIdx={matIdx}
                                                />
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* レア */}
                            <div>
                                <SectionHeader
                                    label="RARE"
                                    sub={`${rareRecipes.length}種 · ❓ワイルドカードでバリアント決定`}
                                    color="#4488ff"
                                />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {rareRecipes.map(recipe => {
                                        const rc = RARITY_COLOR[recipe.rarity];
                                        return (
                                            <div key={recipe.id} style={{
                                                background: '#08091a', border: `1px solid ${rc}44`,
                                                borderRadius: 10, overflow: 'hidden',
                                            }}>
                                                {/* レアレシピヘッダー */}
                                                <div style={{
                                                    padding: '10px 16px',
                                                    background: `${rc}10`,
                                                    borderBottom: `1px solid ${rc}25`,
                                                    display: 'flex', alignItems: 'center', gap: 14,
                                                }}>
                                                    <PatternGrid pattern={recipe.pattern} sz={20} />
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{recipe.name}</div>
                                                        <div style={{ fontSize: 9, color: '#443355', marginTop: 2 }}>
                                                            ❓ に入る素材(骨/肉/霊)でバリアントが変化
                                                        </div>
                                                    </div>
                                                    <div style={{
                                                        fontSize: 9, fontWeight: 'bold', color: rc,
                                                        background: `${rc}22`, border: `1px solid ${rc}55`,
                                                        borderRadius: 4, padding: '2px 10px',
                                                    }}>
                                                        {RARITY_LABEL[recipe.rarity]}
                                                    </div>
                                                </div>

                                                {/* 3バリアント */}
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                                    {([0, 1, 2] as const).map((matIdx, col) => {
                                                        const unitId = recipe.resultMap?.[matIdx];
                                                        const stats = unitId ? UNIT_STATS[unitId] : null;
                                                        const mat = MAT[matIdx];
                                                        const displayName = unitId ? (RARE_VARIANT_NAMES[unitId] ?? unitId) : '???';
                                                        return (
                                                            <div key={matIdx} style={{
                                                                padding: '12px 14px',
                                                                borderLeft: col > 0 ? '1px solid #0e0e1e' : 'none',
                                                                display: 'flex', flexDirection: 'column', gap: 8,
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                                    <div style={{
                                                                        width: 9, height: 9, borderRadius: '50%',
                                                                        background: mat.fg, boxShadow: `0 0 5px ${mat.glow}`,
                                                                        flexShrink: 0,
                                                                    }} />
                                                                    <span style={{ fontSize: 13, fontWeight: 900, color: mat.fg }}>{displayName}</span>
                                                                    <span style={{ fontSize: 9, color: '#333' }}>{mat.emoji}</span>
                                                                </div>
                                                                {stats ? (
                                                                    <>
                                                                        <div style={{
                                                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px',
                                                                            background: 'rgba(0,0,0,0.35)', borderRadius: 5,
                                                                            padding: '5px 8px', fontSize: 10,
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
                                                                                        fontSize: 9, color: '#cc99ff', padding: '3px 6px',
                                                                                        background: 'rgba(80,0,160,0.2)',
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
                            </div>
                        </div>
                    )}

                    {/* ─── レリック ─── */}
                    {tab === 'RELIC' && (
                        <div>
                            <SectionHeader label="RELICS" sub={`${RELICS.length}種`} color="#cc88ff" />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                                {RELICS.map(relic => {
                                    const rc = RARITY_COLOR[relic.rarity];
                                    return (
                                        <div key={relic.id} style={{
                                            background: '#08081a', border: `1px solid ${rc}44`,
                                            borderRadius: 10, padding: '14px 16px',
                                            display: 'flex', gap: 14, alignItems: 'flex-start',
                                        }}>
                                            <div style={{ fontSize: 40, lineHeight: 1, flexShrink: 0 }}>{relic.icon}</div>
                                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <div style={{ fontSize: 15, fontWeight: 'bold', color: '#fff' }}>{relic.name}</div>
                                                    <div style={{
                                                        fontSize: 9, color: rc, background: `${rc}22`,
                                                        border: `1px solid ${rc}55`, borderRadius: 4, padding: '2px 7px',
                                                    }}>
                                                        {RARITY_LABEL[relic.rarity]}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    fontSize: 12, color: '#9988aa', lineHeight: 1.6,
                                                    padding: '8px 11px', background: 'rgba(0,0,0,0.3)',
                                                    borderRadius: 6, borderLeft: `3px solid ${rc}55`,
                                                }}>
                                                    {relic.description}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ─── 英雄 ─── */}
                    {tab === 'HERO' && (
                        <div>
                            <SectionHeader label="HEROES" sub={`${heroUnits.length}種`} color="#ffcc44" />
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
                                                borderRadius: 9, padding: '13px',
                                                display: 'flex', flexDirection: 'column', gap: 9,
                                                transition: 'all 0.18s',
                                                transform: isHov ? 'translateY(-2px)' : 'none',
                                                boxShadow: isHov ? `0 6px 22px rgba(0,0,0,0.5), 0 0 14px ${col}33` : 'none',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: '50%',
                                                    background: col, boxShadow: `0 0 10px ${col}88`,
                                                    flexShrink: 0, border: '2px solid rgba(255,255,255,0.1)',
                                                }} />
                                                <div>
                                                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{id}</div>
                                                    <div style={{ fontSize: 8, color: '#333355', letterSpacing: 2 }}>HERO</div>
                                                </div>
                                            </div>
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 6px',
                                                padding: '7px 8px', background: 'rgba(0,0,0,0.35)', borderRadius: 6,
                                            }}>
                                                <div style={{ fontSize: 10, color: '#ff7777' }}>❤️ {stats.maxHp}</div>
                                                <div style={{ fontSize: 10, color: '#ffaa66' }}>⚔️ {Math.abs(stats.attack || 0)}</div>
                                                <div style={{ fontSize: 10, color: '#77aaff' }}>🏹 {stats.range}</div>
                                                <div style={{ fontSize: 10, color: '#77ff77' }}>⚡ {stats.speed}</div>
                                            </div>
                                            {stats.passiveAbilities && stats.passiveAbilities.length > 0 ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                    {stats.passiveAbilities.map((pa, i) => (
                                                        <div key={i} style={{
                                                            fontSize: 9, color: '#bbb', padding: '3px 7px',
                                                            background: '#12122a',
                                                            borderLeft: '2px solid #7733cc',
                                                            borderRadius: '0 3px 3px 0',
                                                        }}>
                                                            <span style={{ color: '#8844ff', marginRight: 3 }}>◈</span>
                                                            {PASSIVE_DESCRIPTIONS[pa.type] || pa.type}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ fontSize: 9, color: '#1e1e30', textAlign: 'center', fontStyle: 'italic' }}>
                                                    ── no abilities ──
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── フッター ── */}
                <div style={{
                    padding: '8px 20px', textAlign: 'center',
                    fontSize: 9, color: '#1a0828', letterSpacing: 2, fontStyle: 'italic',
                    borderTop: '1px solid #110820', background: '#04040a', flexShrink: 0,
                }}>
                    "Darkness holds no secrets from those who wield it with purpose."
                </div>
        </div>
    );
};

export default BestiaryModal;
