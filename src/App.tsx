import React from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import BattlePhase from './components/BattlePhase';
import ResponsiveWrapper from './components/ResponsiveWrapper';
import './App.css';

const GameController: React.FC = () => {
  const { phase, setPhase, resetGame, isDebugMode, setIsDebugMode, unlockRecipe, addEquippedRecipe } = useGame();

  // スケルトン・ゴブリン・ウィスプを固定初期レシピとして装備
  const startNormalGame = () => {
    setIsDebugMode(false);
    ['skeleton', 'goblin', 'wisp'].forEach(id => {
      unlockRecipe(id);
      addEquippedRecipe(id);
    });
    setPhase('RITUAL');
  };

  const startDebugMode = () => {
    setIsDebugMode(true);
    [
      'goblin', 'skeleton', 'archer', 'orc', 'lich', 'cerberus', 'imp', 'banshee',
      'wisp', 'necromancer', 'minotaur', 'ghoul', 'gargoyle',
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
          <div style={{ display: 'flex', gap: '24px', justifyContent: 'center' }}>
            <button className="start-btn" onClick={startNormalGame}>ローグライク</button>
            <button className="start-btn debug-btn" onClick={startDebugMode}>デバッグ</button>
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
