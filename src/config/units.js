/**
 * units.js — ユニット定義の一元管理
 *
 * 画像ファイルは assets/images/units/ally/ または enemy/ に配置する。
 * image: null のユニットは「画像未確定」扱いでプレースホルダー表示になる。
 * 画像が確定したら image プロパティにファイル名(例: "vanguard.png")を設定すること。
 *
 * 【追加・差し替え手順】
 *  1. assets/images/units/ally/ または enemy/ に画像ファイルを配置
 *  2. 対応するユニットの image プロパティを更新
 *  3. 新ユニットを追加する場合は ALLY_UNITS または ENEMY_UNITS に追記
 */

// ============================================================
//  味方ユニット定義
// ============================================================

export const ALLY_UNITS = [
  {
    id: 'vanguard',
    name: 'ヴァンガード',
    side: 'ally',
    description: '近接戦闘を得意とする主力歩兵。バランス型。',
    hp: 120,
    attack: 22,
    defense: 12,
    range: 55,           // 攻撃射程 (px)
    moveSpeed: 42,       // 移動速度 (px/sec)
    attackInterval: 1200, // 攻撃間隔 (ms)
    cost: 80,
    image: 'vanguard.png'
  },
  {
    id: 'sharpshooter',
    name: 'アリア',
    side: 'ally',
    description: 'クロスボウを操る俊足の射手。遠距離から正確に敵を狙い撃つ。',
    hp: 80,
    attack: 28,
    defense: 6,
    range: 160,
    moveSpeed: 36,
    attackInterval: 1800,
    cost: 100,
    image: 'sharpshooter.png'
  },
  {
    id: 'iron_guard',
    name: 'アイアンガード',
    side: 'ally',
    description: '重装甲の盾役。HPと防御が高いが移動は遅い。',
    hp: 220,
    attack: 14,
    defense: 25,
    range: 50,
    moveSpeed: 25,
    attackInterval: 1500,
    cost: 120,
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'pyromancer',
    name: 'パイロマンサー',
    side: 'ally',
    description: '炎魔法を操る術士。攻撃力が高く範囲効果もある。',
    hp: 70,
    attack: 40,
    defense: 4,
    range: 140,
    moveSpeed: 30,
    attackInterval: 2200,
    cost: 140,
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'medic',
    name: 'メディック',
    side: 'ally',
    description: '近くの味方を回復する衛生兵。戦闘より支援が専門。',
    hp: 75,
    attack: 8,
    defense: 8,
    range: 80,
    moveSpeed: 38,
    attackInterval: 2000,
    cost: 90,
    healAmount: 15,      // 回復量（healerのみ）
    healInterval: 2500,  // 回復間隔 (ms)
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'golden_bird',
    name: 'ゴールデンバード',
    side: 'ally',
    description: '黄金の快速鳥。移動速度が群を抜いて速く、敵陣を素早く切り崩す。',
    hp: 90,
    attack: 18,
    defense: 5,
    range: 55,
    moveSpeed: 95,       // 最速クラス
    attackInterval: 900,
    cost: 110,
    image: 'golden_bird.png'
  }
];

// ============================================================
//  敵ユニット定義
// ============================================================

export const ENEMY_UNITS = [
  {
    id: 'grunt',
    name: 'グラント',
    side: 'enemy',
    description: '最も基本的な敵歩兵。能力は低めだが数が多い。',
    hp: 80,
    attack: 16,
    defense: 6,
    range: 55,
    moveSpeed: 38,
    attackInterval: 1400,
    reward: 20,          // 撃破時の報酬
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'brute',
    name: 'ブルート',
    side: 'enemy',
    description: '重装甲の強敵。HPが高く突破されると厄介。',
    hp: 200,
    attack: 24,
    defense: 18,
    range: 55,
    moveSpeed: 22,
    attackInterval: 1600,
    reward: 50,
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'raider',
    name: 'レイダー',
    side: 'enemy',
    description: '遠距離から矢を放つ敵射手。接近前に攻撃してくる。',
    hp: 70,
    attack: 26,
    defense: 5,
    range: 150,
    moveSpeed: 34,
    attackInterval: 1900,
    reward: 40,
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'warlord',
    name: 'ウォーロード',
    side: 'enemy',
    description: '精鋭の敵指揮官。全ステータスが高い強敵。',
    hp: 300,
    attack: 35,
    defense: 20,
    range: 60,
    moveSpeed: 28,
    attackInterval: 1300,
    reward: 100,
    // TODO: 画像未確定
    image: null
  },
  {
    id: 'beast',
    name: 'ビースト',
    side: 'enemy',
    description: '制御された魔獣。素早く攻撃力が高い危険な存在。',
    hp: 150,
    attack: 42,
    defense: 10,
    range: 65,
    moveSpeed: 60,
    attackInterval: 1000,
    reward: 70,
    // TODO: 画像未確定
    image: null
  }
];

// ============================================================
//  ユニット画像パスのヘルパー関数
// ============================================================

/**
 * ユニット定義から画像の完全パスを返す。
 * image が null の場合は null を返す（呼び出し側でプレースホルダーを使うこと）。
 *
 * @param {Object} unitDef - ALLY_UNITS / ENEMY_UNITS の要素
 * @returns {string|null}
 */
export function getUnitImagePath(unitDef) {
  if (!unitDef.image) return null;
  const dir = unitDef.side === 'ally' ? 'ally' : 'enemy';
  return `assets/images/units/${dir}/${unitDef.image}`;
}

/**
 * id でユニット定義を検索する（両陣営から）。
 *
 * @param {string} id
 * @returns {Object|undefined}
 */
export function findUnitDef(id) {
  return [...ALLY_UNITS, ...ENEMY_UNITS].find(u => u.id === id);
}
