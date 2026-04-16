/**
 * Unit.js — ゲーム内のユニットオブジェクト
 *
 * ユニット1体の状態・行動を管理する。
 * 描画は BattleScene / UIManager に任せ、ここはロジックのみ。
 */

import { getUnitImagePath } from '../config/units.js';

// ユニットの状態
export const UnitState = {
  IDLE:     'idle',
  MOVING:   'moving',
  ATTACKING: 'attacking',
  DEAD:     'dead'
};

export class Unit {
  /**
   * @param {Object} def    - units.js のユニット定義オブジェクト
   * @param {number} x      - 初期X座標 (px)
   * @param {number} y      - 初期Y座標 (px、通常は戦場の中央付近)
   * @param {HTMLImageElement|null} image - プリロード済み画像 (null = プレースホルダー)
   */
  constructor(def, x, y, image = null) {
    // --- 定義値（変化しない） ---
    this.id             = def.id;
    this.name           = def.name;
    this.side           = def.side;        // 'ally' | 'enemy'
    this.maxHp          = def.hp;
    this.attack         = def.attack;
    this.defense        = def.defense;
    this.range          = def.range;
    this.moveSpeed      = def.moveSpeed;
    this.attackInterval = def.attackInterval;
    this.cost           = def.cost   ?? 0;
    this.reward         = def.reward ?? 0;
    this.healAmount     = def.healAmount   ?? 0;
    this.healInterval   = def.healInterval ?? 0;

    // --- 動的状態 ---
    this.hp     = def.hp;
    this.x      = x;
    this.y      = y;
    this.state  = UnitState.IDLE;
    this.image  = image;         // null のときはプレースホルダー描画

    // --- タイマー ---
    this._attackTimer = 0;
    this._healTimer   = 0;

    // --- ターゲット ---
    this.target = null;   // 現在攻撃/追跡中のユニット (Unit インスタンス)

    // --- ユニーク識別子 ---
    this.uid = Unit._nextUid++;
  }

  // ----------------------------------------------------------------
  //  更新 (ゲームループから毎フレーム呼ばれる)
  // ----------------------------------------------------------------

  /**
   * @param {number}   dt      - 前フレームからの経過時間 (ms)
   * @param {Unit[]}   allies  - 味方ユニット一覧
   * @param {Unit[]}   enemies - 敵ユニット一覧
   * @param {Function} onDamageToFortress - 敵が要塞に到達した際のコールバック(damage)
   */
  update(dt, allies, enemies, onDamageToFortress) {
    if (this.state === UnitState.DEAD) return;

    const opponents = this.side === 'ally' ? enemies : allies;
    const friendlies = this.side === 'ally' ? allies : enemies;

    // ターゲットが死亡・消滅していたらリセット
    if (this.target && (this.target.state === UnitState.DEAD || !opponents.includes(this.target))) {
      this.target = null;
    }

    // 近くの敵を探す
    if (!this.target) {
      this.target = this._findNearestOpponent(opponents);
    }

    // ヒーラーの回復処理
    if (this.healAmount > 0) {
      this._healTimer += dt;
      if (this._healTimer >= this.healInterval) {
        this._healTimer = 0;
        this._healNearby(friendlies);
      }
    }

    if (!this.target) {
      // ターゲットなし → 前進
      this._advance(dt, onDamageToFortress);
      this.state = UnitState.MOVING;
      return;
    }

    const dist = this._distanceTo(this.target);

    if (dist <= this.range) {
      // 射程内 → 攻撃
      this.state = UnitState.ATTACKING;
      this._attackTimer += dt;
      if (this._attackTimer >= this.attackInterval) {
        this._attackTimer = 0;
        this._dealDamage(this.target);
      }
    } else {
      // 射程外 → ターゲットに向かって移動
      this.state = UnitState.MOVING;
      this._moveToward(this.target, dt);
    }
  }

  // ----------------------------------------------------------------
  //  ダメージ受け
  // ----------------------------------------------------------------

  /**
   * @param {number} rawDamage - 攻撃側の attack 値
   */
  takeDamage(rawDamage) {
    const dmg = Math.max(1, rawDamage - this.defense);
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) {
      this.state = UnitState.DEAD;
    }
  }

  // ----------------------------------------------------------------
  //  プライベートメソッド
  // ----------------------------------------------------------------

  _dealDamage(target) {
    target.takeDamage(this.attack);
  }

  _healNearby(friendlies) {
    for (const f of friendlies) {
      if (f === this || f.state === UnitState.DEAD) continue;
      if (f.hp >= f.maxHp) continue;
      if (this._distanceTo(f) <= this.range) {
        f.hp = Math.min(f.maxHp, f.hp + this.healAmount);
      }
    }
  }

  /** 最も近い生存中の相手を返す */
  _findNearestOpponent(opponents) {
    let nearest = null;
    let minDist = Infinity;
    for (const op of opponents) {
      if (op.state === UnitState.DEAD) continue;
      const d = this._distanceTo(op);
      if (d < minDist) {
        minDist = d;
        nearest = op;
      }
    }
    return nearest;
  }

  /** ターゲットへ移動 */
  _moveToward(target, dt) {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const speed = (this.moveSpeed * dt) / 1000;
    this.x += (dx / dist) * speed;
    this.y += (dy / dist) * speed;
  }

  /**
   * ターゲットがいないときの前進。
   * 味方は右方向(+x)、敵は左方向(-x)へ進む。
   * 画面端を超えたら要塞ダメージを与えて消滅。
   *
   * @param {number}   dt
   * @param {Function} onDamageToFortress
   */
  _advance(dt, onDamageToFortress) {
    const dir   = this.side === 'ally' ? 1 : -1;
    const speed = (this.moveSpeed * dt) / 1000;
    this.x += dir * speed;

    // 要塞への到達判定は BattleManager で行うため、
    // ここでは x を更新するのみ。コールバックは BattleManager から呼ぶ。
  }

  _distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  get isAlive() {
    return this.state !== UnitState.DEAD;
  }

  get hpRatio() {
    return this.hp / this.maxHp;
  }
}

Unit._nextUid = 0;
