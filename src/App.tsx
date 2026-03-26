import React, { useState, useMemo } from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import BattlePhase from './components/BattlePhase';
import ResponsiveWrapper from './components/ResponsiveWrapper';
import { ALL_RECIPES, COLOR_HEX, PIECE_EMOJIS, RARITY_COLOR, RARITY_LABEL, type Recipe } from './game/config';
import './App.css';

// コモンレシピを素材種別ごとに分類
const getMainMaterial = (recipe: Recipe): 0 | 1 | 2 => {
  const counts = [0, 0, 0];
  recipe.pattern.flat().forEach(v => { if (v >= 0 && v <= 2) counts[v]++; });
  return counts.indexOf(Math.max(...counts)) as 0 | 1 | 2;
};

const COMMON_RECIPES = ALL_RECIPES.filter(r => r.rarity === 'common');
const MATERIAL_LABEL: Record<0 | 1 | 2, string> = { 0: '骨', 1: '肉', 2: '霊' };

const GameController: React.FC = () => {
  const { phase, setPhase, resetGame, isDebugMode, setIsDebugMode, unlockRecipe, addEquippedRecipe } = useGame();
  const [showStartDraft, setShowStartDraft] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  // 骨/肉/霊から各1枚ランダムに選ぶ
  const draftChoices = useMemo(() => {
    if (!showStartDraft) return [];
    const byMat: Record<number, Recipe[]> = { 0: [], 1: [], 2: [] };
    COMMON_RECIPES.forEach(r => byMat[getMainMaterial(r)].push(r));
    return ([0, 1, 2] as const).map(mat => {
      const pool = byMat[mat];
      return pool[Math.floor(Math.random() * pool.length)];
    }).filter(Boolean) as Recipe[];
  }, [showStartDraft]);

  const handleStartDraft = () => {
    setIsDebugMode(false);
    setSelected([]);
    setShowStartDraft(true);
  };

  const handlePickRecipe = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleConfirmDraft = () => {
    selected.forEach(id => { unlockRecipe(id); addEquippedRecipe(id); });
    setShowStartDraft(false);
    setPhase('RITUAL');
  };

  const startDebugMode = () => {
    setIsDebugMode(true);
    ['orc', 'skeleton', 'wizard', 'necromancer', 'wisp', 'gargoyle', 'cerberus', 'wraith'].forEach(id => {
      unlockRecipe(id);
      addEquippedRecipe(id);
    });
    setPhase('RITUAL');
  };

  return (
    <div className="game-wrapper">
      {phase === 'TITLE' && !showStartDraft && (
        <div className="title-screen">
          <h1>魔王軍の防衛儀式</h1>
          <p>パズルで魔物を召喚し、迫りくる勇者を撃退せよ</p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="start-btn" onClick={handleStartDraft}>ゲーム開始</button>
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

      {/* スタートドラフト画面 */}
      {showStartDraft && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(4,2,12,0.98)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '24px', gap: '20px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#554466', letterSpacing: '4px' }}>START</div>
            <div style={{ fontSize: '22px', color: '#ccaaff', fontWeight: 'bold', letterSpacing: '3px' }}>初期レシピを選択</div>
            <div style={{ fontSize: '11px', color: '#664488', marginTop: '4px' }}>3枚から2枚を選んでください</div>
          </div>

          <div style={{ display: 'flex', gap: '16px', width: '100%', maxWidth: '780px' }}>
            {draftChoices.map(recipe => {
              const isPicked = selected.includes(recipe.id);
              const isDisabled = selected.length >= 2 && !isPicked;
              const matColor = ['#cccccc', '#ff8888', '#cc88ff'][getMainMaterial(recipe)];
              const rarityCol = RARITY_COLOR[recipe.rarity];
              return (
                <div
                  key={recipe.id}
                  onClick={() => { if (!isDisabled) handlePickRecipe(recipe.id); }}
                  style={{
                    flex: 1, background: isPicked ? '#0a1a0a' : '#0e0820',
                    border: `2px solid ${isPicked ? '#44aa44' : isDisabled ? '#221133' : matColor + '88'}`,
                    borderRadius: '14px', padding: '20px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    cursor: isDisabled ? 'default' : 'pointer',
                    opacity: isDisabled ? 0.35 : 1,
                    transition: 'border-color 0.12s, opacity 0.12s',
                  }}
                >
                  {/* 素材ラベル */}
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: matColor,
                    background: matColor + '22', border: `1px solid ${matColor}66`,
                    borderRadius: '4px', padding: '2px 10px', letterSpacing: '2px' }}>
                    {MATERIAL_LABEL[getMainMaterial(recipe)]}素材
                  </div>
                  {/* レシピ名 + レア度 */}
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: isPicked ? '#88ff88' : '#fff' }}>
                    {isPicked && '✓ '}{recipe.name}
                  </div>
                  <div style={{ fontSize: '10px', color: rarityCol, background: rarityCol + '22',
                    border: `1px solid ${rarityCol}66`, borderRadius: '4px', padding: '1px 8px' }}>
                    {RARITY_LABEL[recipe.rarity]}
                  </div>
                  {/* パターン */}
                  <div style={{ display: 'grid', gap: '3px', gridTemplateColumns: `repeat(${recipe.pattern[0].length}, 24px)` }}>
                    {recipe.pattern.map((row, ri) => row.map((val, ci) => (
                      <div key={`${ri}-${ci}`} style={{
                        width: 24, height: 24, borderRadius: 4,
                        backgroundColor: val === -1 ? 'transparent' : val === 9 ? '#2a1a3a' : COLOR_HEX[val] ?? '#333',
                        border: val !== -1 ? '1px solid #444' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      }}>{val === 9 ? '❓' : val >= 0 ? PIECE_EMOJIS[val] : ''}</div>
                    )))}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleConfirmDraft}
            disabled={selected.length < 2}
            style={{
              padding: '11px 48px',
              background: selected.length >= 2 ? 'linear-gradient(135deg, #2a0808, #5a1212)' : '#100c18',
              color: selected.length >= 2 ? '#ffaaaa' : '#442233',
              border: `1px solid ${selected.length >= 2 ? '#662222' : '#220011'}`,
              borderRadius: '8px', fontSize: '13px', fontWeight: 'bold',
              cursor: selected.length >= 2 ? 'pointer' : 'not-allowed', letterSpacing: '2px',
            }}>
            {selected.length >= 2 ? '⚔️ 儀式を開始する' : `あと${2 - selected.length}枚選択してください`}
          </button>
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
