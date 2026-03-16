import React, { useState, useEffect } from 'react';
import { useGame } from '../contexts/GameContext';
import {
    COLOR_HEX, ALL_RECIPES, RELICS
} from '../game/config';
import type { Relic } from '../game/config';

const PreparationPhase: React.FC = () => {
    const {
        setPhase,
        currentDay, gold, spendGold,
        unlockedRecipes, equippedRecipes, equipRecipe,
        ownedRelics, addRelic
    } = useGame();

    const [shopRelics, setShopRelics] = useState<Relic[]>([]);

    useEffect(() => {
        // フェーズ（日）が変わるごとにランダムな3つのレリック（未所持のもの優先）をショップに並べる
        const unowned = RELICS.filter(r => !ownedRelics.includes(r.id));
        const shuffled = [...unowned].sort(() => 0.5 - Math.random());
        setShopRelics(shuffled.slice(0, 3));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDay]);





    const handleToggleRecipeEquip = (recipeId: string) => {
        const equippedIndex = equippedRecipes.indexOf(recipeId);
        if (equippedIndex !== -1) {
            // Unequip
            equipRecipe(equippedIndex, null);
        } else {
            // Equip to first empty slot
            const emptySlotIndex = equippedRecipes.indexOf(null);
            if (emptySlotIndex !== -1) {
                // slot available
                equipRecipe(emptySlotIndex, recipeId);
            } else {
                // slot full
                alert('装備枠が一杯です。どれかを外してください。');
            }
        }
    };

    const handleBuyRelic = (relicId: string, price: number) => {
        if (spendGold(price)) {
            addRelic(relicId);
        } else {
            alert('ゴールドが足りません');
        }
    };

    const renderPatternGrid = (pattern: number[][]) => {
        const pCols = pattern[0].length;
        return (
            <div style={{ display: 'grid', gap: '2px', gridTemplateColumns: `repeat(${pCols}, 14px)` }}>
                {pattern.map((rowArr, ri) => rowArr.map((val, ci) => {
                    let color = 'transparent';
                    if (val === 0) color = COLOR_HEX[0]; // 骨
                    else if (val === 1) color = COLOR_HEX[1]; // 肉
                    else if (val === 2) color = COLOR_HEX[2]; // 霊
                    else if (val === 9) color = '#888'; // X
                    
                    return (
                        <div key={`${ri}-${ci}`} style={{
                            width: 14, height: 14, borderRadius: 2,
                            backgroundColor: color,
                            border: val !== -1 ? '1px solid #555' : 'none',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '10px', color: '#fff', fontWeight: 'bold'
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
            <div style={{ color: '#ffd700', fontSize: '24px', margin: '20px 0', fontWeight: 'bold' }}>
                所持ゴールド: {gold} G
            </div>

            <div style={{ display: 'flex', gap: '40px', width: '100%', maxWidth: '1200px', justifyContent: 'center' }}>

                {/* Recipe Equip */}
                <div style={{ flex: 1.5, backgroundColor: '#222', padding: '20px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px' }}>儀式の供物 (レシピ)</h3>
                    <div style={{ color: '#aaa', fontSize: '13px' }}>盤面にどの魔物を召喚する陣を描くか。最大6つまで装備可能。</div>

                    {/* Equipped Slots (6) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '10px' }}>
                        {equippedRecipes.map((slotRecipeId, idx) => {
                            const rec = slotRecipeId ? ALL_RECIPES.find(r => r.id === slotRecipeId) : null;
                            return (
                                <div key={`slot-${idx}`} style={{ 
                                    backgroundColor: '#111', padding: '8px', borderRadius: '5px', 
                                    border: `1px solid ${rec ? '#88ccff' : '#444'}`,
                                    minHeight: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {rec ? (
                                        <>
                                            <div style={{ fontSize: '12px', marginBottom: '4px', color: '#88ccff' }}>{rec.name}</div>
                                            {renderPatternGrid(rec.pattern)}
                                        </>
                                    ) : (
                                        <div style={{ fontSize: '12px', color: '#666' }}>空き枠</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Unlocked Recipes List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '350px' }}>
                        {ALL_RECIPES.filter(r => unlockedRecipes.includes(r.id)).map(recipe => {
                            const isEquipped = equippedRecipes.includes(recipe.id);
                            return (
                                <div key={recipe.id} style={{
                                    backgroundColor: '#333', padding: '10px', borderRadius: '8px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}>
                                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                        {renderPatternGrid(recipe.pattern)}
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#ffbfff' }}>{recipe.name}</div>
                                            <div style={{ fontSize: '11px', color: '#888' }}>消費: {recipe.reward} AP</div>
                                        </div>
                                    </div>
                                    <button
                                        style={{ backgroundColor: isEquipped ? '#555555' : '#448844', padding: '6px 14px', fontSize: '12px', minWidth: '80px' }}
                                        onClick={() => handleToggleRecipeEquip(recipe.id)}
                                    >
                                        {isEquipped ? '外す' : '装備する'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Passive Shop */}
                <div style={{ flex: 1, backgroundColor: '#222', padding: '20px', borderRadius: '10px' }}>
                    <h3 style={{ borderBottom: '1px solid #555', paddingBottom: '10px' }}>闇の遺物屋 (パッシブ強化)</h3>

                    {shopRelics.map(relic => (
                        <div key={relic.id} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            backgroundColor: '#333', padding: '15px', borderRadius: '8px', marginTop: '15px'
                        }}>
                            <div style={{ flex: 1, marginRight: '15px' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '18px', color: '#ffbfff' }}>{relic.icon} {relic.name}</div>
                                <div style={{ color: '#aaa', fontSize: '13px', marginTop: '5px', lineHeight: '1.4' }}>
                                    {relic.description}
                                </div>
                                <div style={{ color: '#ffd700', marginTop: '5px' }}>価格: {relic.price} G</div>
                            </div>
                            <button
                                className="start-btn"
                                style={{ padding: '10px 20px', minWidth: '80px', backgroundColor: (gold >= relic.price && !ownedRelics.includes(relic.id)) ? '#6622aa' : '#555' }}
                                onClick={() => handleBuyRelic(relic.id, relic.price)}
                                disabled={gold < relic.price || ownedRelics.includes(relic.id)}
                            >
                                {ownedRelics.includes(relic.id) ? '購入済' : '購入'}
                            </button>
                        </div>
                    ))}

                    {shopRelics.length === 0 && (
                        <div style={{ textAlign: 'center', color: '#888', marginTop: '20px' }}>
                            すべての遺物を取得済みです
                        </div>
                    )}
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
