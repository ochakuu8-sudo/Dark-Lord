import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { ROWS } from '../game/config';
import type { HeroType } from '../game/entities';
import { HERO_ROSTER } from '../game/entities';

const WAVE_PATTERNS = [
    { id: 'random', label: 'ランダム' },
    { id: 'turtle', label: '亀甲陣' },
    { id: 'swarm', label: '雪崩' },
    { id: 'archer_wall', label: '弓兵殲滅' },
    { id: 'vip_guard', label: '精鋭護衛' },
    { id: 'lane_rush', label: '縦割り突撃' },
    { id: 'priest_loop', label: '支援完結' },
    { id: 'phased', label: '波状攻撃' },
    { id: 'speed_rush', label: '奇襲隊' },
];

const PIECE_DEFS = [
    { type: 0, label: '🦴 骨', color: '#aaaaaa', border: '#888888' },
    { type: 1, label: '🥩 肉', color: '#ff6666', border: '#cc4444' },
    { type: 2, label: '🔮 霊', color: '#aa66ff', border: '#8844ff' },
];

const DebugPanel: React.FC = () => {
    const {
        addPendingPuzzlePiece, triggerDebugGridClear,
        incomingEnemies, addIncomingEnemy, clearIncomingEnemies, generateWave,
    } = useGame();

    const [debugDay, setDebugDay] = useState(1);
    const [patternIdx, setPatternIdx] = useState(0);

    const injectPieces = (type: number, count: number) => {
        for (let i = 0; i < count; i++) addPendingPuzzlePiece(type);
    };

    const addEnemy = (type: HeroType) => {
        const idx = incomingEnemies.length;
        addIncomingEnemy({
            id: `debug-enemy-${Date.now()}-${Math.random()}`,
            type,
            row: idx % ROWS,
            col: Math.floor(idx / ROWS) % 9,
        });
    };

    const handlePatternChange = (dir: -1 | 1) => {
        setPatternIdx(i => (i + dir + WAVE_PATTERNS.length) % WAVE_PATTERNS.length);
    };

    // スタイル定数
    const sectionHeader: React.CSSProperties = {
        fontSize: '11px', fontWeight: 'bold', color: '#ff9944',
        borderBottom: '1px solid #2a1040', paddingBottom: '4px', marginBottom: '6px',
        letterSpacing: '1px',
    };
    const smallBtn = (bg: string, color = '#fff'): React.CSSProperties => ({
        background: bg, color, border: 'none',
        borderRadius: '3px', padding: '2px 7px', fontSize: '10px',
        cursor: 'pointer', fontWeight: 'bold',
    });

    return (
        <div style={{
            width: '100%', height: '100%',
            background: '#08060f',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            color: '#ccc', fontSize: '12px',
        }}>
            {/* ヘッダー */}
            <div style={{
                padding: '8px 10px', background: '#0d0a1a',
                borderBottom: '1px solid #2a1040', flexShrink: 0,
                display: 'flex', alignItems: 'center', gap: '6px',
            }}>
                <span style={{ fontSize: '14px' }}>🔧</span>
                <span style={{ fontWeight: 'bold', color: '#88ff88', fontSize: '13px' }}>デバッグモード</span>
            </div>

            {/* スクロール可能な本体 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                {/* ── ピース注入 ── */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={sectionHeader}>🎲 ピース注入</div>
                        <button style={smallBtn('#550000')} onClick={triggerDebugGridClear}>盤面クリア</button>
                    </div>
                    <div style={{ fontSize: '10px', color: '#777', marginBottom: '6px' }}>
                        ランダムな空きマスに配置されます
                    </div>
                    {PIECE_DEFS.map(({ type, label, color, border }) => (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                            <span style={{ color, fontSize: '11px', width: '46px', flexShrink: 0 }}>{label}</span>
                            {[1, 3, 5, 9].map(n => (
                                <button
                                    key={n}
                                    onClick={() => injectPieces(type, n)}
                                    style={{
                                        background: '#0d0a1a',
                                        border: `1px solid ${border}`,
                                        color,
                                        borderRadius: '3px',
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        cursor: 'pointer',
                                        fontWeight: 'bold',
                                    }}
                                >
                                    +{n}
                                </button>
                            ))}
                        </div>
                    ))}
                </div>

                {/* ── 敵設定 ── */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={sectionHeader}>⚔️ 敵設定 ({incomingEnemies.length}体)</div>
                        <button style={smallBtn('#550000')} onClick={clearIncomingEnemies}>全削除</button>
                    </div>

                    {/* Day設定 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ color: '#aaa', fontSize: '11px', width: '32px' }}>Day</span>
                        <input
                            type="number"
                            min={1} max={30}
                            value={debugDay}
                            onChange={e => setDebugDay(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                            style={{
                                width: '48px', background: '#0a0812', border: '1px solid #3a1050',
                                color: '#ffcc44', borderRadius: '3px', padding: '2px 4px',
                                fontSize: '12px', textAlign: 'center',
                            }}
                        />
                        <span style={{ fontSize: '10px', color: '#666' }}>（HP倍率に影響）</span>
                    </div>

                    {/* パターン選択 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '6px' }}>
                        <button style={{ ...smallBtn('#221144'), padding: '2px 8px', fontSize: '12px' }} onClick={() => handlePatternChange(-1)}>◀</button>
                        <div style={{
                            flex: 1, textAlign: 'center', fontSize: '11px',
                            color: '#cc88ff', background: '#0d0820',
                            border: '1px solid #3a1050', borderRadius: '3px', padding: '3px 4px',
                        }}>
                            {WAVE_PATTERNS[patternIdx].label}
                        </div>
                        <button style={{ ...smallBtn('#221144'), padding: '2px 8px', fontSize: '12px' }} onClick={() => handlePatternChange(1)}>▶</button>
                    </div>

                    <button
                        onClick={() => generateWave(debugDay, WAVE_PATTERNS[patternIdx].id)}
                        style={{
                            width: '100%', background: 'linear-gradient(to bottom, #440066, #220033)',
                            color: '#cc88ff', border: '1px solid #660099', borderRadius: '4px',
                            padding: '5px', fontSize: '11px', cursor: 'pointer', marginBottom: '8px',
                            fontWeight: 'bold',
                        }}
                    >
                        🌊 パターン生成
                    </button>

                    {/* 個別追加 */}
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>── 個別追加 ──</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {HERO_ROSTER.map(type => (
                            <button
                                key={type}
                                onClick={() => addEnemy(type)}
                                style={{
                                    background: '#1a0a0a', border: '1px solid #664444',
                                    color: '#ffaaaa', borderRadius: '3px',
                                    padding: '2px 5px', fontSize: '10px',
                                    cursor: 'pointer',
                                }}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DebugPanel;
