import React, { useState } from 'react';
import { UNIT_STATS, PASSIVE_DESCRIPTIONS } from '../game/entities';

interface BestiaryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const BestiaryModal: React.FC<BestiaryModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState<'DEMON' | 'HERO'>('DEMON');
    const [hoveredId, setHoveredId] = useState<string | null>(null);

    if (!isOpen) return null;

    const units = Object.entries(UNIT_STATS).filter(([id]) => {
        const isHero = ['村人', '農夫', '弓兵', '剣士', 'シーフ', '魔法使い', '重騎士', 'プリースト', '聖騎士', 'パラディン', '大魔道士', '勇者'].includes(id);
        return activeTab === 'HERO' ? isHero : !isHero && id !== 'zombie';
    });

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.9)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(8px)'
        }}>
            <div style={{
                width: '940px', height: '700px', backgroundColor: '#0a0a0f', borderRadius: '20px',
                border: '2px solid #522', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 0 60px rgba(255,50,50,0.25)', position: 'relative'
            }}>
                {/* Header */}
                <div style={{
                    padding: '25px 30px', borderBottom: '1px solid #322', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#150a0a'
                }}>
                    <div>
                        <h2 style={{ margin: 0, color: '#ff4444', fontSize: '32px', textShadow: '0 0 15px rgba(255,0,0,0.5)', letterSpacing: '2px' }}>
                            {activeTab === 'DEMON' ? '魔導軍団 記録書' : '光の勢力 調査録'}
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
                    <div
                        onClick={() => setActiveTab('DEMON')}
                        style={{
                            flex: 1, padding: '18px', textAlign: 'center', cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            backgroundColor: activeTab === 'DEMON' ? '#1a0a24' : 'transparent',
                            color: activeTab === 'DEMON' ? '#cc88ff' : '#444',
                            fontWeight: 'bold', fontSize: '20px',
                            borderBottom: activeTab === 'DEMON' ? '4px solid #cc88ff' : '4px solid transparent',
                            textShadow: activeTab === 'DEMON' ? '0 0 10px rgba(204,136,255,0.5)' : 'none'
                        }}
                    >
                        🔱 魔王の使徒
                    </div>
                    <div
                        onClick={() => setActiveTab('HERO')}
                        style={{
                            flex: 1, padding: '18px', textAlign: 'center', cursor: 'pointer',
                            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                            backgroundColor: activeTab === 'HERO' ? '#24240a' : 'transparent',
                            color: activeTab === 'HERO' ? '#ffd700' : '#444',
                            fontWeight: 'bold', fontSize: '20px',
                            borderBottom: activeTab === 'HERO' ? '4px solid #ffd700' : '4px solid transparent',
                            textShadow: activeTab === 'HERO' ? '0 0 10px rgba(255,215,0,0.5)' : 'none'
                        }}
                    >
                        ⚔️ 英雄たちの行進
                    </div>
                </div>

                {/* Content */}
                <div style={{
                    flex: 1, overflowY: 'auto', padding: '30px',
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px',
                    backgroundColor: '#050508'
                }}>
                    {units.map(([id, stats]) => {
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
                                    borderRadius: '12px',
                                    padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    transform: isHovered ? 'translateY(-5px)' : 'none',
                                    boxShadow: isHovered ? `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${mainColor}44` : 'none',
                                    cursor: 'default'
                                }}
                            >
                                {/* Top: Name and Avatar */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{
                                        width: '48px', height: '48px', borderRadius: '50%',
                                        backgroundColor: mainColor,
                                        boxShadow: `0 0 15px ${mainColor}aa`,
                                        flexShrink: 0,
                                        border: '2px solid rgba(255,255,255,0.2)'
                                    }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            color: '#fff', fontSize: '18px', fontWeight: '900',
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                            textShadow: '1px 1px 2px #000'
                                        }}>
                                            {id.replace(/_/g, ' ').toUpperCase()}
                                        </div>
                                        <div style={{ fontSize: '10px', color: '#444', letterSpacing: '1px' }}>CLASS: {activeTab}</div>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px',
                                    padding: '12px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.03)'
                                }}>
                                    <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span title="HP">❤️</span> <span style={{ color: '#ff6666', fontWeight: 'bold' }}>{stats.maxHp}</span>
                                    </div>
                                    <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span title="Attack">⚔️</span> <span style={{ color: '#ffaa66', fontWeight: 'bold' }}>{Math.abs(stats.attack || 0)}</span>
                                    </div>
                                    <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span title="Range">🏹</span> <span style={{ color: '#66aaff', fontWeight: 'bold' }}>{stats.range}</span>
                                    </div>
                                    <div style={{ color: '#aaa', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span title="Speed">⚡</span> <span style={{ color: '#66ff66', fontWeight: 'bold' }}>{stats.speed}</span>
                                    </div>
                                </div>

                                {/* Passives */}
                                {stats.passiveAbilities && stats.passiveAbilities.length > 0 ? (
                                    <div style={{ flex: 1 }}>
                                        {stats.passiveAbilities.map((pa, idx) => (
                                            <div key={idx} style={{
                                                fontSize: '11px', color: '#bbb', lineHeight: '1.4',
                                                padding: '6px 8px', backgroundColor: '#1a1a24', borderLeft: '2px solid #a6a',
                                                borderRadius: '0 4px 4px 0', marginBottom: '4px'
                                            }}>
                                                <span style={{ color: '#a6a', fontWeight: 'bold', marginRight: '4px' }}>◈</span>
                                                {PASSIVE_DESCRIPTIONS[pa.type] || pa.type}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, fontSize: '11px', color: '#333', fontStyle: 'italic', textAlign: 'center', paddingTop: '10px' }}>
                                        --- No Special Abilites ---
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '20px', textAlign: 'center', fontSize: '13px', color: '#333',
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
