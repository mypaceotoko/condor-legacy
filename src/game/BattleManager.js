/**
 * BattleManager.js — 戦闘ロジックの管理
 *
 * ユニットの生成・更新・Wave管理・勝敗判定を担当する。
 * 描画は行わない（Canvas操作は BattleScene に任せる）。
 */

import { Unit, UnitState } from './Unit.js';
import { ALLY_UNITS, ENEMY_UNITS } from '../config/units.js';

export class BattleManager {
  /**
   * @param {Object}   stageDef          - stages.js のステージ定義
   * @param {Object}   imageCache        - { unitId: HTMLImageElement } の事前ロード済み画像
   * @param {number}   canvasWidth
   * @param {number}   canvasHeight
   * @param {Function} onGoldChange      - (newGold: number) => void
   * @param {Function} onFortressHpChange - (newHp: number, maxHp: number) => void
   * @param {Function} onWaveStart       - (waveIndex: number, total: number) => void
   * @param {Function} onResult          - ('victory' | 'defeat') => void
   */
  constructor(stageDef, imageCache, canvasWidth, canvasHeight,
              onGoldChange, onFortressHpChange, onWaveStart, onResult) {
    this.stage          = stageDef;
    this.imageCache     = imageCache;
    this.canvasWidth    = canvasWidth;
    this.canvasHeight   = canvasHeight;
    this.onGoldChange   = onGoldChange;
    this.onFortressHpChange = onFortressHpChange;
    this.onWaveStart    = onWaveStart;
    this.onResult       = onResult;

    // --- 状態 ---
    this.allyUnits    = [];
    this.enemyUnits   = [];
    this.gold         = stageDef.initialGold;
    this.fortressHp   = stageDef.fortressHp;
    this.fortressMaxHp = stageDef.fortressHp;
    this.elapsed      = 0;       // ステージ開始からの経過時間 (ms)
    this.goldAccum    = 0;       // ゴールド累積カウンター
    this.isRunning    = false;
    this.isOver       = false;

    // --- Wave管理 ---
    this._waves         = [...stageDef.waves];   // コピーして管理
    this._activeWaveIdx = 0;
    this._spawnQueues   = [];    // { unitId, count, interval, timer }[]

    // --- 定義マップ(id→定義) ---
    this._allyDefs  = Object.fromEntries(ALLY_UNITS.map(u => [u.id, u]));
    this._enemyDefs = Object.fromEntries(ENEMY_UNITS.map(u => [u.id, u]));
  }

  // ----------------------------------------------------------------
  //  公開メソッド
  // ----------------------------------------------------------------

  start() {
    this.isRunning = true;
    this.elapsed   = 0;
  }

  pause() { this.isRunning = false; }
  resume() { this.isRunning = true; }

  /**
   * メインアップデート。ゲームループから呼ぶ。
   * @param {number} dt - 前フレームからの経過時間 (ms)
   */
  update(dt) {
    if (!this.isRunning || this.isOver) return;

    this.elapsed += dt;

    // ゴールド増加
    this.goldAccum += dt;
    if (this.goldAccum >= 1000) {
      const ticks = Math.floor(this.goldAccum / 1000);
      this.goldAccum -= ticks * 1000;
      this._addGold(this.stage.goldPerSec * ticks);
    }

    // Wave発火チェック
    this._checkWaves();

    // スポーンキュー処理
    this._procesSpawnQueues(dt);

    // ユニット更新
    this._updateUnits(dt);

    // 死亡したユニットの後処理
    this._cleanDeadUnits();

    // 勝敗判定
    this._checkResult();
  }

  /**
   * 味方ユニットをプレイヤー操作で配置する。
   * @param {string} unitId  - ALLY_UNITS の id
   * @param {number} x       - 配置X座標
   * @param {number} y       - 配置Y座標
   * @returns {boolean} - 配置成功なら true (ゴールド不足なら false)
   */
  deployAlly(unitId, x, y) {
    const def = this._allyDefs[unitId];
    if (!def) return false;
    if (this.gold < def.cost) return false;

    this._addGold(-def.cost);
    const img = this.imageCache[unitId] ?? null;
    const unit = new Unit(def, x, y, img);
    this.allyUnits.push(unit);
    return true;
  }

  // ----------------------------------------------------------------
  //  プライベートメソッド
  // ----------------------------------------------------------------

  _addGold(amount) {
    this.gold = Math.max(0, this.gold + amount);
    this.onGoldChange(this.gold);
  }

  _damageToFortress(amount) {
    this.fortressHp = Math.max(0, this.fortressHp - amount);
    this.onFortressHpChange(this.fortressHp, this.fortressMaxHp);
    if (this.fortressHp <= 0 && !this.isOver) {
      this._endGame('defeat');
    }
  }

  // --- Wave ---

  _checkWaves() {
    const elapsedSec = this.elapsed / 1000;
    while (
      this._activeWaveIdx < this._waves.length &&
      elapsedSec >= this._waves[this._activeWaveIdx].time
    ) {
      const wave = this._waves[this._activeWaveIdx];
      this.onWaveStart(this._activeWaveIdx, this._waves.length);
      for (const spec of wave.enemies) {
        this._spawnQueues.push({
          unitId:   spec.unitId,
          count:    spec.count,
          interval: spec.interval,
          timer:    0
        });
      }
      this._activeWaveIdx++;
    }
  }

  _procesSpawnQueues(dt) {
    for (const q of this._spawnQueues) {
      if (q.count <= 0) continue;
      q.timer += dt;
      if (q.timer >= q.interval) {
        q.timer -= q.interval;
        this._spawnEnemy(q.unitId);
        q.count--;
      }
    }
    // 完了したキューを除去
    this._spawnQueues = this._spawnQueues.filter(q => q.count > 0);
  }

  _spawnEnemy(unitId) {
    const def = this._enemyDefs[unitId];
    if (!def) return;
    const img = this.imageCache[unitId] ?? null;
    // 敵は右端から出現し、左方向(要塞側)へ向かう
    const y = this.canvasHeight / 2 + (Math.random() - 0.5) * 80;
    const unit = new Unit(def, this.canvasWidth - 40, y, img);
    this.enemyUnits.push(unit);
  }

  // --- ユニット更新 ---

  _updateUnits(dt) {
    const fortressDamageCallback = (dmg) => this._damageToFortress(dmg);

    for (const unit of this.allyUnits) {
      if (!unit.isAlive) continue;
      unit.update(dt, this.allyUnits, this.enemyUnits, fortressDamageCallback);
    }
    for (const unit of this.enemyUnits) {
      if (!unit.isAlive) continue;
      unit.update(dt, this.allyUnits, this.enemyUnits, fortressDamageCallback);

      // 敵が要塞ライン(x <= 40)を超えたらダメージ
      if (unit.x <= 40) {
        this._damageToFortress(unit.attack * 2);
        unit.hp = 0;
        unit.state = UnitState.DEAD;
      }
    }
  }

  _cleanDeadUnits() {
    // 倒した敵からゴールド回収
    for (const u of this.enemyUnits) {
      if (u.state === UnitState.DEAD && !u._rewardClaimed) {
        u._rewardClaimed = true;
        this._addGold(u.reward);
      }
    }
    this.allyUnits  = this.allyUnits.filter(u => u.isAlive);
    this.enemyUnits = this.enemyUnits.filter(u => u.isAlive);
  }

  // --- 勝敗 ---

  _checkResult() {
    if (this.isOver) return;
    const allWavesDispatched = this._activeWaveIdx >= this._waves.length;
    const noMoreSpawns       = this._spawnQueues.length === 0;
    if (allWavesDispatched && noMoreSpawns && this.enemyUnits.length === 0) {
      this._endGame('victory');
    }
  }

  _endGame(result) {
    this.isOver    = true;
    this.isRunning = false;
    this.onResult(result);
  }
}
