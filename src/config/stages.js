/**
 * stages.js — ステージ定義の一元管理
 *
 * 各ステージは wave の配列を持つ。
 * wave は「何秒後にどの敵を何体出すか」を定義する。
 *
 * 【追加手順】
 *  STAGES 配列の末尾に新しいステージオブジェクトを追加するだけでOK。
 */

export const STAGES = [
  // ============================================================
  //  STAGE 1 — 前哨戦
  // ============================================================
  {
    id: 'stage_01',
    name: 'ステージ 1 — 前哨戦',
    description: 'コンドル砦に向かう敵軍の先遣隊を退けよ。',
    fortressHp: 500,
    initialGold: 200,
    goldPerSec: 8,
    bgImage: null,        // TODO: 背景画像未確定
    waves: [
      {
        time: 15,
        enemies: [
          { unitId: 'grunt', count: 3, interval: 2000 }
        ]
      },
      {
        time: 35,
        enemies: [
          { unitId: 'grunt',  count: 4, interval: 2000 },
          { unitId: 'raider', count: 1, interval: 3000 }
        ]
      },
      {
        time: 60,
        enemies: [
          { unitId: 'grunt',  count: 5, interval: 1800 },
          { unitId: 'brute',  count: 1, interval: 4000 }
        ]
      }
    ]
  },

  // ============================================================
  //  STAGE 2 — 砦の包囲
  // ============================================================
  {
    id: 'stage_02',
    name: 'ステージ 2 — 砦の包囲',
    description: '精鋭部隊が砦を取り囲もうとしている。全力で迎え撃て。',
    fortressHp: 450,
    initialGold: 180,
    goldPerSec: 9,
    bgImage: null,        // TODO: 背景画像未確定
    waves: [
      {
        time: 12,
        enemies: [
          { unitId: 'grunt',  count: 4, interval: 1800 }
        ]
      },
      {
        time: 30,
        enemies: [
          { unitId: 'grunt',      count: 3, interval: 1800 },
          { unitId: 'raider',     count: 2, interval: 2500 },
          { unitId: 'rat_healer', count: 1, interval: 4000 }  // 回復役を初登場
        ]
      },
      {
        time: 50,
        enemies: [
          { unitId: 'brute',      count: 2, interval: 3500 },
          { unitId: 'raider',     count: 2, interval: 2500 },
          { unitId: 'rat_healer', count: 1, interval: 5000 }
        ]
      },
      {
        time: 75,
        enemies: [
          { unitId: 'grunt',      count: 6, interval: 1500 },
          { unitId: 'warlord',    count: 1, interval: 5000 },
          { unitId: 'rat_healer', count: 2, interval: 3500 }
        ]
      }
    ]
  },

  // ============================================================
  //  STAGE 3 — 最終決戦
  // ============================================================
  {
    id: 'stage_03',
    name: 'ステージ 3 — 最終決戦',
    description: 'カオスロード率いる決死隊が砦に迫る。コンドルの名を守れ。',
    fortressHp: 400,
    initialGold: 160,
    goldPerSec: 10,
    bgImage: null,        // TODO: 背景画像未確定
    waves: [
      {
        time: 10,
        enemies: [
          { unitId: 'grunt',      count: 5, interval: 1600 },
          { unitId: 'rat_healer', count: 1, interval: 3000 }
        ]
      },
      {
        time: 28,
        enemies: [
          { unitId: 'brute',      count: 2, interval: 3000 },
          { unitId: 'raider',     count: 3, interval: 2000 },
          { unitId: 'rat_healer', count: 1, interval: 4000 }
        ]
      },
      {
        time: 48,
        enemies: [
          { unitId: 'beast',      count: 3, interval: 2000 },
          { unitId: 'raider',     count: 2, interval: 2200 },
          { unitId: 'rat_healer', count: 2, interval: 3000 }
        ]
      },
      {
        time: 68,
        enemies: [
          { unitId: 'grunt',      count: 8, interval: 1200 },
          { unitId: 'warlord',    count: 2, interval: 4000 },
          { unitId: 'beast',      count: 2, interval: 2500 },
          { unitId: 'rat_healer', count: 2, interval: 3500 }
        ]
      }
    ]
  }
];
