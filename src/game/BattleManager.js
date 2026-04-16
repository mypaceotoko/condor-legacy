/**
 * BattleManager.js — 戦闘ロジックの管理
 *
 * ユニット生成・Wave管理・Gold管理・勝敗判定を担当する。
 * 描画は行わない。
 */

import { Unit, UnitState } from './Unit.js';
import { ALLY_UNITS, ENEMY_UNITS } from '../config/units.js';

export class BattleManager {
  /**
   * @param {Object}   stageDef
   * @param {Object}   imageCache            - { unitId: HTMLImageElement }
   * @param {number}   canvasWidth
   * @param {number}   canvasHeight
   * @param {Function} onGoldChange          - (gold: number) => void
   * @param {Function} onFortressHpChange    - (hp: number, maxHp: number) => void
   * @param {Function} onWaveStart           - (waveIndex: number, total: number) => void
   * @param {Function} onResult              - ('victory' | 'defeat') => void
   */
  constructor(stageDef, imageCache, canvasWidth, canvasHeight,
              onGoldChange, onFortressHpChange, onWaveStart, onResult) {
    this.stage              = stageDef;
    this.imageCache         = imageCache;
    this.canvasWidth        = canvasWidth;
    this.canvasHeight       = canvasHeight;
    this.onGoldChange       = onGoldChange;
    this.onFortressHpChange = onFortressHpChange;
    this.onWaveStart        = onWaveStart;
    this.onResult           = onResult;

    // 状態
    this.allyUnits     = [];
    this.enemyUnits    = [];
    this.gold          = stageDef.initialGold;
    this.fortressHp    = stageDef.fortressHp;
    this.fortressMaxHp = stageDef.fortressHp;
    this.elapsed       = 0;       // ステージ開始からの経過時間 (ms)
    this.isRunning     = false;
    this.isOver        = false;

    // Wave 管理
    this._waves         = [...stageDef.waves];
    this._activeWaveIdx = 0;
    this._spawnQueues   = [];    // { unitId, count, interval, timer }[]

    // Gold 累積
    this._goldAccum = 0;

    // ユニット定義マップ
    this._allyDefs  = Object.fromEntries(ALLY_UNITS.map(u  => [u.id, u]));
    this._enemyDefs = Object.fromEntries(ENEMY_UNITS.map(u => [u.id, u]));

    /**
     * フレームごとに発生したフロートテキストイベント。
     * BattleScene が毎フレーム読み取り、UIManager に渡す。
     * update() の先頭でクリアされる。
     * @type {{ x: number, y: number, text: string, color: string }[]}
     */
    this.floatEvents = [];
  }

  // ----------------------------------------------------------------
  //  公開メソッド
  // ----------------------------------------------------------------

  start()  { this.isRunning = true; this.elapsed = 0; }
  pause()  { this.isRunning = false; }
  resume() { this.isRunning = true; }

  /**
   * メインアップデート。Game ループから毎フレーム呼ぶ。
   * @param {number} dt - 経過時間 (ms)
   */
  update(dt) {
    if (!this.isRunning || this.isOver) return;

    // フロートイベントをリセット
    this.floatEvents = [];

    this.elapsed += dt;

    // Gold 時間増加
    this._goldAccum += dt;
    if (this._goldAccum >= 1000) {
      const ticks = Math.floor(this._goldAccum / 1000);
      this._goldAccum -= ticks * 1000;
      this._addGold(this.stage.goldPerSec * ticks);
    }

    this._checkWaves();
    this._processSpawnQueues(dt);
    this._updateUnits(dt);
    this._cleanDeadUnits();
    this._checkResult();
  }

  /**
   * 味方ユニットをプレイヤー操作で配置する。
   * @param {string} unitId
   * @param {number} x
   * @param {number} y
   * @returns {boolean} 配置成功なら true
   */
  deployAlly(unitId, x, y) {
    const def = this._allyDefs[unitId];
    if (!def || this.gold < def.cost) return false;
    this._addGold(-def.cost);
    const unit = this._createUnit(def, x, y);
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
    if (this.fortressHp <= 0 && !this.isOver) this._endGame('defeat');
  }

  // --- ユニット生成 ---

  /**
   * ユニット定義からインスタンスを生成し、コールバックを設定する。
   */
  _createUnit(def, x, y) {
    const img  = this.imageCache[def.id] ?? null;
    const unit = new Unit(def, x, y, img);

    // ダメージ演出コールバック
    unit.onDamageDealt = (tx, ty, dmg) => {
      const color = unit.side === 'ally' ? '#ff6060' : '#ffcc44';
      this.floatEvents.push({ x: tx, y: ty - 16, text: `-${dmg}`, color });
    };

    // 回復演出コールバック
    unit.onHealDealt = (tx, ty, amount) => {
      this.floatEvents.push({ x: tx, y: ty - 16, text: `+${amount}`, color: '#60ff90' });
    };

    return unit;
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

  _processSpawnQueues(dt) {
    for (const q of this._spawnQueues) {
      if (q.count <= 0) continue;
      q.timer += dt;
      if (q.timer >= q.interval) {
        q.timer -= q.interval;
        this._spawnEnemy(q.unitId);
        q.count--;
      }
    }
    this._spawnQueues = this._spawnQueues.filter(q => q.count > 0);
  }

  _spawnEnemy(unitId) {
    const def = this._enemyDefs[unitId];
    if (!def) return;
    const y    = this.canvasHeight / 2 + (Math.random() - 0.5) * 100;
    const unit = this._createUnit(def, this.canvasWidth - 40, y);
    this.enemyUnits.push(unit);
  }

  // --- ユニット更新 ---

  _updateUnits(dt) {
    for (const unit of this.allyUnits) {
      if (!unit.isAlive) continue;
      unit.update(dt, this.allyUnits, this.enemyUnits);

      // 右端を超えた味方ユニットはキャンバス内に留める
      if (unit.x > this.canvasWidth - 20) unit.x = this.canvasWidth - 20;
    }

    for (const unit of this.enemyUnits) {
      if (!unit.isAlive) continue;
      unit.update(dt, this.allyUnits, this.enemyUnits);

      // 要塞ラインを超えた敵はダメージを与えて消滅
      if (unit.x <= 42) {
        this._damageToFortress(Math.ceil(unit.attack * 1.5));
        unit.hp    = 0;
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

  // --- 勝敗判定 ---

  _checkResult() {
    if (this.isOver) return;
    const allDispatched = this._activeWaveIdx >= this._waves.length;
    const noMoreSpawns  = this._spawnQueues.length === 0;
    if (allDispatched && noMoreSpawns && this.enemyUnits.length === 0) {
      this._endGame('victory');
    }
  }

  _endGame(result) {
    this.isOver    = true;
    this.isRunning = false;
    this.onResult(result);
  }
}
