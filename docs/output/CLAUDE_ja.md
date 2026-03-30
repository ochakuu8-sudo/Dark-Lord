# CLAUDE.md 日本語版 - Dark-Lord（魔王の防衛儀式）

> ※ この文書はCLAUDE.md（英語版）の日本語訳です。AIアシスタントが参照する正本は英語版のCLAUDE.mdです。

---

## プロジェクト概要

ブラウザで動作する日本語タワーディフェンス／パズルゲーム「魔王の防衛儀式」です。プレイヤーは骨・肉・霊のピースをマッチ3風のリチュアルグリッドで組み合わせて魔族ユニットを召喚し、押し寄せる勇者の軍勢を迎え撃ちます。

**技術スタック**: React 18.2 + TypeScript 5.9 + Vite 7.3 + PixiJS 7.4 + GSAP 3.14
**デプロイ先**: GitHub Pages（`/Dark-Lord/`）
**言語**: UIおよびゲーム内テキストはすべて日本語

---

## リポジトリ構成

```
Dark-Lord/
├── .github/workflows/deploy.yml  # GitHub Pages CI/CD（masterプッシュで起動）
├── docs/
│   └── output/unit_stats.md      # 自動生成のユニットバランス資料（日本語）
├── public/vite.svg
├── src/
│   ├── assets/react.svg
│   ├── components/
│   │   ├── BattlePhase.tsx       # レイアウトコンテナ（152行）：左右パネル、スクロール同期
│   │   ├── BestiaryModal.tsx     # ユニット情報モーダル・アビリティ説明（453行）
│   │   ├── DebugPanel.tsx        # デバッグツール：スポーン・グリッドクリア（192行）
│   │   ├── DefensePhase.tsx      # タワーディフェンスのコアエンジン（PixiJS使用、1971行）
│   │   ├── ErrorBoundary.tsx     # Reactエラーバウンダリ（42行）
│   │   ├── ResponsiveWrapper.tsx # キャンバスを論理解像度1240×636にスケーリング（172行）
│   │   ├── RitualPhase.tsx       # パズルグリッド・レシピマッチング（1278行）
│   │   └── UnitSprite.tsx        # スプライト描画コンポーネント（120行）
│   ├── contexts/
│   │   └── GameContext.tsx       # React Contextによるグローバルゲーム状態管理（495行）
│   ├── game/
│   │   ├── config.ts             # 全ゲームデータ：レシピ・ユニット・レリック・カラー
│   │   └── entities.ts           # TypeScript型定義：EntityState、PassiveAbility、ステータス
│   ├── App.tsx                   # フェーズルーター：TITLE → RITUAL → BATTLE → RESULT
│   ├── App.css
│   ├── index.css
│   └── main.tsx                  # エントリーポイント
├── index.html
├── eslint.config.js
├── package.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── vite.config.ts
```

---

## 開発ワークフロー

### セットアップと起動

```bash
npm install         # 依存パッケージをインストール
npm run dev         # 開発サーバー起動（全インターフェースでアクセス可）
npm run build       # TypeScript検査 + Vite本番ビルド → dist/
npm run lint        # ESLintチェック（コミット前に必ずパスさせること）
npm run preview     # 本番ビルドをローカルでプレビュー
```

### デプロイ

`master`へのプッシュで`.github/workflows/deploy.yml`が自動起動します：
1. `npm ci && npm run build`でビルド
2. `dist/`をGitHub Pagesにデプロイ

ViteのベースパスはGitHub Pages用に`/Dark-Lord/`に設定されています。アセットパスはすべてこれを考慮する必要があります。

---

## アーキテクチャと主要規約

### ゲームフェーズ（App.tsx）

`GameContext`が管理するステートマシン：
```
TITLE → RITUAL（パズル）→ BATTLE（タワーディフェンス）→ RESULT
```

### 命名規則

| 種類 | 規則 | 例 |
|------|------|-----|
| ユニット・レシピID | `snake_case` | `skeleton_bone`、`lich_spirit` |
| Reactコンポーネント | `PascalCase` | `BattlePhase`、`RitualPhase` |
| 関数・変数 | `camelCase` | `summonedMonsters`、`addEquippedRecipe` |
| 定数 | `SCREAMING_SNAKE_CASE` | `MAX_AP`、`DEMON_SPEED`、`ROWS` |
| 型・インターフェース | `PascalCase` | `EntityState`、`PassiveAbility`、`Recipe` |

### TypeScriptのパターン

- strictモード有効（`noUnusedLocals`、`noUnusedParameters`、`noImplicitAny`）
- 状態型には**ユニオン文字列リテラル**を使用 — enumは使わない
  ```ts
  type GamePhase = 'TITLE' | 'RITUAL' | 'BATTLE' | 'RESULT';
  ```
- ルックアップマップには`Record<string, T>`を使用
- `config.ts`でのオプショナルなステータス上書きには`Partial<EntityState>`を使用
- 暗黙の`any`は禁止 — 関数の引数と戻り値は必ず型定義すること

### 状態管理

グローバルゲーム状態は`src/contexts/GameContext.tsx`に集約されています。管理対象：
- フェーズ遷移
- レシピのアンロック・装備システム
- モンスター召喚キュー
- 通貨（お金/AP）
- レリック所持状況
- フェーズをまたいだリチュアルグリッドの保持
- 敵ウェーブ生成
- ローグライク風バトルオプション選択
- デバッグモードのトグル
- 共有PixiJSアプリの参照

**規則**: コンポーネント固有の状態（アニメーション、ホバーなど）はコンポーネント内に留める。フェーズをまたぐ状態・永続状態はGameContextに入れる。

### PixiJSレンダリング

`DefensePhase.tsx`がバトルキャンバスにPixiJSを直接使用しています。重要なポイント：
- 共有PixiJSアプリインスタンスは`GameContext`経由で渡し、`DefensePhase`と`RitualPhase`間でキャンバスを同期する
- `ResponsiveWrapper.tsx`がスケーリングを担当：論理解像度は**1240×636**、ビューポートに合わせてスケーリング
- `DefensePhase`と`ResponsiveWrapper`以外からPixiJSステージを操作しないこと

### パフォーマンス規約

- パッシブアビリティはエンティティオブジェクトにキャッシュ（`passiveCache`）— 毎フレーム再計算しない
- ダメージテキストプールは最大**30件**に制限
- パズルピースのエフェクトにはGSAPアニメーションを使用（CSSトランジションは使わない）
- PixiJSレンダーループを軽量に保つ — 毎ティックに大きな状態をキャプチャするクロージャは避ける

---

## ゲームデータリファレンス

### 素材

| 値 | 日本語 | 英語 |
|----|--------|------|
| `0` | 骨 | Bone |
| `1` | 肉 | Meat |
| `2` | 霊 | Spirit |

### レシピシステム（src/game/config.ts）

合計30レシピ：
- **コモン27種**（テトロミノ風9形状 × 3素材）→ 召喚：ウィスプ・スケルトン・アーチャー・オーク・リッチ・ケルベロス・ゴブリン・インプ・バンシー
- **レア3種**（ワイルドカードスロットあり特殊形状）→ 召喚：ネクロマンサー・ミノタウロス・グール

形状は9×9グリッドシステムを使用（`ROWS`、`COLS = 9`、ブロックサイズ`54px`）。

### ユニット（src/game/entities.ts + src/game/config.ts）

- **魔族ユニット23種** それぞれHP・ATK・射程・速度・クールダウン・サイズ・カラー・パッシブアビリティを持つ
- **勇者タイプ11種**（敵）
- 全魔族ユニットは基本速度修正値`DEMON_SPEED = 0.8`を使用
- ユニットステータスは`docs/output/unit_stats.md`にDPS計算付きで記載

### パッシブアビリティシステム

`entities.ts`に30種以上のアビリティタイプを定義。例：
- `REFLECT`、`LIFESTEAL`、`CHARGE`、`TELEPORT`
- 各アビリティは型付きパラメータを持つ：`{ value?, range?, cooldown? }`
- アビリティはスポーン時にエンティティごとにキャッシュされる（`passiveCache`パターン参照）

### レリック

`config.ts`に定義された購入可能なレリック効果が4種。ランを通じて永続。

---

## やってはいけないこと

- **テストファイルは存在しない** — テスト戦略を議論せずにテストを追加しないこと
- **`vite.config.ts`のベースパスを変更しない** (`/Dark-Lord/`) — GitHub Pagesに必須
- **英語のUIテキストを追加しない** — プレイヤー向け文字列はすべて日本語であること
- **enumを使わない** — ユニオン文字列リテラル型を使用すること
- **`any`型を追加しない** — コンパイラとリンターでstrictモードが強制されている
- **グローバルCSSを追加しない** — `index.css`と`App.css`以外は追加しない。コンポーネントはインラインスタイルかスコープ付きクラス名を使用
- **`DefensePhase.tsx`のゲームループロジックを安易に変更しない** — アビリティ・プロジェクタイル・衝突判定のパイプラインが密結合した1971行のコードであるため、全体を理解してから変更すること

---

## よくある作業

### 新ユニットの追加

1. `src/game/entities.ts`でステータスを定義（`unitStats`レコードに追加）
2. `src/game/config.ts`でレシピを追加（コモンまたはレアレシピのエントリ）
3. 新パッシブアビリティを使う場合は`BestiaryModal.tsx`にアビリティ説明を追加
4. `docs/output/unit_stats.md`にバランスメモを更新

### 新パッシブアビリティの追加

1. `entities.ts`の`PassiveAbility`ユニオンにタイプを追加
2. `DefensePhase.tsx`にアビリティロジックを実装（既存のアビリティハンドラのパターンを参照）
3. `BestiaryModal.tsx`に説明文字列を追加

### ゲームバランスの調整

- ユニットステータス：`src/game/config.ts`（statsオブジェクト）および`src/game/entities.ts`
- コンボ・タイミング：`RitualPhase.tsx`（コンボ加速定数、現在20〜40msの範囲）
- 敵ウェーブ：`GameContext.tsx`（ウェーブ生成ロジック）

### デバッグモード

ゲームUI上または`GameContext`経由でデバッグモードを切り替え可能。`DebugPanel.tsx`が提供する機能：
- 手動で敵をスポーン
- グリッドのクリア

---

## ビルド成果物

- `dist/` — 本番ビルドの出力先（.gitignore済み）
- `node_modules/` — 依存パッケージ（.gitignore済み）

`docs/output/unit_stats.md`は自動生成ファイルです（最終更新：2026-03-28）。現在のバランス状態を反映しています。
