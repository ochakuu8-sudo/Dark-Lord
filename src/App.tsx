import React from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import BattlePhase from './components/BattlePhase';
import ResponsiveWrapper from './components/ResponsiveWrapper';
import { ALL_RECIPES, type Recipe } from './game/config';
import './App.css';

// コモンレシピを素材種別ごとに分類
const getMainMaterial = (recipe: Recipe): 0 | 1 | 2 => {
  const counts = [0, 0, 0];
  recipe.pattern.flat().forEach(v => { if (v >= 0 && v <= 2) counts[v]++; });
  return counts.indexOf(Math.max(...counts)) as 0 | 1 | 2;
};

const COMMON_RECIPES = ALL_RECIPES.filter(r => r.rarity === 'common');

const GameController: React.FC = () => {
  const { phase, setPhase, resetGame, isDebugMode, setIsDebugMode, unlockRecipe, addEquippedRecipe } = useGame();
  // 骨/肉/霊から各1枚ランダムに選んで即装備
  const startNormalGame = () => {
    setIsDebugMode(false);
    const byMat: Record<number, Recipe[]> = { 0: [], 1: [], 2: [] };
    COMMON_RECIPES.forEach(r => byMat[getMainMaterial(r)].push(r));
    ([0, 1, 2] as const).forEach(mat => {
      const pool = byMat[mat];
      const recipe = pool[Math.floor(Math.random() * pool.length)];
      if (recipe) { unlockRecipe(recipe.id); addEquippedRecipe(recipe.id); }
    });
    setPhase('RITUAL');
  };

  const startDebugMode = () => {
    setIsDebugMode(true);
    ['orc', 'archer', 'wizard', 'necromancer', 'wisp', 'skeleton', 'cerberus', 'wraith'].forEach(id => {
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
