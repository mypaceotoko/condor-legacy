/**
 * Game.js — ゲームループとシーン管理
 *
 * シーンの切り替え・requestAnimationFrame ループを管理する。
 * 各シーン(TitleScene, BattleScene 等)は update(dt) / render() を実装すること。
 */

export class Game {
  constructor(appEl) {
    this.appEl       = appEl;
    this._scenes     = {};        // name → Scene インスタンス
    this._current    = null;
    this._lastTime   = 0;
    this._rafId      = null;
    this._running    = false;
  }

  /**
   * シーンを登録する。
   * @param {string} name
   * @param {Object} scene - { init(), update(dt), render(), destroy() }
   */
  register(name, scene) {
    this._scenes[name] = scene;
  }

  /**
   * 指定のシーンに切り替える。
   * @param {string} name
   * @param {*}      [args] - シーンに渡す任意データ
   */
  switchTo(name, args) {
    if (this._current) {
      if (typeof this._current.destroy === 'function') {
        this._current.destroy();
      }
      this.appEl.innerHTML = '';
    }

    const scene = this._scenes[name];
    if (!scene) throw new Error(`Scene "${name}" is not registered.`);

    this._current = scene;
    if (typeof scene.init === 'function') {
      scene.init(this.appEl, (targetScene, targetArgs) => {
        this.switchTo(targetScene, targetArgs);
      }, args);
    }
  }

  /** ゲームループ開始 */
  start(initialScene, args) {
    this._running  = true;
    this._lastTime = performance.now();
    this.switchTo(initialScene, args);
    this._loop(this._lastTime);
  }

  _loop(now) {
    if (!this._running) return;
    const dt = Math.min(now - this._lastTime, 100);   // 最大100ms でキャップ
    this._lastTime = now;

    if (this._current) {
      if (typeof this._current.update === 'function') {
        this._current.update(dt);
      }
      if (typeof this._current.render === 'function') {
        this._current.render();
      }
    }

    this._rafId = requestAnimationFrame(t => this._loop(t));
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }
}
