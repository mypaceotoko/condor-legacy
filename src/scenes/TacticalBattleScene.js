/**
 * TacticalBattleScene.js — コンドルフォート風戦術戦闘
 *
 * Phase 1 (placement): 戦闘前にユニットを配置する
 * Phase 2 (battle):    移動/攻撃/待機コマンドで指揮する
 *
 * 既存の BattleManager / UIManager / Unit をそのまま流用し、
 * Unit.tacticalMode フィールドで挙動を制御する。
 */

import { BattleManager }                             from '../game/BattleManager.js';
import { UIManager }                                 from '../game/UIManager.js';
import { ALLY_UNITS, ENEMY_UNITS, getUnitImagePath } from '../config/units.js';

const UNIT_W            = 68;
const UNIT_H            = 80;
const DEPLOY_BASE_RATIO = 0.42;  // 初期配置可能ゾーン右端
const DEPLOY_MAX_RATIO  = 0.58;  // 最大配置可能ゾーン右端

export class TacticalBattleScene {
  init(appEl, switchTo, stageDef) {
    this._appEl      = appEl;
    this._switchTo   = switchTo;
    this._stageDef   = stageDef;
    this._manager    = null;
    this._ui         = null;
    this._imageCache = {};
    this._speedMult  = 1;
    this._timeInterval = null;

    // 配置フェーズ
    this._phase      = 'placement';
    this._placingId  = null;   // パレットで選択中のユニットID
    this._mousePos   = null;   // ゴースト描画用マウス座標

    // 戦闘フェーズ
    this._selected   = null;   // 選択中の味方 Unit
    this._pendingCmd = null;   // 'move' | 'attack' | null

    this._buildHTML();
    this._preloadImages(() => this._initManagers());
  }

  update(dt) {
    if (this._phase !== 'battle' || !this._manager) return;
    this._manager.update(dt * this._speedMult);

    if (this._selected && !this._selected.isAlive) {
      this._selected   = null;
      this._pendingCmd = null;
      this._updateCommandPanel();
    }
  }

  render(dt) {
    if (!this._ui || !this._manager) return;

    const showZone = this._phase === 'placement' || this._selected !== null;
    this._ui.draw(
      this._manager.allyUnits,
      this._manager.enemyUnits,
      dt * this._speedMult,
      showZone,
      this._manager.mines
    );

    for (const ev of this._manager.floatEvents) {
      this._ui.addFloatText(ev.x, ev.y, ev.text, ev.color);
    }

    this._drawTacticalOverlays();

    if (this._phase === 'placement' && this._placingId && this._mousePos) {
      this._drawPlacementGhost(this._mousePos.x, this._mousePos.y);
    }
  }

  destroy() {
    this._clearTimers();
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
    if (this._onResize)  window.removeEventListener('resize',  this._onResize);
    this._appEl.innerHTML = '';
  }

  // ----------------------------------------------------------------
  //  HTML 構築
  // ----------------------------------------------------------------

  _buildHTML() {
    this._appEl.innerHTML = `
      <div id="scene-tactical">

        <div id="battle-header">
          <span class="battle-header-title">CONDOR LEGACY</span>
          <div class="resource-display">
            <span class="resource-label">Gold</span>
            <span class="resource-value" id="tac-gold">0</span>
          </div>
          <div class="resource-display">
            <span class="resource-label">Wave</span>
            <span class="resource-value" id="tac-wave">待機中</span>
          </div>
          <div class="resource-display">
            <span class="resource-label">Time</span>
            <span class="resource-value" id="tac-time">0:00</span>
          </div>
          <div class="fortress-hp-section">
            <span class="fortress-hp-label">要塞HP</span>
            <div class="fortress-hp-bar">
              <div class="fortress-hp-fill" id="tac-fortress-fill" style="width:100%"></div>
            </div>
            <span class="fortress-hp-num" id="tac-fortress-num">-</span>
          </div>
        </div>

        <div id="battle-main">
          <canvas id="tac-canvas"></canvas>
          <div id="wave-announce"></div>
          <div id="tac-phase-banner">配置フェーズ — ユニットを配置して「戦闘開始」を押してください</div>
        </div>

        <div id="tac-footer">

          <!-- 配置フェーズパネル -->
          <div id="tac-placement-panel">
            <div id="tac-palette"></div>
            <div class="tac-side-controls">
              <button class="btn btn-gold" id="btn-tac-start">戦闘開始</button>
              <button class="btn"          id="btn-tac-retreat-p">撤退</button>
            </div>
          </div>

          <!-- 戦闘フェーズパネル -->
          <div id="tac-battle-panel" class="hidden">
            <div id="tac-command-section">
              <div id="tac-selected-info">
                <span class="tac-hint">ユニットをタップして選択</span>
              </div>
              <div id="tac-cmd-btns">
                <button class="tac-cmd-btn" id="cmd-move"   disabled>移動</button>
                <button class="tac-cmd-btn" id="cmd-attack" disabled>攻撃</button>
                <button class="tac-cmd-btn" id="cmd-hold"   disabled>待機</button>
              </div>
            </div>
            <div class="tac-side-controls">
              <button class="btn" id="btn-tac-speed">2x速</button>
              <button class="btn" id="btn-tac-pause">一時停止</button>
              <button class="btn" id="btn-tac-retreat">撤退</button>
            </div>
          </div>

        </div>

        <div id="result-overlay" class="hidden">
          <div class="result-box">
            <div class="result-title"    id="result-title"></div>
            <div class="result-subtitle" id="result-subtitle"></div>
            <div class="result-stats"    id="result-stats"></div>
            <div class="result-buttons">
              <button class="btn btn-gold" id="btn-retry">もう一度</button>
              <button class="btn"          id="btn-stage-select">ステージ選択</button>
            </div>
          </div>
        </div>

        <div id="unit-tooltip" class="hidden"></div>

      </div>
    `;

    this._canvasEl = document.getElementById('tac-canvas');
    this._buildPalette();
    this._bindButtons();
    this._bindCanvas();
    this._setupResize();
    this._setupKeyboard();
  }

  // ----------------------------------------------------------------
  //  配置パレット
  // ----------------------------------------------------------------

  _buildPalette() {
    const palette = document.getElementById('tac-palette');
    palette.innerHTML = ALLY_UNITS.map((def, i) => `
      <div class="unit-card" data-unit-id="${def.id}" title="">
        <div class="unit-card-key">${i + 1}</div>
        <div class="unit-card-img">
          ${def.image
            ? `<img src="${getUnitImagePath(def)}" alt="${def.name}" />`
            : `<div class="unit-placeholder">NO<br>IMG</div>`
          }
        </div>
        <div class="unit-card-name">${def.name}</div>
        <div class="unit-card-cost">${def.cost}G</div>
        <span class="cost-badge">G不足</span>
      </div>
    `).join('');

    palette.querySelectorAll('.unit-card').forEach(card => {
      card.addEventListener('click',      ()  => this._selectPaletteUnit(card.dataset.unitId));
      card.addEventListener('mouseenter', e   => this._showTooltip(card.dataset.unitId, e));
      card.addEventListener('mouseleave', ()  => this._hideTooltip());
    });
  }

  _selectPaletteUnit(id) {
    this._placingId = this._placingId === id ? null : id;
    document.querySelectorAll('#tac-palette .unit-card')
      .forEach(c => c.classList.toggle('selected', c.dataset.unitId === this._placingId));
  }

  // ----------------------------------------------------------------
  //  ボタン
  // ----------------------------------------------------------------

  _bindButtons() {
    document.getElementById('btn-tac-start').addEventListener('click', () => {
      this._transitionToBattle();
    });

    document.getElementById('btn-tac-retreat-p').addEventListener('click', () => {
      if (confirm('撤退してステージ選択に戻りますか？')) this._switchTo('stageSelect');
    });

    const speedOrder  = [1, 2, 0.5];
    const speedLabels = ['2x速', '0.5x速', '1x速'];
    document.getElementById('btn-tac-speed').addEventListener('click', () => {
      const idx       = speedOrder.indexOf(this._speedMult);
      this._speedMult = speedOrder[(idx + 1) % speedOrder.length];
      document.getElementById('btn-tac-speed').textContent = speedLabels[(idx + 1) % speedLabels.length];
    });

    document.getElementById('btn-tac-pause').addEventListener('click', () => {
      if (!this._manager) return;
      if (this._manager.isRunning) {
        this._manager.pause();
        document.getElementById('btn-tac-pause').textContent = '再開';
      } else {
        this._manager.resume();
        document.getElementById('btn-tac-pause').textContent = '一時停止';
      }
    });

    document.getElementById('btn-tac-retreat').addEventListener('click', () => {
      if (confirm('撤退してステージ選択に戻りますか？')) this._switchTo('stageSelect');
    });

    document.getElementById('cmd-move').addEventListener('click', () => {
      this._setPendingCmd('move');
    });
    document.getElementById('cmd-attack').addEventListener('click', () => {
      this._setPendingCmd('attack');
    });
    document.getElementById('cmd-hold').addEventListener('click', () => {
      if (this._selected?.isAlive) {
        this._selected.tacticalMode         = 'hold';
        this._selected.moveTarget           = null;
        this._selected.tacticalAttackTarget = null;
        this._selected.target               = null;
      }
      this._pendingCmd = null;
      this._updateCommandPanel();
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      this._switchTo('tacticalBattle', this._stageDef);
    });
    document.getElementById('btn-stage-select').addEventListener('click', () => {
      this._switchTo('stageSelect');
    });
  }

  _setPendingCmd(cmd) {
    if (!this._selected?.isAlive) return;
    this._pendingCmd = this._pendingCmd === cmd ? null : cmd;
    this._updateCommandPanel();
  }

  // ----------------------------------------------------------------
  //  Canvas インタラクション
  // ----------------------------------------------------------------

  _bindCanvas() {
    this._canvasEl.addEventListener('click', e => {
      const { x, y } = this._canvasCoords(e);
      this._onCanvasClick(x, y);
    });
    this._canvasEl.addEventListener('mousemove', e => {
      this._mousePos = this._canvasCoords(e);
    });
    this._canvasEl.addEventListener('mouseleave', () => {
      this._mousePos = null;
    });
  }

  _canvasCoords(e) {
    const rect   = this._canvasEl.getBoundingClientRect();
    const scaleX = this._canvasEl.width  / rect.width;
    const scaleY = this._canvasEl.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY
    };
  }

  _onCanvasClick(cx, cy) {
    if (this._phase === 'placement') {
      this._handlePlacementClick(cx, cy);
    } else {
      this._handleBattleClick(cx, cy);
    }
  }

  _handlePlacementClick(cx, cy) {
    if (!this._placingId || !this._manager) return;
    const maxX = this._getDeployZoneMax();
    if (cx < 50 || cx > maxX) return;

    const def = ALLY_UNITS.find(u => u.id === this._placingId);
    if (!def || this._manager.gold < def.cost) { this._flashGold(); return; }

    this._manager._addGold(-def.cost);
    const unit = this._manager._createUnit(def, cx, cy);
    unit.tacticalMode = 'hold';
    this._manager.allyUnits.push(unit);
  }

  _handleBattleClick(cx, cy) {
    if (this._pendingCmd === 'move') {
      if (this._selected?.isAlive) {
        this._selected.tacticalMode = 'move';
        this._selected.moveTarget   = { x: cx, y: cy };
        this._selected.target       = null;
      }
      this._pendingCmd = null;
      this._updateCommandPanel();
      return;
    }

    if (this._pendingCmd === 'attack') {
      const enemy = this._findUnitAt(cx, cy, this._manager.enemyUnits);
      if (enemy && this._selected?.isAlive) {
        this._selected.tacticalMode         = 'attack';
        this._selected.tacticalAttackTarget = enemy;
        this._selected.target               = enemy;
        this._pendingCmd = null;
        this._updateCommandPanel();
      }
      return;
    }

    // コマンドなし: ユニット選択
    const ally = this._findUnitAt(cx, cy, this._manager.allyUnits);
    if (ally) {
      this._selected   = ally;
      this._pendingCmd = null;
      this._updateCommandPanel();
      return;
    }
    this._selected   = null;
    this._pendingCmd = null;
    this._updateCommandPanel();
  }

  _findUnitAt(cx, cy, units) {
    const HIT_R = 36;
    for (const u of units) {
      if (!u.isAlive) continue;
      const dx = u.x - cx, dy = u.y - cy;
      if (Math.sqrt(dx * dx + dy * dy) < HIT_R) return u;
    }
    return null;
  }

  // ----------------------------------------------------------------
  //  フェーズ遷移
  // ----------------------------------------------------------------

  _transitionToBattle() {
    this._phase = 'battle';
    document.getElementById('tac-placement-panel').classList.add('hidden');
    document.getElementById('tac-battle-panel').classList.remove('hidden');
    document.getElementById('tac-phase-banner').classList.add('hidden');

    this._manager.start();
    this._timeInterval = setInterval(() => this._updateTimeDisplay(), 500);
    this._onGoldChange(this._manager.gold);
  }

  // ----------------------------------------------------------------
  //  コマンドパネル更新
  // ----------------------------------------------------------------

  _updateCommandPanel() {
    const u      = this._selected;
    const infoEl = document.getElementById('tac-selected-info');
    const movBtn = document.getElementById('cmd-move');
    const atkBtn = document.getElementById('cmd-attack');
    const hldBtn = document.getElementById('cmd-hold');
    if (!infoEl) return;

    if (!u?.isAlive) {
      infoEl.innerHTML = `<span class="tac-hint">ユニットをタップして選択</span>`;
      [movBtn, atkBtn, hldBtn].forEach(b => { if (b) b.disabled = true; });
      return;
    }

    const modeLabel = { free: '自由行動', hold: '待機中', move: '移動中', attack: '攻撃中' }[u.tacticalMode] ?? '-';
    infoEl.innerHTML = `
      <span class="tac-sel-name">${u.name}</span>
      <span class="tac-sel-hp">HP ${u.hp} / ${u.maxHp}</span>
      <span class="tac-sel-mode">${modeLabel}</span>
    `;
    [movBtn, atkBtn, hldBtn].forEach(b => { if (b) b.disabled = false; });
    if (movBtn) movBtn.classList.toggle('active', this._pendingCmd === 'move');
    if (atkBtn) atkBtn.classList.toggle('active', this._pendingCmd === 'attack');
    if (hldBtn) hldBtn.classList.remove('active');
  }

  // ----------------------------------------------------------------
  //  戦術オーバーレイ描画
  // ----------------------------------------------------------------

  _drawTacticalOverlays() {
    const ctx = this._canvasEl.getContext('2d');
    const W   = this._canvasEl.width;
    const H   = this._canvasEl.height;

    // 配置フェーズ: 配置可能ゾーン
    if (this._phase === 'placement') {
      const maxX = this._getDeployZoneMax();
      ctx.fillStyle = 'rgba(74,158,100,0.06)';
      ctx.fillRect(50, 0, maxX - 50, H);
      ctx.strokeStyle = 'rgba(74,158,100,0.4)';
      ctx.lineWidth   = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(maxX, 0); ctx.lineTo(maxX, H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(74,158,100,0.5)';
      ctx.font      = '11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('DEPLOY ZONE', (50 + maxX) / 2, 18);
      ctx.textAlign = 'left';
    }

    // 選択ユニットのリング
    if (this._selected?.isAlive) {
      const u = this._selected;
      ctx.strokeStyle = '#c8a84b';
      ctx.lineWidth   = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.arc(u.x, u.y, UNIT_W / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 移動先マーカー
      if (u.moveTarget) {
        ctx.strokeStyle = '#4a9e64';
        ctx.lineWidth   = 1.5;
        ctx.beginPath(); ctx.arc(u.moveTarget.x, u.moveTarget.y, 10, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(74,158,100,0.4)';
        ctx.lineWidth   = 1;
        ctx.beginPath(); ctx.moveTo(u.x, u.y); ctx.lineTo(u.moveTarget.x, u.moveTarget.y); ctx.stroke();
      }
    }

    // 各味方ユニットに戦術モードバッジ
    if (this._phase === 'battle') {
      ctx.font = 'bold 9px Courier New';
      for (const u of this._manager.allyUnits) {
        if (!u.isAlive) continue;
        const badge = { hold: '待', move: '移', attack: '攻' }[u.tacticalMode];
        if (!badge) continue;
        ctx.fillStyle = u.tacticalMode === 'attack' ? '#ff6060'
                      : u.tacticalMode === 'move'   ? '#c8a84b'
                      : '#4a9eff';
        ctx.textAlign = 'center';
        ctx.fillText(badge, u.x, u.y - UNIT_H / 2 - 12);
      }
      ctx.textAlign = 'left';
    }

    // ペンディングコマンドのガイドテキスト
    if (this._pendingCmd) {
      const msg = this._pendingCmd === 'move' ? '移動先をクリック' : '攻撃対象の敵をクリック';
      ctx.fillStyle = 'rgba(200,168,75,0.9)';
      ctx.font      = '13px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(msg, W / 2, H - 16);
      ctx.textAlign = 'left';
    }
  }

  _drawPlacementGhost(cx, cy) {
    const ctx    = this._canvasEl.getContext('2d');
    const def    = ALLY_UNITS.find(u => u.id === this._placingId);
    if (!def) return;
    const x      = Math.round(cx - UNIT_W / 2);
    const y      = Math.round(cy - UNIT_H / 2);
    const img    = this._imageCache[def.id];
    const inZone = cx >= 50 && cx <= this._getDeployZoneMax();

    ctx.globalAlpha = 0.5;
    if (img?.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, UNIT_W, UNIT_H);
    } else {
      ctx.fillStyle = inZone ? '#2a4a80' : '#4a1010';
      ctx.fillRect(x, y, UNIT_W, UNIT_H);
    }
    ctx.strokeStyle = inZone ? '#4a9eff' : '#d94040';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(x, y, UNIT_W, UNIT_H);
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------
  //  配置ゾーン計算
  // ----------------------------------------------------------------

  _getDeployZoneMax() {
    const W    = this._canvasEl?.width ?? 800;
    const base = W * DEPLOY_BASE_RATIO;
    const max  = W * DEPLOY_MAX_RATIO;
    if (!this._manager || this._manager.allyUnits.length === 0) return base;
    const frontX = Math.max(...this._manager.allyUnits.map(u => u.x));
    return Math.min(max, frontX + 80);
  }

  // ----------------------------------------------------------------
  //  ツールチップ
  // ----------------------------------------------------------------

  _showTooltip(unitId, event) {
    const def = ALLY_UNITS.find(u => u.id === unitId);
    if (!def) return;
    const tip = document.getElementById('unit-tooltip');
    tip.innerHTML = `
      <div class="tip-name">${def.name}</div>
      <div class="tip-desc">${def.description}</div>
      <div class="tip-stats">
        <span>HP: ${def.hp}</span><span>ATK: ${def.attack}</span>
        <span>DEF: ${def.defense}</span><span>射程: ${def.range}</span>
        <span>速度: ${def.moveSpeed}</span>
      </div>
    `;
    tip.classList.remove('hidden');
    const rect = event.currentTarget.getBoundingClientRect();
    const tipH = tip.offsetHeight;
    tip.style.left = `${Math.max(4, rect.left)}px`;
    tip.style.top  = `${Math.max(4, rect.top - tipH - 8)}px`;
  }

  _hideTooltip() {
    document.getElementById('unit-tooltip')?.classList.add('hidden');
  }

  // ----------------------------------------------------------------
  //  キーボード
  // ----------------------------------------------------------------

  _setupKeyboard() {
    this._onKeyDown = e => {
      if (e.key === 'Escape') {
        this._selected   = null;
        this._pendingCmd = null;
        this._placingId  = null;
        document.querySelectorAll('#tac-palette .unit-card').forEach(c => c.classList.remove('selected'));
        this._updateCommandPanel();
      }
      if (e.key === ' ') {
        e.preventDefault();
        document.getElementById('btn-tac-pause')?.click();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  // ----------------------------------------------------------------
  //  リサイズ
  // ----------------------------------------------------------------

  _setupResize() {
    this._onResize = () => this._resizeCanvas();
    window.addEventListener('resize', this._onResize);
    this._resizeCanvas();
  }

  _resizeCanvas() {
    const main = document.getElementById('battle-main');
    if (!main) return;
    const w = main.clientWidth;
    const h = main.clientHeight;
    this._canvasEl.width  = w;
    this._canvasEl.height = h;
    if (this._manager) {
      this._manager.canvasWidth  = w;
      this._manager.canvasHeight = h;
    }
    if (this._ui) this._ui.resize(w, h);
  }

  // ----------------------------------------------------------------
  //  画像プリロード
  // ----------------------------------------------------------------

  _preloadImages(callback) {
    const withImage = [...ALLY_UNITS, ...ENEMY_UNITS].filter(d => d.image);
    if (withImage.length === 0) { callback(); return; }
    let remaining = withImage.length;
    for (const def of withImage) {
      const img  = new Image();
      img.src    = getUnitImagePath(def);
      const done = () => { this._imageCache[def.id] = img; if (--remaining === 0) callback(); };
      img.onload  = done;
      img.onerror = done;
    }
  }

  // ----------------------------------------------------------------
  //  初期化
  // ----------------------------------------------------------------

  _initManagers() {
    this._resizeCanvas();
    this._ui = new UIManager(this._canvasEl);

    this._manager = new BattleManager(
      this._stageDef,
      this._imageCache,
      this._canvasEl.width,
      this._canvasEl.height,
      gold        => this._onGoldChange(gold),
      (hp, maxHp) => this._onFortressHpChange(hp, maxHp),
      (wi, total) => this._onWaveStart(wi, total),
      result      => this._onResult(result)
    );

    this._onGoldChange(this._manager.gold);
    this._onFortressHpChange(this._manager.fortressHp, this._manager.fortressMaxHp);
  }

  // ----------------------------------------------------------------
  //  コールバック
  // ----------------------------------------------------------------

  _onGoldChange(gold) {
    const el = document.getElementById('tac-gold');
    if (el) el.textContent = gold;
    document.querySelectorAll('#tac-palette .unit-card').forEach(card => {
      const def = ALLY_UNITS.find(u => u.id === card.dataset.unitId);
      if (def) card.classList.toggle('insufficient', gold < def.cost);
    });
  }

  _onFortressHpChange(hp, maxHp) {
    const fill = document.getElementById('tac-fortress-fill');
    const num  = document.getElementById('tac-fortress-num');
    if (!fill || !num) return;
    const ratio      = hp / maxHp;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    num.textContent  = `${hp} / ${maxHp}`;
    fill.className   = 'fortress-hp-fill';
    if      (ratio <= 0.25) fill.classList.add('crit');
    else if (ratio <= 0.5)  fill.classList.add('low');
  }

  _onWaveStart(waveIdx, total) {
    const el = document.getElementById('tac-wave');
    if (el) el.textContent = `${waveIdx + 1} / ${total}`;
    const announce = document.getElementById('wave-announce');
    if (announce) {
      announce.textContent = `WAVE ${waveIdx + 1}`;
      announce.classList.add('show');
      setTimeout(() => announce.classList.remove('show'), 2200);
    }
  }

  _updateTimeDisplay() {
    if (!this._manager) return;
    const sec = Math.floor(this._manager.elapsed / 1000);
    const m   = Math.floor(sec / 60);
    const s   = String(sec % 60).padStart(2, '0');
    const el  = document.getElementById('tac-time');
    if (el) el.textContent = `${m}:${s}`;
  }

  _onResult(result) {
    this._clearTimers();
    const sec      = Math.floor((this._manager?.elapsed ?? 0) / 1000);
    const m        = Math.floor(sec / 60);
    const s        = String(sec % 60).padStart(2, '0');
    const waveDone = this._manager?._activeWaveIdx ?? 0;
    const total    = this._stageDef.waves.length;

    const overlay  = document.getElementById('result-overlay');
    const title    = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');
    const stats    = document.getElementById('result-stats');
    if (!overlay) return;

    if (result === 'victory') {
      title.textContent    = 'VICTORY';
      title.className      = 'result-title victory';
      subtitle.textContent = 'コンドルの砦は守られた。';
    } else {
      title.textContent    = 'DEFEAT';
      title.className      = 'result-title defeat';
      subtitle.textContent = '砦は陥落した。再起を誓え。';
    }
    stats.innerHTML = `
      <span>経過時間: ${m}:${s}</span>
      <span>Wave: ${waveDone} / ${total}</span>
      <span>残Gold: ${this._manager?.gold ?? 0}</span>
    `;
    overlay.classList.remove('hidden');
  }

  _flashGold() {
    const el = document.getElementById('tac-gold');
    if (!el) return;
    el.style.color = '#d94040';
    setTimeout(() => { el.style.color = ''; }, 300);
  }

  _clearTimers() {
    if (this._timeInterval) { clearInterval(this._timeInterval); this._timeInterval = null; }
  }
}
