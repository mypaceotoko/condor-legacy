/**
 * StageSelectScene.js — ステージ選択画面
 */

import { STAGES } from '../config/stages.js';

export class StageSelectScene {
  init(appEl, switchTo) {
    this._el         = appEl;
    this._switchTo   = switchTo;
    this._battleMode = 'realTime'; // 'realTime' | 'tactical'
    this._render();
  }

  update(_dt) {}
  render() {}

  destroy() {
    this._el.innerHTML = '';
  }

  // ----------------------------------------------------------------

  _render() {
    const stageItems = STAGES.map((s, i) => `
      <div class="stage-card" data-stage-id="${s.id}">
        <div class="stage-name">Stage ${i + 1} — ${s.name.split('—')[1]?.trim() ?? s.name}</div>
        <div class="stage-desc">${s.description}</div>
      </div>
    `).join('');

    this._el.innerHTML = `
      <div id="scene-stage-select">
        <h2 class="stage-select-title">STAGE SELECT</h2>

        <div class="mode-select-wrap">
          <div class="mode-select-label">戦闘方式</div>
          <div class="mode-select-btns">
            <button class="mode-btn active" data-mode="realTime">
              リアルタイム防衛
            </button>
            <button class="mode-btn" data-mode="tactical">
              コンドルフォート風戦術
            </button>
          </div>
        </div>

        <div class="stage-list">
          ${stageItems}
        </div>
        <div class="back-btn-wrap">
          <button class="btn" id="btn-back">← タイトルへ</button>
        </div>
      </div>
    `;

    // モード選択
    this._el.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._battleMode = btn.dataset.mode;
        this._el.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // ステージカードのクリック
    this._el.querySelectorAll('.stage-card').forEach(card => {
      card.addEventListener('click', () => {
        const stageId  = card.dataset.stageId;
        const stageDef = STAGES.find(s => s.id === stageId);
        if (!stageDef) return;
        const scene = this._battleMode === 'tactical' ? 'tacticalBattle' : 'battle';
        this._switchTo(scene, stageDef);
      });
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      this._switchTo('title');
    });
  }
}
