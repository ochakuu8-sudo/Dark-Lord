import React from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import BattlePhase from './components/BattlePhase';
import ResponsiveWrapper from './components/ResponsiveWrapper';
import './App.css';

const GameController: React.FC = () => {
  const { phase, setPhase, resetGame, isDebugMode, setIsDebugMode, unlockRecipe, addEquippedRecipe } = useGame();

  // ゴブリン3種を固定初期レシピとして装備
  const startNormalGame = () => {
    setIsDebugMode(false);
    ['goblin_bone', 'goblin_meat', 'goblin_spirit'].forEach(id => {
      unlockRecipe(id);
      addEquippedRecipe(id);
    });
    setPhase('RITUAL');
  };

  const startDebugMode = () => {
    setIsDebugMode(true);
    [
      'skeleton_bone', 'skeleton_meat', 'skeleton_spirit',
      'orc_bone', 'orc_meat', 'orc_spirit',
      'archer_bone', 'archer_meat', 'archer_spirit',
      'cerberus_bone', 'cerberus_meat', 'cerberus_spirit',
      'lich_bone', 'lich_meat', 'lich_spirit',
      'wisp',
      'necromancer', 'minotaur', 'ghoul',
    ].forEach(id => {
      unlockRecipe(id);
      addEquippedRecipe(id);
    });
    setPhase('RITUAL');
  };

  return (
    <div className="game-wrapper">
      {phase === 'TITLE' && (
        <div className="title-screen">
          <h1>魔王軍の防衛儀式</h1>
          <p>パズルで魔物を召喚し、迫りくる勇者を撃退せよ</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="start-btn" onClick={startNormalGame}>ゲーム開始</button>
            <button
              className="start-btn"
              onClick={startDebugMode}
              style={{ background: 'linear-gradient(135deg, #006600, #003300)', borderColor: '#0f0', fontSize: '22px', padding: '20px 40px' }}
            >
              🔧 デバッグモード
            </button>
          </div>
        </div>
      )}

      {(phase === 'RITUAL' || phase === 'BATTLE') && <BattlePhase />}
      {phase === 'RESULT' && (
        <div className="result-screen">
          <h1>{isDebugMode ? '戦闘終了' : '拠点陥落...'}</h1>
          <p>{isDebugMode ? 'デバッグ戦闘が終了しました。' : '魔王の城は勇者たちの手に落ちた。'}</p>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {isDebugMode && (
              <button
                className="restart-btn"
                style={{ background: 'linear-gradient(135deg, #006600, #003300)', borderColor: '#0f0', fontSize: '20px' }}
                onClick={() => { setIsDebugMode(true); setPhase('RITUAL'); }}
              >
                🔧 デバッグに戻る
              </button>
            )}
            <button className="restart-btn" onClick={() => { resetGame(); setPhase('TITLE'); }}>タイトルへ</button>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <GameProvider>
      <ResponsiveWrapper logicalWidth={1240} logicalHeight={636}>
        <GameController />
      </ResponsiveWrapper>
    </GameProvider>
  );
}

export default App;
