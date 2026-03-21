import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import { BOARD_WIDTH } from '../game/config';
import DefensePhase from './DefensePhase';
import RitualPhase from './RitualPhase';


const MAX_WAVES = 1;

const BattlePhase: React.FC = () => {
    const { currentDay, gold, setPhase, phase, fieldWidth } = useGame();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (phase === 'BATTLE' && scrollContainerRef.current) {
            // No auto-scroll as it's unified now, but we can ensure it's at 0 if preferred
            // scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        } else if (phase === 'RITUAL' && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                left: 0,
                behavior: 'smooth'
            });
        }
    }, [phase]);

    const [uiState, setUiState] = useState({
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
                height: window.innerWidth < 800 ? '45px' : '60px',
                display: 'flex', alignItems: 'center',
                gap: window.innerWidth < 800 ? '10px' : '20px',
                padding: window.innerWidth < 800 ? '0 10px' : '0 24px',
                background: '#12080f', borderBottom: '2px solid #401010',
                fontSize: window.innerWidth < 800 ? '11px' : '14px',
                flexShrink: 0,
                overflowX: 'auto', whiteSpace: 'nowrap'
            }}>
                <div style={{ color: '#ff6666', fontWeight: 'bold', fontSize: '18px' }}>Day {currentDay}</div>
                <div style={{ color: '#ffd700', fontWeight: 'bold' }}>💰 {gold} G</div>
                <div style={{ minWidth: '100px' }}>WAVE {uiState.wave} / {MAX_WAVES}</div>
                <div style={{ color: '#aaffaa' }}>自軍: {uiState.demonCount}</div>
                <div style={{ color: '#ffaaaa' }}>敵軍: {uiState.heroCount}</div>
                <div style={{ color: '#ff88ff' }}>撃破: {uiState.killCount}</div>

                {uiState.nextWaveIn > 0 && uiState.wave < MAX_WAVES && (
                    <div style={{ color: '#ffff44', marginLeft: '20px' }}>
                        次WAVE襲来まで: {uiState.nextWaveIn.toFixed(1)}s
                    </div>
                )}

                {uiState.wave >= MAX_WAVES && uiState.heroCount === 0 && uiState.wave > 0 && (
                    <div style={{ color: '#44ffff', fontWeight: 'bold', marginLeft: '20px' }}>
                        ⚔ 全WAVE撃退成功！
                    </div>
                )}

                <button
                    onClick={() => { if (confirm("戦闘を中断しますか？")) setPhase('PREPARATION'); }}
                    style={{
                        marginLeft: 'auto', background: '#333', color: '#aaa',
                        border: '1px solid #444', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer'
                    }}
                >
                    撤退
                </button>
            </div>

            {/* メインエリア */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {/* 戦闘フィールド（横スクロール可、常時描画） */}
                <div
                    ref={scrollContainerRef}
                    style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'hidden' }}
                >
                    <div style={{ width: `${fieldWidth}px`, height: '100%', position: 'relative' }}>
                        <DefensePhase onStateChange={setUiState} />
                    </div>
                </div>

                {/* 儀式（パズル）フェーズ - 戦場左端に固定オーバーレイ */}
                {phase === 'RITUAL' && (
                    <div style={{
                        position: 'absolute', left: 0, top: 0,
                        width: `${BOARD_WIDTH}px`, height: '100%',
                        zIndex: 10
                    }}>
                        <RitualPhase />
                    </div>
                )}
            </div>

            {/* 下部メッセージエリア（オプション：戦況ログなどを流してもよい） */}
            <div style={{
                height: window.innerWidth < 800 ? '30px' : '40px',
                background: '#0a0a0f', borderTop: '1px solid #222',
                display: 'flex', alignItems: 'center', padding: '0 20px',
                color: '#555', fontSize: window.innerWidth < 800 ? '10px' : '12px'
            }}>
                勇者達が魔王城に迫っています！召喚した軍勢で防衛してください。
            </div>
        </div>
    );
};

export default BattlePhase;
