/**
 * BattleScene.js — 戦闘画面
 *
 * - Canvas の初期化・リサイズ
 * - BattleManager / UIManager の生成・連携
 * - ユニット選択 UI の構築
 * - プレイヤーの配置操作（クリック）
 * - 結果オーバーレイの表示
 */

import { BattleManager }                        from '../game/BattleManager.js';
import { UIManager }                            from '../game/UIManager.js';
import { ALLY_UNITS, ENEMY_UNITS, getUnitImagePath } from '../config/units.js';

// 味方ユニットを配置できるX範囲(左端から canvas 幅の何%まで)
const DEPLOY_ZONE_RATIO = 0.55;

export class BattleScene {
  /**
   * @param {Object} stageDef - stages.js のステージ定義
   */
  init(appEl, switchTo, stageDef) {
    this._appEl      = appEl;
    this._switchTo   = switchTo;
    this._stageDef   = stageDef;
    this._selected   = null;      // 選択中のユニットID
    this._manager    = null;
    this._ui         = null;
    this._imageCache = {};

    this._buildHTML();
    this._preloadImages(() => this._startBattle());
  }

  update(dt) {
    if (this._manager) this._manager.update(dt);
  }

  render() {
    if (!this._ui || !this._manager) return;
    this._ui.draw(this._manager.allyUnits, this._manager.enemyUnits, 16);
    this._updateGoldDisplay();
  }

  destroy() {
    window.removeEventListener('resize', this._onResize);
    this._appEl.innerHTML = '';
  }

  // ----------------------------------------------------------------
  //  HTML構築
  // ----------------------------------------------------------------

  _buildHTML() {
    this._appEl.innerHTML = `
      <div id="scene-battle">
        <!-- 上部ステータスバー -->
        <div id="battle-header">
          <span class="battle-header-title">CONDOR LEGACY</span>

          <div class="resource-display">
            <span class="resource-label">Gold</span>
            <span class="resource-value" id="gold-display">0</span>
          </div>

          <div class="resource-display">
            <span class="resource-label">Wave</span>
            <span class="resource-value" id="wave-display-val">-</span>
          </div>

          <!-- 要塞HP -->
          <div class="fortress-hp-section">
            <span class="fortress-hp-label">要塞HP</span>
            <div class="fortress-hp-bar">
              <div class="fortress-hp-fill" id="fortress-hp-fill"></div>
            </div>
            <span class="fortress-hp-num" id="fortress-hp-num">-</span>
          </div>
        </div>

        <!-- 戦場Canvas -->
        <div id="battle-main">
          <canvas id="battle-canvas"></canvas>
          <div id="wave-announce"></div>
        </div>

        <!-- 下部パネル -->
        <div id="battle-footer">
          <div id="unit-palette">
            <!-- ユニットカードはJSで生成 -->
          </div>
          <div id="battle-controls">
            <button class="btn" id="btn-pause">一時停止</button>
            <button class="btn" id="btn-retreat">撤退</button>
          </div>
        </div>

        <!-- 結果オーバーレイ (初期非表示) -->
        <div id="result-overlay" class="hidden">
          <div class="result-box">
            <div class="result-title" id="result-title"></div>
            <div class="result-subtitle" id="result-subtitle"></div>
            <div class="result-buttons">
              <button class="btn btn-gold" id="btn-retry">もう一度</button>
              <button class="btn"          id="btn-stage-select">ステージ選択</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this._canvasEl = document.getElementById('battle-canvas');
    this._buildUnitPalette();
    this._bindHeaderButtons();
    this._bindCanvasClick();
    this._setupResize();
  }

  _buildUnitPalette() {
    const palette = document.getElementById('unit-palette');
    palette.innerHTML = ALLY_UNITS.map(def => `
      <div class="unit-card" data-unit-id="${def.id}" title="${def.description}">
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
      card.addEventListener('click', () => {
        const id = card.dataset.unitId;
        if (this._selected === id) {
          this._selected = null;
          this._clearCardSelection();
        } else {
          this._selected = id;
          this._clearCardSelection();
          card.classList.add('selected');
        }
      });
    });
  }

  _clearCardSelection() {
    document.querySelectorAll('.unit-card').forEach(c => c.classList.remove('selected'));
  }

  _bindHeaderButtons() {
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

  _bindCanvasClick() {
    this._canvasEl.addEventListener('click', (e) => {
      if (!this._manager || !this._manager.isRunning) return;
      if (!this._selected) return;

      const rect = this._canvasEl.getBoundingClientRect();
      const scaleX = this._canvasEl.width  / rect.width;
      const scaleY = this._canvasEl.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top)  * scaleY;

      // 配置可能ゾーンチェック（左側のみ）
      const maxX = this._canvasEl.width * DEPLOY_ZONE_RATIO;
      if (x < 50 || x > maxX) return;

      const ok = this._manager.deployAlly(this._selected, x, y);
      if (!ok) {
        this._flashInsufficientGold();
      }
    });
  }

  _flashInsufficientGold() {
    const el = document.getElementById('gold-display');
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
    if (this._ui) {
      this._ui.resize(w, h);
    }
  }

  // ----------------------------------------------------------------
  //  画像プリロード
  // ----------------------------------------------------------------

  _preloadImages(callback) {
    const allDefs = [...ALLY_UNITS, ...ENEMY_UNITS];
    const withImage = allDefs.filter(d => d.image !== null);

    if (withImage.length === 0) {
      // 画像未設定のユニットのみの場合はそのまま開始
      callback();
      return;
    }

    let remaining = withImage.length;
    for (const def of withImage) {
      const img = new Image();
      img.src = getUnitImagePath(def);
      img.onload = img.onerror = () => {
        this._imageCache[def.id] = img;
        if (--remaining === 0) callback();
      };
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
      (gold)          => this._onGoldChange(gold),
      (hp, maxHp)     => this._onFortressHpChange(hp, maxHp),
      (waveIdx, total) => this._onWaveStart(waveIdx, total),
      (result)        => this._onResult(result)
    );

    // 初期表示
    this._onGoldChange(this._manager.gold);
    this._onFortressHpChange(this._manager.fortressHp, this._manager.fortressMaxHp);

    this._manager.start();
  }

  // ----------------------------------------------------------------
  //  コールバック
  // ----------------------------------------------------------------

  _onGoldChange(gold) {
    const el = document.getElementById('gold-display');
    if (el) el.textContent = gold;

    // ゴールド不足カードをマーク
    document.querySelectorAll('.unit-card').forEach(card => {
      const id  = card.dataset.unitId;
      const def = ALLY_UNITS.find(u => u.id === id);
      if (def) {
        card.classList.toggle('insufficient', gold < def.cost);
      }
    });
  }

  _updateGoldDisplay() {
    if (this._manager) this._onGoldChange(this._manager.gold);
  }

  _onFortressHpChange(hp, maxHp) {
    const fill = document.getElementById('fortress-hp-fill');
    const num  = document.getElementById('fortress-hp-num');
    if (!fill || !num) return;

    const ratio = hp / maxHp;
    fill.style.width = `${Math.round(ratio * 100)}%`;
    num.textContent  = `${hp} / ${maxHp}`;

    fill.className = 'fortress-hp-fill';
    if (ratio <= 0.25) fill.classList.add('crit');
    else if (ratio <= 0.5) fill.classList.add('low');
  }

  _onWaveStart(waveIdx, total) {
    const el = document.getElementById('wave-display-val');
    if (el) el.textContent = `${waveIdx + 1} / ${total}`;

    const announce = document.getElementById('wave-announce');
    if (announce) {
      announce.textContent = `WAVE ${waveIdx + 1}`;
      announce.classList.add('show');
      setTimeout(() => announce.classList.remove('show'), 2000);
    }
  }

  _onResult(result) {
    const overlay  = document.getElementById('result-overlay');
    const title    = document.getElementById('result-title');
    const subtitle = document.getElementById('result-subtitle');

    if (result === 'victory') {
      title.textContent   = 'VICTORY';
      title.className     = 'result-title victory';
      subtitle.textContent = 'コンドルの砦は守られた。';
    } else {
      title.textContent   = 'DEFEAT';
      title.className     = 'result-title defeat';
      subtitle.textContent = '砦は陥落した。再起を誓え。';
    }

    overlay.classList.remove('hidden');
  }
}
