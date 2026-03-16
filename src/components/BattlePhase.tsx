import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import DefensePhase from './DefensePhase';

const MAX_WAVES = 4;

const BattlePhase: React.FC = () => {
    const { currentDay, gold, setPhase } = useGame();

    const [uiState, setUiState] = useState({
        baseHp: 0,
        maxBaseHp: 0,
        wave: 0,
        demonCount: 0,
        heroCount: 0,
        nextWaveIn: 0,
        killCount: 0,
    });

    return (
        <div style={{ 
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%', 
            backgroundColor: '#050508', color: '#ccc' 
        }}>
            {/* 上部ステータスバー */}
            <div style={{ 
                height: '60px', display: 'flex', alignItems: 'center', gap: '20px', 
                padding: '0 24px', background: '#12080f', borderBottom: '2px solid #401010',
                fontSize: '14px', flexShrink: 0
            }}>
                <div style={{ color: '#ff6666', fontWeight: 'bold', fontSize: '18px' }}>Day {currentDay}</div>
                <div style={{ color: '#ffd700', fontWeight: 'bold' }}>💰 {gold} G</div>
                <div style={{ 
                    color: (uiState.baseHp / uiState.maxBaseHp) > 0.5 ? '#44ff88' : '#ff3333',
                    minWidth: '150px'
                }}>
                    自拠点 HP: {uiState.baseHp} / {uiState.maxBaseHp}
                </div>
                <div style={{ minWidth: '100px' }}>WAVE {uiState.wave} / {MAX_WAVES}</div>
                <div style={{ color: '#aaffaa' }}>自軍: {uiState.demonCount}</div>
                <div style={{ color: '#ffaaaa' }}>敵軍: {uiState.heroCount}</div>
                <div style={{ color: '#ff88ff' }}>撃破: {uiState.killCount}</div>
                
                {uiState.nextWaveIn > 0 && uiState.wave < MAX_WAVES && (
                    <div style={{ color: '#ffff44', marginLeft: '20px' }}>
                        次WAVE襲来まで: {uiState.nextWaveIn.toFixed(1)}s
                    </div>
                )}

                {uiState.wave >= MAX_WAVES && uiState.heroCount === 0 && (
                    <div style={{ color: '#44ffff', fontWeight: 'bold', marginLeft: '20px' }}>
                        ⚔ 全WAVE撃退成功！
                    </div>
                )}

                <button 
                    onClick={() => { if(confirm("戦闘を中断しますか？")) setPhase('PREPARATION'); }}
                    style={{ 
                        marginLeft: 'auto', background: '#333', color: '#aaa', 
                        border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' 
                    }}
                >
                    撤退
                </button>
            </div>

            {/* メイン戦闘エリア */}
            <div style={{ 
                flex: 1, position: 'relative', display: 'flex', 
                justifyContent: 'center', alignItems: 'center', backgroundColor: '#000'
            }}>
                <DefensePhase
                    onStateChange={setUiState}
                />
            </div>

            {/* 下部メッセージエリア（オプション：戦況ログなどを流してもよい） */}
            <div style={{ 
                height: '40px', background: '#0a0a0f', borderTop: '1px solid #222', 
                display: 'flex', alignItems: 'center', padding: '0 20px', color: '#555', fontSize: '12px'
            }}>
                勇者達が魔王城に迫っています！召喚した軍勢で防衛してください。
            </div>
        </div>
    );
};

export default BattlePhase;
