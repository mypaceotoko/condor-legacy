/**
 * StageSelectScene.js — ステージ選択画面
 */

import { STAGES } from '../config/stages.js';

export class StageSelectScene {
  init(appEl, switchTo) {
    this._el       = appEl;
    this._switchTo = switchTo;
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
        <div class="stage-list">
          ${stageItems}
        </div>
        <div class="back-btn-wrap">
          <button class="btn" id="btn-back">← タイトルへ</button>
        </div>
      </div>
    `;

    // ステージカードのクリック
    this._el.querySelectorAll('.stage-card').forEach(card => {
      card.addEventListener('click', () => {
        const stageId  = card.dataset.stageId;
        const stageDef = STAGES.find(s => s.id === stageId);
        if (stageDef) this._switchTo('battle', stageDef);
      });
    });

    document.getElementById('btn-back').addEventListener('click', () => {
      this._switchTo('title');
    });
  }
}
