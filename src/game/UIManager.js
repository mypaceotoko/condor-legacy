/**
 * UIManager.js — Canvas上のゲーム描画を管理
 *
 * BattleManager からユニット配列を受け取り、Canvas に描画する。
 * ユニット画像・HPバー・攻撃エフェクトなどを担当。
 */

import { UnitState } from './Unit.js';
import { ALLY_UNITS } from '../config/units.js';

// ユニットの描画サイズ
const UNIT_W = 48;
const UNIT_H = 56;

// サイドごとの色
const COLORS = {
  ally:  { border: '#4a9eff', hp: '#40a860', placeholder: '#1e4a80' },
  enemy: { border: '#d94040', hp: '#d94040', placeholder: '#4a1010' }
};

export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._effects = [];   // 一時エフェクト { x, y, text, life, maxLife, color }
  }

  // ----------------------------------------------------------------
  //  メインの描画
  // ----------------------------------------------------------------

  /**
   * 毎フレーム呼ぶ描画メソッド
   * @param {Unit[]} allyUnits
   * @param {Unit[]} enemyUnits
   * @param {number} dt
   */
  draw(allyUnits, enemyUnits, dt) {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    // 背景クリア
    ctx.clearRect(0, 0, W, H);

    // 背景描画
    this._drawBackground(W, H);

    // 要塞ライン
    this._drawFortressLine(H);

    // ユニット描画（敵→味方の順で重ね）
    for (const u of enemyUnits) this._drawUnit(u);
    for (const u of allyUnits)  this._drawUnit(u);

    // フローティングテキストエフェクト
    this._updateEffects(dt);
    this._drawEffects();
  }

  /**
   * ダメージやヒールのフローティングテキストを追加
   * @param {number} x
   * @param {number} y
   * @param {string|number} text
   * @param {string} color
   */
  addFloatText(x, y, text, color = '#ffffff') {
    this._effects.push({ x, y, text: String(text), life: 800, maxLife: 800, color });
  }

  // ----------------------------------------------------------------
  //  プライベート描画メソッド
  // ----------------------------------------------------------------

  _drawBackground(W, H) {
    const ctx = this.ctx;
    // グラデーション背景（空〜地面）
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#0a0a1a');
    grad.addColorStop(0.5, '#0e1525');
    grad.addColorStop(1,   '#0a1008');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 地面ライン
    ctx.strokeStyle = '#1a2a1a';
    ctx.lineWidth   = 1;
    const groundY = H * 0.65;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();
  }

  _drawFortressLine(H) {
    const ctx = this.ctx;
    ctx.strokeStyle = '#2a4a2a';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(40, 0);
    ctx.lineTo(40, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // 要塞アイコン(シンプルな矩形)
    ctx.strokeStyle = '#4a8a4a';
    ctx.lineWidth   = 2;
    ctx.strokeRect(4, H / 2 - 30, 32, 60);
    ctx.fillStyle = '#0a200a';
    ctx.fillRect(4, H / 2 - 30, 32, 60);

    ctx.fillStyle   = '#4a8a4a';
    ctx.font        = '10px Courier New';
    ctx.textAlign   = 'center';
    ctx.fillText('砦', 20, H / 2 + 4);
    ctx.textAlign   = 'left';
  }

  _drawUnit(unit) {
    const ctx   = this.ctx;
    const col   = COLORS[unit.side];
    const x     = Math.round(unit.x - UNIT_W / 2);
    const y     = Math.round(unit.y - UNIT_H / 2);

    // 画像 or プレースホルダー
    if (unit.image) {
      ctx.drawImage(unit.image, x, y, UNIT_W, UNIT_H);
    } else {
      this._drawPlaceholder(x, y, unit, col);
    }

    // HPバー
    this._drawHpBar(x, y - 10, UNIT_W, unit);

    // 攻撃中エフェクト（簡易）
    if (unit.state === UnitState.ATTACKING) {
      ctx.strokeStyle = col.border;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(x - 2, y - 2, UNIT_W + 4, UNIT_H + 4);
      ctx.globalAlpha = 1;
    }
  }

  /** 画像なしのユニット表示 */
  _drawPlaceholder(x, y, unit, col) {
    const ctx = this.ctx;

    // 背景
    ctx.fillStyle = col.placeholder;
    ctx.fillRect(x, y, UNIT_W, UNIT_H);

    // 枠線（点線）
    ctx.strokeStyle = col.border;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(x, y, UNIT_W, UNIT_H);
    ctx.setLineDash([]);

    // ユニット名(短縮)
    ctx.fillStyle   = col.border;
    ctx.font        = '9px Courier New';
    ctx.textAlign   = 'center';
    ctx.fillText(unit.name.slice(0, 6), x + UNIT_W / 2, y + UNIT_H / 2 + 4);
    ctx.textAlign   = 'left';
  }

  _drawHpBar(x, y, w, unit) {
    const ctx   = this.ctx;
    const ratio = unit.hpRatio;

    // 背景
    ctx.fillStyle = '#222';
    ctx.fillRect(x, y, w, 5);

    // HP
    const barColor = ratio > 0.5 ? '#40a860'
                   : ratio > 0.25 ? '#e8a020'
                   : '#d94040';
    ctx.fillStyle  = barColor;
    ctx.fillRect(x, y, Math.round(w * ratio), 5);
  }

  _updateEffects(dt) {
    for (const e of this._effects) e.life -= dt;
    this._effects = this._effects.filter(e => e.life > 0);
  }

  _drawEffects() {
    const ctx = this.ctx;
    for (const e of this._effects) {
      const alpha = e.life / e.maxLife;
      const rise  = (1 - alpha) * 30;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = e.color;
      ctx.font        = 'bold 12px Courier New';
      ctx.textAlign   = 'center';
      ctx.fillText(e.text, e.x, e.y - rise);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
  }

  /**
   * Canvas サイズをリサイズ
   */
  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
  }
}
