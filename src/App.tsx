import React from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import BattlePhase from './components/BattlePhase';
import ResponsiveWrapper from './components/ResponsiveWrapper';
import './App.css';

const GameController: React.FC = () => {
  const { phase, setPhase, resetGame } = useGame();

  return (
    <div className="game-wrapper">
      {phase === 'TITLE' && (
        <div className="title-screen">
          <h1>魔王軍の防衛儀式</h1>
          <p>パズルで魔物を召喚し、迫りくる勇者を撃退せよ</p>
          <button className="start-btn" onClick={() => setPhase('RITUAL')}>ゲーム開始</button>
        </div>
      )}
      {(phase === 'RITUAL' || phase === 'BATTLE') && <BattlePhase />}
      {phase === 'RESULT' && (
        <div className="result-screen">
          <h1>拠点陥落...</h1>
          <p>魔王の城は勇者たちの手に落ちた。</p>
          <button className="restart-btn" onClick={() => { resetGame(); setPhase('TITLE'); }}>もう一度最初から</button>
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
