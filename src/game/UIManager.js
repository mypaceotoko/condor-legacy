/**
 * UIManager.js — Canvas上のゲーム描画を管理
 *
 * BattleManager からユニット配列を受け取り、Canvas に描画する。
 * ユニット画像・HPバー・攻撃エフェクト・配置ゾーン表示を担当。
 */

import { UnitState } from './Unit.js';

// ユニットの描画サイズ
const UNIT_W = 68;
const UNIT_H = 80;

// 配置ゾーンの右端 (canvas幅に対する割合) — BattleScene と一致させること
const DEPLOY_ZONE_RATIO = 0.55;

// サイドごとの色設定
const COLORS = {
  ally:  { border: '#4a9eff', placeholder: '#1e4a80' },
  enemy: { border: '#d94040', placeholder: '#4a1010' }
};

export class UIManager {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this._effects = [];  // フローティングテキスト { x, y, text, life, maxLife, color }
    this._showDeployZone = false;  // 配置ゾーンハイライト表示フラグ
  }

  // ----------------------------------------------------------------
  //  メインの描画
  // ----------------------------------------------------------------

  /**
   * 毎フレーム呼ぶ描画メソッド
   * @param {Unit[]} allyUnits
   * @param {Unit[]} enemyUnits
   * @param {number} dt - 経過時間 (ms)
   * @param {boolean} showDeployZone - 配置ゾーンをハイライトするか
   */
  draw(allyUnits, enemyUnits, dt, showDeployZone = false) {
    const ctx = this.ctx;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    this._drawBackground(W, H);
    this._drawGround(W, H);

    if (showDeployZone) {
      this._drawDeployZone(W, H);
    }

    this._drawFortressLine(H);

    // 敵 → 味方の順で描画（味方が前面に来る）
    for (const u of enemyUnits)  this._drawUnit(u);
    for (const u of allyUnits)   this._drawUnit(u);

    this._updateEffects(dt);
    this._drawEffects();
  }

  /**
   * フローティングテキストを追加（ダメージ・回復演出など）
   * @param {number} x
   * @param {number} y
   * @param {string|number} text
   * @param {string} color
   */
  addFloatText(x, y, text, color = '#ffffff') {
    this._effects.push({
      x, y,
      text: String(text),
      life: 800,
      maxLife: 800,
      color
    });
  }

  /** Canvas サイズ変更時に呼ぶ */
  resize(w, h) {
    this.canvas.width  = w;
    this.canvas.height = h;
  }

  // ----------------------------------------------------------------
  //  背景・地形
  // ----------------------------------------------------------------

  _drawBackground(W, H) {
    const ctx  = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,    '#07080f');
    grad.addColorStop(0.45, '#0d1520');
    grad.addColorStop(1,    '#080e08');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 遠景の山シルエット
    this._drawMountains(W, H);
  }

  _drawMountains(W, H) {
    const ctx    = this.ctx;
    const groundY = H * 0.62;

    ctx.fillStyle = '#0c1a0c';
    ctx.beginPath();
    ctx.moveTo(0, groundY);

    const peaks = [
      [0.08, 0.28], [0.18, 0.18], [0.30, 0.32],
      [0.42, 0.20], [0.55, 0.35], [0.68, 0.22],
      [0.80, 0.30], [0.92, 0.15], [1.0,  0.25]
    ];
    for (const [rx, ry] of peaks) {
      ctx.lineTo(W * rx, H * ry);
    }
    ctx.lineTo(W, groundY);
    ctx.closePath();
    ctx.fill();
  }

  _drawGround(W, H) {
    const ctx     = this.ctx;
    const groundY = H * 0.62;

    // 地面グラデーション
    const grad = ctx.createLinearGradient(0, groundY, 0, H);
    grad.addColorStop(0, '#0f1a0f');
    grad.addColorStop(1, '#060d06');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, W, H - groundY);

    // 地面ライン
    ctx.strokeStyle = '#1e3a1e';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(W, groundY);
    ctx.stroke();

    // 遠近グリッドライン（奥行き感）
    ctx.strokeStyle = '#0f1e0f';
    ctx.lineWidth   = 0.5;
    for (let i = 1; i <= 4; i++) {
      const y = groundY + (H - groundY) * (i / 5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  //  配置ゾーン表示
  // ----------------------------------------------------------------

  _drawDeployZone(W, H) {
    const ctx  = this.ctx;
    const maxX = W * DEPLOY_ZONE_RATIO;

    // 半透明の緑ハイライト
    ctx.fillStyle = 'rgba(74, 158, 100, 0.07)';
    ctx.fillRect(42, 0, maxX - 42, H);

    // 右端の境界線
    ctx.strokeStyle = 'rgba(74, 158, 100, 0.35)';
    ctx.lineWidth   = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(maxX, 0);
    ctx.lineTo(maxX, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // ラベル（配置ゾーン中央に表示）
    ctx.fillStyle = 'rgba(74, 158, 100, 0.5)';
    ctx.font      = '11px Courier New';
    ctx.textAlign = 'center';
    ctx.fillText('DEPLOY ZONE', (50 + maxX) / 2, 18);
    ctx.textAlign = 'left';
  }

  // ----------------------------------------------------------------
  //  要塞ライン
  // ----------------------------------------------------------------

  _drawFortressLine(H) {
    const ctx = this.ctx;

    // 破線ライン
    ctx.strokeStyle = '#2a4a2a';
    ctx.lineWidth   = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(42, 0);
    ctx.lineTo(42, H);
    ctx.stroke();
    ctx.setLineDash([]);

    // 要塞ブロック
    const bx = 4, by = H / 2 - 36;
    ctx.fillStyle   = '#0a1e0a';
    ctx.fillRect(bx, by, 34, 72);
    ctx.strokeStyle = '#3a6a3a';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bx, by, 34, 72);

    // 城壁の凹凸
    ctx.fillStyle = '#3a6a3a';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(bx + 4 + i * 8, by - 5, 5, 6);
    }

    // 「砦」テキスト
    ctx.fillStyle   = '#5a9a5a';
    ctx.font        = 'bold 11px Courier New';
    ctx.textAlign   = 'center';
    ctx.fillText('砦', bx + 17, H / 2 + 4);
    ctx.textAlign   = 'left';
  }

  // ----------------------------------------------------------------
  //  ユニット描画
  // ----------------------------------------------------------------

  _drawUnit(unit) {
    const ctx = this.ctx;
    const col = COLORS[unit.side];
    const x   = Math.round(unit.x - UNIT_W / 2);
    const y   = Math.round(unit.y - UNIT_H / 2);

    // 影
    ctx.fillStyle   = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(unit.x, unit.y + UNIT_H / 2 + 2, UNIT_W / 2 - 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 画像 or プレースホルダー
    if (unit.image && unit.image.complete && unit.image.naturalWidth > 0) {
      ctx.drawImage(unit.image, x, y, UNIT_W, UNIT_H);
    } else {
      this._drawPlaceholder(x, y, unit, col);
    }

    // 攻撃中の枠エフェクト
    if (unit.state === UnitState.ATTACKING) {
      ctx.strokeStyle = col.border;
      ctx.lineWidth   = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.strokeRect(x - 2, y - 2, UNIT_W + 4, UNIT_H + 4);
      ctx.globalAlpha = 1;
    }

    // HPバー
    this._drawHpBar(x, y - 8, UNIT_W, unit);
  }

  _drawPlaceholder(x, y, unit, col) {
    const ctx = this.ctx;

    ctx.fillStyle = col.placeholder;
    ctx.fillRect(x, y, UNIT_W, UNIT_H);

    ctx.strokeStyle = col.border;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 2]);
    ctx.strokeRect(x, y, UNIT_W, UNIT_H);
    ctx.setLineDash([]);

    ctx.fillStyle   = col.border;
    ctx.font        = '9px Courier New';
    ctx.textAlign   = 'center';
    ctx.fillText(unit.name.slice(0, 5), x + UNIT_W / 2, y + UNIT_H / 2 + 3);
    ctx.textAlign   = 'left';
  }

  _drawHpBar(x, y, w, unit) {
    const ctx   = this.ctx;
    const ratio = unit.hpRatio;

    // 背景
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, w, 5);

    // HP色
    const color = ratio > 0.5 ? '#40a860'
                : ratio > 0.25 ? '#e8a020'
                : '#d94040';
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(1, Math.round(w * ratio)), 5);
  }

  // ----------------------------------------------------------------
  //  フローティングテキスト
  // ----------------------------------------------------------------

  _updateEffects(dt) {
    for (const e of this._effects) e.life -= dt;
    this._effects = this._effects.filter(e => e.life > 0);
  }

  _drawEffects() {
    const ctx = this.ctx;
    for (const e of this._effects) {
      const alpha = e.life / e.maxLife;
      const rise  = (1 - alpha) * 28;
      ctx.globalAlpha = alpha;
      ctx.fillStyle   = e.color;
      ctx.font        = 'bold 12px Courier New';
      ctx.textAlign   = 'center';
      ctx.fillText(e.text, e.x, e.y - rise);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
  }
}
