# Condor Legacy

リアルタイム防衛シミュレーションゲーム。  
コンドル砦に押し寄せる敵軍を撃退せよ。

## 遊び方

1. `index.html` をブラウザで開く（または GitHub Pages を参照）
2. ステージを選択する
3. 画面下のユニットカードを選択 → 戦場左側をクリックして配置
4. ゴールドは時間経過で増加する
5. 全Waveの敵を撃退すれば勝利

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
│   ├── style.css        # 共通スタイル
│   ├── title.css        # タイトル画面
│   └── battle.css       # 戦闘画面
├── src/
│   ├── main.js          # エントリーポイント
│   ├── config/
│   │   ├── units.js     # ★ ユニット定義・画像パスの一元管理
│   │   └── stages.js    # ステージ定義
│   ├── scenes/
│   │   ├── TitleScene.js
│   │   ├── StageSelectScene.js
│   │   └── BattleScene.js
│   └── game/
│       ├── Game.js          # ゲームループ・シーン管理
│       ├── Unit.js          # ユニットロジック
│       ├── BattleManager.js # 戦闘ロジック・Wave管理
│       └── UIManager.js     # Canvas描画
└── assets/
    └── images/
        ├── units/
        │   ├── ally/    # 味方ユニット画像 (.png 推奨)
        │   └── enemy/   # 敵ユニット画像
        ├── ui/
        └── bg/
```

## ユニット画像の追加・差し替え

1. `assets/images/units/ally/` または `enemy/` に画像ファイルを配置
2. `src/config/units.js` の対象ユニットの `image` を更新

```js
// 例: ヴァンガードの画像を設定する場合
{
  id: 'vanguard',
  // ...
  image: 'vanguard.png'   // ← ここを null から変更
}
```

## ユニット一覧

### 味方

| ID | 名前 | コスト | 役割 | 画像 |
|----|------|--------|------|------|
| vanguard | ヴァンガード | 80G | 近接・主力 | 未確定 |
| sharpshooter | シャープシューター | 100G | 遠距離 | 未確定 |
| iron_guard | アイアンガード | 120G | 盾役 | 未確定 |
| pyromancer | パイロマンサー | 140G | 魔法・高火力 | 未確定 |
| medic | メディック | 90G | 回復 | 未確定 |

### 敵

| ID | 名前 | 報酬 | 役割 | 画像 |
|----|------|------|------|------|
| grunt | グラント | 20G | 基本兵 | 未確定 |
| brute | ブルート | 50G | 重装甲 | 未確定 |
| raider | レイダー | 40G | 遠距離 | 未確定 |
| warlord | ウォーロード | 100G | 強化指揮官 | 未確定 |
| beast | ビースト | 70G | 高速魔獣 | 未確定 |

## GitHub Pages 公開

リポジトリの Settings → Pages → Source を `main` ブランチの `/` (root) に設定するだけで公開できます。
