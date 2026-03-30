import React, { useState } from 'react';
import { useGame } from '../contexts/GameContext';
import DefensePhase from './DefensePhase';
import RitualPhase from './RitualPhase';
import DebugPanel from './DebugPanel';

const LEFT_PANEL_WIDTH = 130;
const RIGHT_PANEL_WIDTH = 130;


const MAX_WAVES = 1;

const BattlePhase: React.FC = () => {
    const { phase, fieldWidth, incomingEnemies, isDebugMode } = useGame();
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!scrollContainerRef.current) return;
        if (phase === 'RITUAL') {
            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
    }, [phase]);

    const [uiState, setUiState] = useState({
        wave: 0,
        demonCount: 0,
        heroCount: 0,
        nextWaveIn: 0,
        killCount: 0,
    });

    const totalEnemies = incomingEnemies.length;

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
            backgroundColor: '#050508', color: '#ccc'
        }}>
            {/* メインエリア */}
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                {/* 儀式左パネルスロット（スクロール外・自陣の左） */}
                <div
                    style={{
                        width: `${LEFT_PANEL_WIDTH}px`,
                        flexShrink: 0,
                        overflow: 'hidden',
                        height: '100%',
                        background: '#08060f',
                        borderRight: '2px solid #2a1040',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {phase === 'RITUAL' && isDebugMode
                        ? <DebugPanel />
                        : phase === 'RITUAL'
                            ? <div id="ritual-panel-slot" style={{ width: '100%', height: '100%' }} />
                            : <div style={{ padding: '14px 12px', color: '#ccc', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ color: '#ff6666', fontWeight: 'bold', fontSize: '16px', borderBottom: '1px solid #2a1040', paddingBottom: '6px' }}>⚔️ 戦況</div>
                                <div>🌊 WAVE {uiState.wave} / {MAX_WAVES}</div>
                                <div style={{ color: '#aaffaa' }}>👿 自軍: {uiState.demonCount}</div>
                                <div style={{ color: '#ffaaaa' }}>🗡️ 敵軍: {uiState.heroCount}</div>
                                <div style={{ color: '#ff88ff' }}>💀 撃破: {uiState.killCount}</div>
                                {uiState.nextWaveIn > 0 && uiState.wave < MAX_WAVES && (
                                    <div style={{ color: '#ffff44' }}>次WAVE: {uiState.nextWaveIn.toFixed(1)}s</div>
                                )}
                            </div>
                    }
                </div>

                {/* 戦闘フィールド（常時描画・横スクロール可） */}
                <div
                    ref={scrollContainerRef}
                    className="battle-scroll-container"
                    style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', position: 'relative' }}
                >
                    <div style={{ width: `${fieldWidth}px`, height: '100%', position: 'relative' }}>
                        <DefensePhase onStateChange={setUiState} />
                    </div>

                    {/* 儀式フェーズ：コンボ演出オーバーレイ */}
                    {phase === 'RITUAL' && (
                        <div style={{
                            position: 'absolute', left: 0, top: 0,
                            width: '100%', height: '100%',
                            zIndex: 10, pointerEvents: 'none'
                        }}>
                            <RitualPhase />
                        </div>
                    )}
                </div>

                {/* 儀式右パネル（報酬・出撃先選択） */}
                {phase === 'RITUAL' && (
                    <div
                        style={{
                            width: `${RIGHT_PANEL_WIDTH}px`,
                            flexShrink: 0,
                            overflow: 'hidden',
                            height: '100%',
                            background: '#08060f',
                            borderLeft: '2px solid #2a1040',
                            display: 'flex',
                            flexDirection: 'column',
                        }}
                    >
                        <div id="ritual-right-panel-slot" style={{ width: '100%', height: '100%' }} />
                    </div>
                )}
            </div>

            {/* 儀式アクションバー（APゲージ・召喚・スキル） */}
            {phase === 'RITUAL' && (
                <div style={{
                    height: '110px', flexShrink: 0,
                    display: 'flex', background: '#0a0812',
                    borderTop: '1px solid #2a1040'
                }}>
                    {/* 左パネル下部スロット */}
                    <div id="ritual-panel-bottom-slot" style={{ width: `${LEFT_PANEL_WIDTH}px`, flexShrink: 0, borderRight: '2px solid #2a1040', overflow: 'hidden' }} />
                    {/* アクションコンテンツ（残り全幅） */}
                    <div id="ritual-bottom-slot" style={{ flex: 1, overflow: 'hidden' }} />
                    {/* 右パネル下部（幅合わせ） */}
                    <div style={{ width: `${RIGHT_PANEL_WIDTH}px`, flexShrink: 0, borderLeft: '2px solid #2a1040' }} />
                </div>
            )}

            {/* 下部ステータスバー（コンパクト） */}
            <div style={{
                height: '36px', flexShrink: 0,
                background: '#0c080f', borderTop: '1px solid #2a1030',
                display: 'flex', alignItems: 'center',
                padding: '0 14px', gap: '18px',
                fontSize: '12px', whiteSpace: 'nowrap', overflowX: 'auto'
            }}>
<span style={{ color: '#ff7777' }}>
                    👿 敵: <span style={{ fontWeight: 'bold' }}>{uiState.heroCount}</span>
                    <span style={{ color: '#664444' }}> / {totalEnemies}</span>
                </span>
                <span style={{ color: '#ff8888' }}>撃破: {uiState.killCount}</span>
                {uiState.nextWaveIn > 0 && uiState.wave < MAX_WAVES && (
                    <span style={{ color: '#ffff55' }}>次WAVE: {uiState.nextWaveIn.toFixed(1)}s</span>
                )}
                {uiState.wave >= MAX_WAVES && uiState.heroCount === 0 && uiState.wave > 0 && (
                    <span style={{ color: '#44ffcc', fontWeight: 'bold' }}>⚔ 全WAVE撃退！</span>
                )}
            </div>
        </div>
    );
};

export default BattlePhase;
