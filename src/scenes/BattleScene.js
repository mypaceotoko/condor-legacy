/**
 * BattleScene.js — 戦闘画面
 *
 * - Canvas 初期化・リサイズ
 * - BattleManager / UIManager 生成・連携
 * - ユニット選択 UI（クリック + キーボード 1〜6）
 * - プレイヤー配置操作
 * - 速度制御 (1x / 2x)
 * - 結果オーバーレイ
 */

import { BattleManager }                             from '../game/BattleManager.js';
import { UIManager }                                 from '../game/UIManager.js';
import { ALLY_UNITS, ENEMY_UNITS, getUnitImagePath } from '../config/units.js';

const DEPLOY_ZONE_RATIO = 0.55;

export class BattleScene {
  init(appEl, switchTo, stageDef) {
    this._appEl      = appEl;
    this._switchTo   = switchTo;
    this._stageDef   = stageDef;
    this._selected   = null;
    this._manager    = null;
    this._ui         = null;
    this._imageCache = {};
    this._speedMult  = 1;        // 1 or 2
    this._timeInterval = null;

    this._buildHTML();
    this._preloadImages(() => this._startBattle());
  }

  update(dt) {
    if (!this._manager) return;
    // 速度倍率を適用してゲームロジックを更新
    this._manager.update(dt * this._speedMult);
  }

  render(dt) {
    if (!this._ui || !this._manager) return;

    const showZone = this._selected !== null && this._manager.isRunning;
    this._ui.draw(
      this._manager.allyUnits,
      this._manager.enemyUnits,
      dt * this._speedMult,
      showZone
    );

    // BattleManager が蓄積したフロートイベントを UIManager に渡す
    for (const ev of this._manager.floatEvents) {
      this._ui.addFloatText(ev.x, ev.y, ev.text, ev.color);
    }
  }

  destroy() {
    this._clearTimers();
    this._removeKeyListener();
    window.removeEventListener('resize', this._onResize);
    this._appEl.innerHTML = '';
  }

  // ----------------------------------------------------------------
  //  HTML 構築
  // ----------------------------------------------------------------

  _buildHTML() {
    this._appEl.innerHTML = `
      <div id="scene-battle">

        <div id="battle-header">
          <span class="battle-header-title">CONDOR LEGACY</span>

          <div class="resource-display">
            <span class="resource-label">Gold</span>
            <span class="resource-value" id="gold-display">0</span>
          </div>

          <div class="resource-display">
            <span class="resource-label">Wave</span>
            <span class="resource-value" id="wave-display-val">待機中</span>
          </div>

          <div class="resource-display">
            <span class="resource-label">Time</span>
            <span class="resource-value" id="time-display">0:00</span>
          </div>

          <div class="fortress-hp-section">
            <span class="fortress-hp-label">要塞HP</span>
            <div class="fortress-hp-bar">
              <div class="fortress-hp-fill" id="fortress-hp-fill" style="width:100%"></div>
            </div>
            <span class="fortress-hp-num" id="fortress-hp-num">-</span>
          </div>
        </div>

        <div id="battle-main">
          <canvas id="battle-canvas"></canvas>
          <div id="wave-announce"></div>
        </div>

        <div id="battle-footer">
          <div id="unit-palette"></div>
          <div id="battle-controls">
            <button class="btn" id="btn-speed">2x速</button>
            <button class="btn" id="btn-pause">一時停止</button>
            <button class="btn" id="btn-retreat">撤退</button>
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

        <!-- ユニット情報ツールチップ -->
        <div id="unit-tooltip" class="hidden"></div>

      </div>
    `;

    this._canvasEl = document.getElementById('battle-canvas');
    this._buildUnitPalette();
    this._bindButtons();
    this._bindCanvasClick();
    this._setupResize();
    this._setupKeyboard();
  }

  // ----------------------------------------------------------------
  //  ユニットパレット
  // ----------------------------------------------------------------

  _buildUnitPalette() {
    const palette = document.getElementById('unit-palette');
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
      card.addEventListener('click', () => this._selectUnit(card.dataset.unitId));
      card.addEventListener('mouseenter', (e) => this._showTooltip(card.dataset.unitId, e));
      card.addEventListener('mouseleave', ()  => this._hideTooltip());
    });
  }

  _selectUnit(id) {
    if (this._selected === id) {
      this._selected = null;
      this._clearCardSelection();
    } else {
      this._selected = id;
      this._clearCardSelection();
      document.querySelector(`.unit-card[data-unit-id="${id}"]`)?.classList.add('selected');
    }
  }

  _clearCardSelection() {
    document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
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
        <span>HP: ${def.hp}</span>
        <span>ATK: ${def.attack}</span>
        <span>DEF: ${def.defense}</span>
        <span>射程: ${def.range}</span>
        <span>速度: ${def.moveSpeed}</span>
      </div>
    `;
    // いったん visible にしてから高さを読む
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
  //  ボタン
  // ----------------------------------------------------------------

  _bindButtons() {
    document.getElementById('btn-speed').addEventListener('click', () => {
      this._speedMult = this._speedMult === 1 ? 2 : 1;
      document.getElementById('btn-speed').textContent =
        this._speedMult === 2 ? '1x速' : '2x速';
      document.getElementById('btn-speed').classList.toggle('active', this._speedMult === 2);
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      if (!this._manager) return;
      if (this._manager.isRunning) {
        this._manager.pause();
        document.getElementById('btn-pause').textContent = '再開';
      } else {
        this._manager.resume();
        document.getElementById('btn-pause').textContent = '一時停止';
      }
    });

    document.getElementById('btn-retreat').addEventListener('click', () => {
      if (confirm('撤退してステージ選択に戻りますか？')) {
        this._switchTo('stageSelect');
      }
    });

    document.getElementById('btn-retry').addEventListener('click', () => {
      this._switchTo('battle', this._stageDef);
    });

    document.getElementById('btn-stage-select').addEventListener('click', () => {
      this._switchTo('stageSelect');
    });
  }

  // ----------------------------------------------------------------
  //  キーボードショートカット
  // ----------------------------------------------------------------

  _setupKeyboard() {
    this._onKeyDown = (e) => {
      // 1〜6 でユニット選択
      const idx = parseInt(e.key, 10) - 1;
      if (idx >= 0 && idx < ALLY_UNITS.length) {
        this._selectUnit(ALLY_UNITS[idx].id);
        return;
      }
      // ESC で選択解除
      if (e.key === 'Escape') {
        this._selected = null;
        this._clearCardSelection();
      }
      // Space でポーズ切替
      if (e.key === ' ') {
        e.preventDefault();
        document.getElementById('btn-pause')?.click();
      }
    };
    window.addEventListener('keydown', this._onKeyDown);
  }

  _removeKeyListener() {
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);
  }

  // ----------------------------------------------------------------
  //  Canvas クリック → ユニット配置
  // ----------------------------------------------------------------

  _bindCanvasClick() {
    this._canvasEl.addEventListener('click', (e) => {
      if (!this._manager?.isRunning || !this._selected) return;

      const rect   = this._canvasEl.getBoundingClientRect();
      const scaleX = this._canvasEl.width  / rect.width;
      const scaleY = this._canvasEl.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top)  * scaleY;

      const maxX = this._canvasEl.width * DEPLOY_ZONE_RATIO;
      if (x < 50 || x > maxX) return;

      if (!this._manager.deployAlly(this._selected, x, y)) {
        this._flashGold();
      }
    });
  }

  _flashGold() {
    const el = document.getElementById('gold-display');
    if (!el) return;
    el.style.color = '#d94040';
    setTimeout(() => { el.style.color = ''; }, 300);
  }

  // ----------------------------------------------------------------
  //  Canvas リサイズ
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
    const allDefs   = [...ALLY_UNITS, ...ENEMY_UNITS];
    const withImage = allDefs.filter(d => d.image !== null);

    if (withImage.length === 0) { callback(); return; }

    let remaining = withImage.length;
    for (const def of withImage) {
      const img  = new Image();
      img.src    = getUnitImagePath(def);
      const done = () => {
        this._imageCache[def.id] = img;
        if (--remaining === 0) callback();
      };
      img.onload  = done;
      img.onerror = done;
    }
  }

  // ----------------------------------------------------------------
  //  戦闘開始
  // ----------------------------------------------------------------

  _startBattle() {
    this._resizeCanvas();
    this._ui = new UIManager(this._canvasEl);

    this._manager = new BattleManager(
      this._stageDef,
      this._imageCache,
      this._canvasEl.width,
      this._canvasEl.height,
      (gold)           => this._onGoldChange(gold),
      (hp, maxHp)      => this._onFortressHpChange(hp, maxHp),
      (waveIdx, total) => this._onWaveStart(waveIdx, total),
      (result)         => this._onResult(result)
    );

    this._onGoldChange(this._manager.gold);
    this._onFortressHpChange(this._manager.fortressHp, this._manager.fortressMaxHp);

    // 経過時間表示 (500ms ごと)
    this._timeInterval = setInterval(() => this._updateTimeDisplay(), 500);

    this._manager.start();
  }

  // ----------------------------------------------------------------
  //  タイマー・リスナーのクリーンアップ
  // ----------------------------------------------------------------

  _clearTimers() {
    if (this._timeInterval) {
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    }
  }

  // ----------------------------------------------------------------
  //  コールバック・表示更新
  // ----------------------------------------------------------------

  _onGoldChange(gold) {
    const el = document.getElementById('gold-display');
    if (el) el.textContent = gold;
    document.querySelectorAll('.unit-card').forEach(card => {
      const def = ALLY_UNITS.find(u => u.id === card.dataset.unitId);
      if (def) card.classList.toggle('insufficient', gold < def.cost);
    });
  }

  _onFortressHpChange(hp, maxHp) {
    const fill = document.getElementById('fortress-hp-fill');
    const num  = document.getElementById('fortress-hp-num');
    if (!fill || !num) return;
    const ratio = hp / maxHp;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    num.textContent  = `${hp} / ${maxHp}`;
    fill.className   = 'fortress-hp-fill';
    if (ratio <= 0.25)     fill.classList.add('crit');
    else if (ratio <= 0.5) fill.classList.add('low');
  }

  _onWaveStart(waveIdx, total) {
    const el = document.getElementById('wave-display-val');
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
    const el  = document.getElementById('time-display');
    if (el) el.textContent = `${m}:${s}`;
  }

  _onResult(result) {
    this._clearTimers();

    const sec     = Math.floor((this._manager?.elapsed ?? 0) / 1000);
    const m       = Math.floor(sec / 60);
    const s       = String(sec % 60).padStart(2, '0');
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
}
