/**
 * TitleScene.js — タイトル画面
 */

export class TitleScene {
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
    this._el.innerHTML = `
      <div id="scene-title">
        <div class="title-logo">
          <h1>CONDOR LEGACY</h1>
          <p class="subtitle">— Defend the Fortress —</p>
        </div>

        <nav class="title-menu">
          <button class="btn btn-gold" id="btn-start">ゲーム開始</button>
          <button class="btn"          id="btn-how">遊び方</button>
        </nav>

        <footer class="title-footer">v0.1.0</footer>

        <!-- 遊び方モーダル（初期非表示） -->
        <div id="how-modal" class="how-modal hidden">
          <div class="how-box panel">
            <h2 class="how-title">遊び方</h2>
            <ul class="how-list">
              <li>画面下のユニットカードを選択し、戦場をクリックして配置します。</li>
              <li>ゴールドを消費してユニットを召喚できます。</li>
              <li>ゴールドは時間経過で増加します。</li>
              <li>敵が砦ラインを突破すると要塞にダメージを受けます。</li>
              <li>全Waveの敵を撃退すれば勝利です。</li>
              <li>要塞のHPがゼロになると敗北です。</li>
            </ul>
            <button class="btn" id="btn-how-close">閉じる</button>
          </div>
        </div>
      </div>

      <style>
        .how-modal {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .how-box {
          width: 480px;
          max-width: 90vw;
        }
        .how-title {
          font-family: var(--font-title);
          font-size: 22px;
          color: var(--color-gold);
          margin-bottom: 20px;
          letter-spacing: 0.15em;
        }
        .how-list {
          list-style: none;
          margin-bottom: 24px;
        }
        .how-list li {
          padding: 6px 0;
          border-bottom: 1px solid var(--color-border);
          font-size: 13px;
          color: var(--color-text);
          line-height: 1.6;
        }
        .how-list li::before {
          content: '▶ ';
          color: var(--color-accent);
          font-size: 10px;
        }
      </style>
    `;

    document.getElementById('btn-start').addEventListener('click', () => {
      this._switchTo('stageSelect');
    });

    document.getElementById('btn-how').addEventListener('click', () => {
      document.getElementById('how-modal').classList.remove('hidden');
    });

    document.getElementById('btn-how-close').addEventListener('click', () => {
      document.getElementById('how-modal').classList.add('hidden');
    });
  }
}
