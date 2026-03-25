import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { ROWS, COLS } from '../game/config';
import type { HeroType } from '../game/entities';
import { HERO_ROSTER } from '../game/entities';

// デバッグ用ユニット定義
const DEBUG_UNITS: { label: string; group: string; unitType: string }[] = [
    { group: 'オーク', label: '骨', unitType: 'orc_bone' },
    { group: 'オーク', label: '肉', unitType: 'orc_meat' },
    { group: 'オーク', label: '霊', unitType: 'orc_spirit' },
    { group: 'スケルトン', label: '骨', unitType: 'skeleton_bone' },
    { group: 'スケルトン', label: '肉', unitType: 'skeleton_meat' },
    { group: 'スケルトン', label: '霊', unitType: 'skeleton_spirit' },
    { group: 'ウィザード', label: '骨', unitType: 'wizard_bone' },
    { group: 'ウィザード', label: '肉', unitType: 'wizard_meat' },
    { group: 'ウィザード', label: '霊', unitType: 'wizard_spirit' },
    { group: 'ネクロマンサー', label: '骨', unitType: 'necromancer_bone' },
    { group: 'ネクロマンサー', label: '肉', unitType: 'necromancer_meat' },
    { group: 'ネクロマンサー', label: '霊', unitType: 'necromancer_spirit' },
    { group: 'ウィスプ', label: '骨', unitType: 'wisp_bone' },
    { group: 'ウィスプ', label: '肉', unitType: 'wisp_meat' },
    { group: 'ウィスプ', label: '霊', unitType: 'wisp_spirit' },
    { group: 'トークン', label: 'ゾンビ', unitType: 'zombie' },
];

const UNIT_GROUPS = Array.from(new Set(DEBUG_UNITS.map(u => u.group)));

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

const MATERIAL_COLORS: Record<string, string> = {
    '骨': '#aaaaaa',
    '肉': '#ff6666',
    '霊': '#aa66ff',
    'ゾンビ': '#446644',
};

const DebugPanel: React.FC = () => {
    const {
        summonedMonsters, addSummonedMonsters, clearSummonedMonsters,
        incomingEnemies, addIncomingEnemy, clearIncomingEnemies, generateWave,
        setPhase,
    } = useGame();

    const [debugDay, setDebugDay] = useState(1);
    const [selectedPattern, setSelectedPattern] = useState('random');
    const [patternIdx, setPatternIdx] = useState(0);

    // 自軍: 空きセルを探して配置 (col4→0 優先)
    const addUnit = (unitType: string) => {
        const used = new Set(summonedMonsters.map(u => `${u.r},${u.c}`));
        let pos: { r: number; c: number } | null = null;
        outer: for (let c = 4; c >= 0; c--) {
            for (let r = 0; r < ROWS; r++) {
                if (!used.has(`${r},${c}`)) { pos = { r, c }; break outer; }
            }
        }
        if (!pos) {
            // col 5-8 も試す
            outer2: for (let c = 5; c < COLS; c++) {
                for (let r = 0; r < ROWS; r++) {
                    if (!used.has(`${r},${c}`)) { pos = { r, c }; break outer2; }
                }
            }
        }
        if (!pos) return; // 盤面が満杯
        addSummonedMonsters([{
            id: `debug-unit-${Date.now()}-${Math.random()}`,
            type: unitType,
            attackBonus: 0,
            hpBonus: 0,
            r: pos.r,
            c: pos.c,
        }]);
    };

    // 敵: 個別追加
    const addEnemy = (type: HeroType) => {
        const idx = incomingEnemies.length;
        const col = Math.floor(idx / ROWS) % 9;
        const row = idx % ROWS;
        addIncomingEnemy({
            id: `debug-enemy-${Date.now()}-${Math.random()}`,
            type,
            row,
            col,
        });
    };

    const handlePatternChange = (dir: -1 | 1) => {
        const next = (patternIdx + dir + WAVE_PATTERNS.length) % WAVE_PATTERNS.length;
        setPatternIdx(next);
        setSelectedPattern(WAVE_PATTERNS[next].id);
    };

    const handleGenerateWave = () => {
        generateWave(debugDay, selectedPattern);
    };

    // スタイル定数
    const sectionHeader: React.CSSProperties = {
        fontSize: '11px', fontWeight: 'bold', color: '#ff9944',
        borderBottom: '1px solid #2a1040', paddingBottom: '4px', marginBottom: '6px',
        letterSpacing: '1px',
    };
    const smallBtn = (color: string): React.CSSProperties => ({
        background: color, color: '#fff', border: 'none',
        borderRadius: '3px', padding: '2px 6px', fontSize: '10px',
        cursor: 'pointer', fontWeight: 'bold',
    });
    const unitBtn = (matColor: string): React.CSSProperties => ({
        background: 'transparent',
        border: `1px solid ${matColor}`,
        color: matColor,
        borderRadius: '3px',
        padding: '2px 5px',
        fontSize: '10px',
        cursor: 'pointer',
        minWidth: '28px',
    });
    const enemyBtn: React.CSSProperties = {
        background: '#1a0a0a', border: '1px solid #664444',
        color: '#ffaaaa', borderRadius: '3px',
        padding: '2px 5px', fontSize: '10px',
        cursor: 'pointer',
    };

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

                {/* ── セクション1: 魔物配置 ── */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={sectionHeader}>👿 魔物配置 ({summonedMonsters.length}体)</div>
                        <button style={smallBtn('#550000')} onClick={clearSummonedMonsters}>全削除</button>
                    </div>
                    {UNIT_GROUPS.map(group => {
                        const units = DEBUG_UNITS.filter(u => u.group === group);
                        return (
                            <div key={group} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <span style={{ fontSize: '10px', color: '#aaa', width: '62px', flexShrink: 0, textAlign: 'right' }}>
                                    {group}
                                </span>
                                <div style={{ display: 'flex', gap: '3px' }}>
                                    {units.map(u => (
                                        <button
                                            key={u.unitType}
                                            style={unitBtn(MATERIAL_COLORS[u.label] ?? '#aaa')}
                                            onClick={() => addUnit(u.unitType)}
                                            title={u.unitType}
                                        >
                                            {u.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* ── セクション2: 敵設定 ── */}
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
                        <button
                            style={{ ...smallBtn('#221144'), padding: '2px 8px', fontSize: '12px' }}
                            onClick={() => handlePatternChange(-1)}
                        >◀</button>
                        <div style={{
                            flex: 1, textAlign: 'center', fontSize: '11px',
                            color: '#cc88ff', background: '#0d0820',
                            border: '1px solid #3a1050', borderRadius: '3px', padding: '3px 4px',
                        }}>
                            {WAVE_PATTERNS[patternIdx].label}
                        </div>
                        <button
                            style={{ ...smallBtn('#221144'), padding: '2px 8px', fontSize: '12px' }}
                            onClick={() => handlePatternChange(1)}
                        >▶</button>
                    </div>

                    <button
                        style={{
                            width: '100%', background: 'linear-gradient(to bottom, #440066, #220033)',
                            color: '#cc88ff', border: '1px solid #660099', borderRadius: '4px',
                            padding: '5px', fontSize: '11px', cursor: 'pointer', marginBottom: '8px',
                            fontWeight: 'bold',
                        }}
                        onClick={handleGenerateWave}
                    >
                        🌊 パターン生成
                    </button>

                    {/* 個別敵追加 */}
                    <div style={{ fontSize: '10px', color: '#888', marginBottom: '4px' }}>── 個別追加 ──</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {HERO_ROSTER.map(type => (
                            <button
                                key={type}
                                style={enemyBtn}
                                onClick={() => addEnemy(type)}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* フッター：アクションボタン */}
            <div style={{
                flexShrink: 0, padding: '8px 10px',
                borderTop: '1px solid #2a1040',
                background: '#0a0812',
                display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
                <button
                    style={{
                        width: '100%',
                        background: 'linear-gradient(to bottom, #aa0000, #660000)',
                        color: '#fff', border: 'none', borderRadius: '5px',
                        padding: '8px', fontSize: '14px', cursor: 'pointer',
                        fontWeight: 'bold', letterSpacing: '1px',
                    }}
                    onClick={() => setPhase('BATTLE')}
                >
                    ⚔️ 戦闘開始
                </button>
                <button
                    style={{
                        width: '100%',
                        background: '#111', color: '#888',
                        border: '1px solid #333', borderRadius: '4px',
                        padding: '5px', fontSize: '11px', cursor: 'pointer',
                    }}
                    onClick={() => {
                        clearSummonedMonsters();
                        clearIncomingEnemies();
                    }}
                >
                    🔄 全リセット
                </button>
            </div>
        </div>
    );
};

export default DebugPanel;
