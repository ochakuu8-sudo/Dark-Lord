import React, { useState } from 'react';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';
import { ALL_RECIPES, COLOR_HEX, PIECE_EMOJIS, RARITY_COLOR, RARITY_LABEL } from '../game/config';

interface BestiaryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MATERIAL_LABEL: Record<number, { name: string; emoji: string; color: string }> = {
    0: { name: '骨', emoji: '🦴', color: '#cccccc' },
    1: { name: '肉', emoji: '🥩', color: '#ff8888' },
    2: { name: '霊', emoji: '🔮', color: '#cc88ff' },
};

const HERO_IDS = ['村人', '農夫', '弓兵', '剣士', '魔法使い', '重騎士', 'プリースト', '聖騎士', 'パラディン', '大魔道士', '勇者'];

const BestiaryModal: React.FC<BestiaryModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'RECIPE' | 'HERO'>('RECIPE');
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (!isOpen) return null;

    const heroUnits = Object.entries(UNIT_STATS).filter(([id]) => HERO_IDS.includes(id));

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '960px', height: '720px', backgroundColor: '#0a0a0f', borderRadius: '20px',
                border: '2px solid #522', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 0 60px rgba(255,50,50,0.25)', position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '20px 30px', borderBottom: '1px solid #322', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#150a0a'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#ff4444', fontSize: '28px', textShadow: '0 0 15px rgba(255,0,0,0.5)', letterSpacing: '2px' }}>
                            {activeTab === 'RECIPE' ? '召喚レシピ & 魔物図鑑' : '光の勢力 調査録'}
                        </h2>
                        <div style={{ fontSize: '12px', color: '#644', marginTop: '4px' }}>Ancient Archives of the Infernal Realm</div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: '#221111', border: '1px solid #522', color: '#888',
                            width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '24px',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#f44'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.borderColor = '#522'; }}
                    >
                        ×
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', backgroundColor: '#0d0d12' }}>
                    {([
                        { key: 'RECIPE', label: '📜 魔物図鑑', activeColor: '#ffddaa', activeBg: '#1a1208', shadow: 'rgba(255,220,160,0.5)' },
                        { key: 'HERO',   label: '⚔️ 英雄たちの行進', activeColor: '#ffd700', activeBg: '#24240a', shadow: 'rgba(255,215,0,0.5)' },
                    ] as const).map(tab => (
                        <div
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                flex: 1, padding: '14px', textAlign: 'center', cursor: 'pointer',
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                backgroundColor: activeTab === tab.key ? tab.activeBg : 'transparent',
                                color: activeTab === tab.key ? tab.activeColor : '#444',
                                fontWeight: 'bold', fontSize: '16px',
                                borderBottom: activeTab === tab.key ? `4px solid ${tab.activeColor}` : '4px solid transparent',
                                textShadow: activeTab === tab.key ? `0 0 10px ${tab.shadow}` : 'none',
                            }}
                        >
                            {tab.label}
                        </div>
                    ))}
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', backgroundColor: '#050508' }}>
                    {activeTab === 'RECIPE' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {ALL_RECIPES.map(recipe => {
                                const rarityCol = RARITY_COLOR[recipe.rarity];
                                return (
                                    <div key={recipe.id} style={{
                                        background: '#0d0d16', border: `1px solid ${rarityCol}55`,
                                        borderRadius: '14px', overflow: 'hidden',
                                    }}>
                                        {/* レシピヘッダー */}
                                        <div style={{
                                            padding: '12px 20px', background: `${rarityCol}14`,
                                            borderBottom: `1px solid ${rarityCol}33`,
                                            display: 'flex', alignItems: 'center', gap: '14px',
                                        }}>
                                            {/* パターンプレビュー */}
                                            <div style={{ display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${recipe.pattern[0].length}, 22px)`, flexShrink: 0 }}>
                                                {recipe.pattern.map((row, ri) => row.map((val, ci) => (
                                                    <div key={`${ri}-${ci}`} style={{
                                                        width: 22, height: 22, borderRadius: 3,
                                                        backgroundColor: val === -1 ? 'transparent' : val === 9 ? '#2a1a3a' : COLOR_HEX[val] ?? '#333',
                                                        border: val !== -1 ? '1px solid #444' : 'none',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px',
                                                    }}>
                                                        {val === 9 ? '❓' : val >= 0 ? PIECE_EMOJIS[val] : ''}
                                                    </div>
                                                )))}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>{recipe.name}</div>
                                                <div style={{ fontSize: '11px', color: '#664466', marginTop: '2px' }}>ワイルドカードで3種に派生</div>
                                            </div>
                                            <div style={{
                                                fontSize: '11px', fontWeight: 'bold', color: rarityCol,
                                                background: `${rarityCol}22`, border: `1px solid ${rarityCol}66`,
                                                borderRadius: '4px', padding: '3px 12px', flexShrink: 0,
                                            }}>
                                                {RARITY_LABEL[recipe.rarity]}
                                            </div>
                                        </div>

                                        {/* 派生バリアント3列 */}
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            {([0, 1, 2] as const).map((mat, idx) => {
                                                const unitId = recipe.resultMap?.[mat];
                                                const stats = unitId ? UNIT_STATS[unitId] : null;
                                                const matInfo = MATERIAL_LABEL[mat];
                                                const unitColor = stats?.color ? `#${stats.color.toString(16).padStart(6, '0')}` : '#888';
                                                const isHovered = hoveredId === unitId;
                                                return (
                                                    <div
                                                        key={mat}
                                                        onMouseEnter={() => unitId && setHoveredId(unitId)}
                                                        onMouseLeave={() => setHoveredId(null)}
                                                        style={{
                                                            padding: '14px 16px',
                                                            borderLeft: idx > 0 ? '1px solid #1a1a2a' : 'none',
                                                            display: 'flex', flexDirection: 'column', gap: '10px',
                                                            background: isHovered ? '#151525' : 'transparent',
                                                            transition: 'background 0.15s',
                                                        }}
                                                    >
                                                        {/* バリアント名 + カラーサークル */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <div style={{
                                                                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                                                                backgroundColor: unitColor,
                                                                boxShadow: `0 0 10px ${unitColor}88`,
                                                                border: '2px solid rgba(255,255,255,0.15)',
                                                            }} />
                                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: matInfo.color }}>
                                                                {matInfo.emoji} {matInfo.name}{recipe.name}
                                                            </div>
                                                        </div>
                                                        {stats ? (
                                                            <>
                                                                <div style={{
                                                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px',
                                                                    fontSize: '11px', padding: '8px 10px',
                                                                    background: 'rgba(0,0,0,0.3)', borderRadius: '6px',
                                                                }}>
                                                                    <span style={{ color: '#ff6666' }}>❤️ {stats.maxHp}</span>
                                                                    <span style={{ color: '#ffaa66' }}>⚔️ {stats.attack}</span>
                                                                    <span style={{ color: '#66aaff' }}>🏹 {stats.range}</span>
                                                                    <span style={{ color: '#66ff66' }}>⚡ {(stats.speed ?? 0).toFixed(2)}</span>
                                                                </div>
                                                                {stats.passiveAbilities && stats.passiveAbilities.length > 0 && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                                        {stats.passiveAbilities.map((pa, i) => (
                                                                            <div key={i} style={{
                                                                                fontSize: '10px', color: '#cc88ff', lineHeight: 1.4,
                                                                                padding: '4px 7px', background: '#1a0a2a',
                                                                                borderLeft: '2px solid #aa66ff', borderRadius: '0 3px 3px 0',
                                                                            }}>
                                                                                ◈ {PASSIVE_DESCRIPTIONS[pa.type] ?? pa.type}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div style={{ fontSize: '10px', color: '#333', fontStyle: 'italic' }}>データなし</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {heroUnits.map(([id, stats]) => {
                                const isHovered = hoveredId === id;
                                const mainColor = `#${(stats.color || 0xffffff).toString(16).padStart(6, '0')}`;
                                return (
                                    <div
                                        key={id}
                                        onMouseEnter={() => setHoveredId(id)}
                                        onMouseLeave={() => setHoveredId(null)}
                                        style={{
                                            backgroundColor: isHovered ? '#151520' : '#0d0d16',
                                            border: `1px solid ${isHovered ? '#666' : '#222'}`,
                                            borderRadius: '12px', padding: '20px',
                                            display: 'flex', flexDirection: 'column', gap: '12px',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: isHovered ? 'translateY(-4px)' : 'none',
                                            boxShadow: isHovered ? `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${mainColor}44` : 'none',
                                            cursor: 'default'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <div style={{
                                                width: '48px', height: '48px', borderRadius: '50%',
                                                backgroundColor: mainColor, boxShadow: `0 0 15px ${mainColor}aa`,
                                                flexShrink: 0, border: '2px solid rgba(255,255,255,0.2)'
                                            }} />
                                            <div>
                                                <div style={{ color: '#fff', fontSize: '18px', fontWeight: '900', textShadow: '1px 1px 2px #000' }}>{id}</div>
                                                <div style={{ fontSize: '10px', color: '#666', letterSpacing: '1px' }}>HERO</div>
                                            </div>
                                        </div>
                                        <div style={{
                                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
                                            padding: '10px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                        }}>
                                            <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', gap: '6px' }}>❤️ <span style={{ color: '#ff6666', fontWeight: 'bold' }}>{stats.maxHp}</span></div>
                                            <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', gap: '6px' }}>⚔️ <span style={{ color: '#ffaa66', fontWeight: 'bold' }}>{Math.abs(stats.attack || 0)}</span></div>
                                            <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', gap: '6px' }}>🏹 <span style={{ color: '#66aaff', fontWeight: 'bold' }}>{stats.range}</span></div>
                                            <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', gap: '6px' }}>⚡ <span style={{ color: '#66ff66', fontWeight: 'bold' }}>{stats.speed}</span></div>
                                        </div>
                                        {stats.passiveAbilities && stats.passiveAbilities.length > 0 ? (
                                            <div>
                                                {stats.passiveAbilities.map((pa, idx) => (
                                                    <div key={idx} style={{
                                                        fontSize: '11px', color: '#bbb', lineHeight: '1.4',
                                                        padding: '5px 8px', backgroundColor: '#1a1a24', borderLeft: '2px solid #a6a',
                                                        borderRadius: '0 4px 4px 0', marginBottom: '4px'
                                                    }}>
                                                        <span style={{ color: '#a6a', fontWeight: 'bold', marginRight: '4px' }}>◈</span>
                                                        {PASSIVE_DESCRIPTIONS[pa.type] || pa.type}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: '11px', color: '#333', fontStyle: 'italic', textAlign: 'center' }}>
                                                --- No Special Abilities ---
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px', textAlign: 'center', fontSize: '12px', color: '#333',
                    borderTop: '1px solid #1a1a1f', backgroundColor: '#08080c',
                    fontStyle: 'italic', letterSpacing: '0.5px'
                }}>
                    "The balance of power shifts with every sunrise... Prepare your army, Lord of Darkness."
                </div>
            </div>
        </div>
    );
};

export default BestiaryModal;
