# Condor Legacy

リアルタイム防衛シミュレーションゲーム。  
コンドル砦に押し寄せる敵軍を撃退せよ。

## 遊び方

1. `index.html` をブラウザで開く（または GitHub Pages を参照）
2. ステージを選択する
3. 画面下のユニットカードを選択 → 戦場左側をクリックして配置
4. ゴールドは時間経過で増加する（敵を倒すと報酬も入る）
5. 全Waveの敵を撃退すれば勝利。要塞HPがゼロになると敗北

## 技術スタック

- HTML5 Canvas
- Vanilla JavaScript (ES Modules)
- CSS3
- 外部依存ライブラリなし（GitHub Pages そのまま公開可能）

## ファイル構成

```
condor-legacy/
├── index.html
├── css/
│   ├── style.css        # 共通スタイル・CSS変数
│   ├── title.css        # タイトル画面・ステージ選択
│   └── battle.css       # 戦闘画面
├── src/
│   ├── main.js          # エントリーポイント
│   ├── config/
│   │   ├── units.js     # ★ ユニット定義・画像パスの一元管理
│   │   └── stages.js    # ステージ・Wave定義
│   ├── scenes/
│   │   ├── TitleScene.js
│   │   ├── StageSelectScene.js
│   │   └── BattleScene.js
│   └── game/
│       ├── Game.js          # ゲームループ・シーン管理
│       ├── Unit.js          # ユニットロジック
│       ├── BattleManager.js # 戦闘ロジック・Wave管理・Gold管理
│       └── UIManager.js     # Canvas描画
└── assets/
    └── images/
        ├── units/
        │   ├── ally/    # 味方ユニット画像
        │   └── enemy/   # 敵ユニット画像
        ├── ui/
        └── bg/
```

## ユニット画像の追加・差し替え

1. `assets/images/units/ally/` または `enemy/` に画像ファイルを配置
2. `src/config/units.js` の対象ユニットの `image` プロパティを更新

```js
{
  id: 'vanguard',
  // ...
  image: 'vanguard.png'   // ← ファイル名を設定（null で未設定扱い）
}
```

## ユニット一覧

### 味方ユニット

| 名前 | ID | コスト | 役割 | 画像 |
|------|----|--------|------|------|
| ヴァンガード | vanguard | 80G | 近接・主力剣士 | vanguard.png |
| アリア | sharpshooter | 100G | 遠距離・クロスボウ | sharpshooter.png |
| スチームゴーレム | iron_guard | 120G | 重装甲・盾役 | iron_guard.png |
| グリム | pyromancer | 140G | 魔道士・高火力 | pyromancer.png |
| ケロ | medic | 90G | 回復・支援 | medic.png |
| ゴールデンバード | golden_bird | 110G | 快速・突破型 | golden_bird.png |

### 敵ユニット

| 名前 | ID | 報酬 | 役割 | 画像 |
|------|----|------|------|------|
| サイクロプス | grunt | 20G | 基本兵・群れ | grunt.png |
| ナイトメア | brute | 50G | 重装甲・高耐久 | brute.png |
| スクリーチャー | raider | 40G | 遠距離・鳥型 | raider.png |
| カオスロード | warlord | 100G | 精鋭指揮官 | warlord.png |
| デスストーカー | beast | 70G | 高速・魔獣 | beast.png |
| ラタン | rat_healer | 60G | 回復支援・優先目標 | rat_healer.png |

## ステージ概要

| ステージ | 名前 | 難易度 |
|---------|------|--------|
| Stage 1 | 前哨戦 | ★☆☆ |
| Stage 2 | 砦の包囲 | ★★☆ |
| Stage 3 | 最終決戦 | ★★★ |

## GitHub Pages 公開

Settings → Pages → Source を `main` ブランチの `/`（root）に設定するだけで公開できます。
