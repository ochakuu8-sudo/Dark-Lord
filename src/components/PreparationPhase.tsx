import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import {
    COLOR_HEX, ALL_RECIPES, RELICS
} from '../game/config';
import type { Relic, Recipe } from '../game/config';

const PreparationPhase: React.FC = () => {
    const {
        setPhase,
        currentDay, gold, spendGold,
        unlockedRecipes, unlockRecipe,
        ownedRelics, addRelic, generateWave,
        refillAp, ap, maxAp
    } = useGame();

    const [shopRelics, setShopRelics] = useState<Relic[]>([]);
    const [shopRecipes, setShopRecipes] = useState<Recipe[]>([]);

    useEffect(() => {
        generateWave(currentDay);
        refillAp(); // Dayごとにapを付与
        
        // 日が変わるごとにラインナップを更新
        const unownedRelics = RELICS.filter(r => !ownedRelics.includes(r.id));
        const shuffledRelics = [...unownedRelics].sort(() => 0.5 - Math.random());
        setShopRelics(shuffledRelics.slice(0, 3));

        const lockedRecipes = ALL_RECIPES.filter(r => !unlockedRecipes.includes(r.id));
        const shuffledRecipes = [...lockedRecipes].sort(() => 0.5 - Math.random());
        setShopRecipes(shuffledRecipes.slice(0, 2));
    }, [currentDay]); // Only day change triggers reshuffle






    const handleBuyRelic = (relicId: string, price: number) => {
        if (spendGold(price)) {
            addRelic(relicId);
        } else {
            alert('ゴールドが足りません');
        }
    };

    const handleBuyRecipe = (recipeId: string, price: number) => {
        if (spendGold(price)) {
            unlockRecipe(recipeId);
            setShopRecipes(prev => prev.filter(r => r.id !== recipeId)); // 即座にショップから消す
        } else {
            alert('ゴールドが足りません');
        }
    };

    const renderPatternGrid = (pattern: number[][]) => {
        const pCols = pattern[0].length;
        return (
            <div style={{ display: 'grid', gap: '3px', gridTemplateColumns: `repeat(${pCols}, 20px)` }}>
                {pattern.map((rowArr, ri) => rowArr.map((val, ci) => {
                    let color = 'transparent';
                    if (val === 0) color = COLOR_HEX[0]; // 骨
                    else if (val === 1) color = COLOR_HEX[1]; // 肉
                    else if (val === 2) color = COLOR_HEX[2]; // 霊
                    else if (val === 9) color = '#888'; // X
                    
                    return (
                        <div key={`${ri}-${ci}`} style={{
                            width: 20, height: 20, borderRadius: 3,
                            backgroundColor: color,
                            border: val !== -1 ? '1px solid #555' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', color: '#fff', fontWeight: 'bold'
                        }}>
                            {val === 9 ? 'X' : ''}
                        </div>
                    );
                }))}
            </div>
        );
    };

    return (
        <div className="title-screen" style={{ 
            display: 'flex', flexDirection: 'column', padding: '30px', alignItems: 'center',
            maxWidth: '1400px', width: '90%', maxHeight: '90%', overflowY: 'auto' 
        }}>
            <h2>準備フェーズ (Day {currentDay})</h2>
            <div style={{ color: '#ffd700', fontSize: '24px', margin: '10px 0', fontWeight: 'bold' }}>
                所持ゴールド: {gold} G
            </div>
            <div style={{
                background: 'linear-gradient(90deg, #1a1a2a, #2a2a4a, #1a1a2a)',
                padding: '10px 20px', borderRadius: '8px', marginBottom: '10px',
                color: '#aaddff', fontSize: '16px', textAlign: 'center',
                border: '1px solid #4a4a8a'
            }}>
                ⚡ AP: {ap} / {maxAp} （儀式フェーズでAPを使って素材を召喚できます）
            </div>

            <div style={{ 
                display: 'flex', 
                flexDirection: window.innerWidth < 1000 ? 'column' : 'row',
                gap: '20px', 
                width: '100%', 
                maxWidth: '1200px', 
                justifyContent: 'center' 
            }}>

                {/* Unlocked Recipes (Grimoire) */}
                <div style={{ flex: 1.5, backgroundColor: '#222', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px', color: '#ffbfff' }}>召喚魔導書 (所持レシピ)</h3>
                    <div style={{ color: '#aaa', fontSize: '13px' }}>現在習得している召喚術の全リストだ。これら全てが儀式で有効になる。</div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', overflowY: 'auto', maxHeight: '500px' }}>
                        {ALL_RECIPES.filter(r => unlockedRecipes.includes(r.id)).map(recipe => {
                            return (
                                <div key={recipe.id} style={{
                                    backgroundColor: '#333', padding: '15px', borderRadius: '8px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        {renderPatternGrid(recipe.pattern)}
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#ffbfff' }}>{recipe.name}</div>
                                            <div style={{ fontSize: '13px', color: '#ccc' }}>消費: {recipe.reward} AP</div>
                                        </div>
                                    </div>
                                    <div style={{ color: '#448844', fontSize: '14px', fontWeight: 'bold' }}>習得済</div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Shop Tab */}
                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Recipes Shop */}
                    <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '10px' }}>
                        <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px', color: '#88ccff' }}>召喚術の模索 (レシピ購入)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            {shopRecipes.map(recipe => (
                                <div key={recipe.id} style={{
                                    backgroundColor: '#333', padding: '16px', borderRadius: '8px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                                        {renderPatternGrid(recipe.pattern)}
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#ffbfff' }}>{recipe.name}</div>
                                            <div style={{ color: '#ffd700', fontSize: '15px' }}>{recipe.price} G</div>
                                        </div>
                                    </div>
                                    <button
                                        className="start-btn"
                                        style={{ padding: '10px 20px', backgroundColor: (gold >= (recipe.price || 0)) ? '#448844' : '#555' }}
                                        onClick={() => handleBuyRecipe(recipe.id, recipe.price || 0)}
                                        disabled={gold < (recipe.price || 0)}
                                    >
                                        購入
                                    </button>
                                </div>
                            ))}
                            {shopRecipes.length === 0 && (
                                <div style={{ textAlign: 'center', color: '#888', padding: '10px' }}>新しい召喚術は見つかりませんでした</div>
                            )}
                        </div>
                    </div>

                    {/* Passive Shop */}
                    <div style={{ backgroundColor: '#222', padding: '20px', borderRadius: '10px' }}>
                        <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px', color: '#ffcc44' }}>闇の遺物屋 (パッシブ強化)</h3>
                        {shopRelics.map(relic => (
                            <div key={relic.id} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                backgroundColor: '#333', padding: '12px', borderRadius: '8px', marginTop: '10px'
                            }}>
                                <div style={{ flex: 1, marginRight: '10px' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#ffbfff' }}>{relic.icon} {relic.name}</div>
                                    <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{relic.description}</div>
                                    <div style={{ color: '#ffd700', marginTop: '2px', fontSize: '13px' }}>{relic.price} G</div>
                                </div>
                                <button
                                    className="start-btn"
                                    style={{ padding: '8px 16px', backgroundColor: (gold >= relic.price) ? '#6622aa' : '#555' }}
                                    onClick={() => handleBuyRelic(relic.id, relic.price)}
                                    disabled={gold < relic.price}
                                >
                                    購入
                                </button>
                            </div>
                        ))}
                        {shopRelics.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#888', marginTop: '10px' }}>すべての遺物を取得済みです</div>
                        )}
                    </div>
                </div>


            </div>

            <button
                className="start-btn"
                style={{ marginTop: '40px', fontSize: '24px', padding: '15px 40px', backgroundColor: '#990000' }}
                onClick={() => setPhase('RITUAL')}
            >
                儀式開始
            </button>
        </div >
    );
};

export default PreparationPhase;
