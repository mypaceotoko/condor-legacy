/**
 * Unit.js — ゲーム内のユニットオブジェクト
 *
 * ユニット1体の状態・行動を管理する。
 * 描画は UIManager に任せ、ここはロジックのみ。
 */

// ユニットの状態
export const UnitState = {
  IDLE:      'idle',
  MOVING:    'moving',
  ATTACKING: 'attacking',
  DEAD:      'dead'
};

export class Unit {
  /**
   * @param {Object}              def   - units.js のユニット定義オブジェクト
   * @param {number}              x     - 初期X座標 (px)
   * @param {number}              y     - 初期Y座標 (px)
   * @param {HTMLImageElement|null} image - プリロード済み画像 (null = プレースホルダー)
   */
  constructor(def, x, y, image = null) {
    // 定義値（変化しない）
    this.id             = def.id;
    this.name           = def.name;
    this.side           = def.side;          // 'ally' | 'enemy'
    this.maxHp          = def.hp;
    this.attack         = def.attack;
    this.defense        = def.defense;
    this.range          = def.range;
    this.moveSpeed      = def.moveSpeed;
    this.attackInterval = def.attackInterval;
    this.cost           = def.cost         ?? 0;
    this.reward         = def.reward       ?? 0;
    this.healAmount     = def.healAmount   ?? 0;
    this.healInterval   = def.healInterval ?? 0;
    this.type           = def.type         ?? 'normal';
    this.mineDamage     = def.mineDamage   ?? 0;
    this.mineRadius     = def.mineRadius   ?? 40;
    this.burstCount     = def.burstCount   ?? 1;   // 1回の攻撃サイクルで発射する弾数
    this.burstDelay     = def.burstDelay   ?? 150; // バースト内の連射間隔 (ms)

    // 動的状態
    this.hp    = def.hp;
    this.x     = x;
    this.y     = y;
    this.state = UnitState.IDLE;
    this.image = image;

    // タイマー
    this._attackTimer    = 0;
    this._healTimer      = 0;
    this._burstRemaining = 0; // バースト中の残弾数
    this._burstTimer     = 0; // バースト内の次弾までのタイマー

    // ターゲット
    this.target = null;

    // ユニーク識別子
    this.uid = Unit._nextUid++;

    /**
     * ダメージを与えたときに呼ばれるコールバック。
     * BattleManager がセットする。
     * @type {((targetX: number, targetY: number, dmg: number) => void) | null}
     */
    this.onDamageDealt = null;

    /**
     * 回復したときに呼ばれるコールバック。
     * @type {((targetX: number, targetY: number, amount: number) => void) | null}
     */
    this.onHealDealt = null;

    /**
     * ワーカーが地雷を設置したときに呼ばれるコールバック。
     * BattleManager がセットする。
     * @type {((x: number, y: number) => void) | null}
     */
    this.onMineDeploy = null;
  }

  // ----------------------------------------------------------------
  //  更新 (ゲームループから毎フレーム呼ばれる)
  // ----------------------------------------------------------------

  /**
   * @param {number}   dt      - 前フレームからの経過時間 (ms)
   * @param {Unit[]}   allies  - 味方ユニット一覧
   * @param {Unit[]}   enemies - 敵ユニット一覧
   */
  update(dt, allies, enemies) {
    if (this.state === UnitState.DEAD) return;

    const opponents  = this.side === 'ally' ? enemies : allies;
    const friendlies = this.side === 'ally' ? allies  : enemies;

    // 死亡したターゲットをリセット
    if (this.target && (this.target.state === UnitState.DEAD || !opponents.includes(this.target))) {
      this.target = null;
    }

    // 最寄りの相手を探す
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

    // ── 固定兵器: 移動しない、射程内の敵だけ攻撃 ──────────────
    if (this.type === 'fixedWeapon') {
      if (this.target && this._distanceTo(this.target) <= this.range) {
        this.state = UnitState.ATTACKING;

        // バースト中: 次弾の発射タイミングを待つ
        if (this._burstRemaining > 0) {
          this._burstTimer += dt;
          if (this._burstTimer >= this.burstDelay) {
            this._burstTimer = 0;
            this._burstRemaining--;
            if (this.target?.isAlive) this._dealDamage(this.target);
          }
        } else {
          // 通常サイクル: attackInterval ごとにバースト開始
          this._attackTimer += dt;
          if (this._attackTimer >= this.attackInterval) {
            this._attackTimer    = 0;
            this._burstRemaining = this.burstCount - 1; // 1発目はここで撃つ
            this._burstTimer     = 0;
            this._dealDamage(this.target);
          }
        }
      } else {
        this.state           = UnitState.IDLE;
        this._burstRemaining = 0; // ターゲットを失ったらバーストリセット
      }
      return;
    }

    // ── ワーカー: 前進しながら地雷を設置 ──────────────────────
    if (this.type === 'worker') {
      this._attackTimer += dt;
      if (this._attackTimer >= this.attackInterval) {
        this._attackTimer = 0;
        if (this.onMineDeploy) this.onMineDeploy(this.x, this.y);
      }
      this._advance(dt);
      this.state = UnitState.MOVING;
      return;
    }

    // ── 通常ユニット ────────────────────────────────────────────
    if (!this.target) {
      this._advance(dt);
      this.state = UnitState.MOVING;
      return;
    }

    const dist = this._distanceTo(this.target);

    if (dist <= this.range) {
      this.state = UnitState.ATTACKING;
      this._attackTimer += dt;
      if (this._attackTimer >= this.attackInterval) {
        this._attackTimer = 0;
        this._dealDamage(this.target);
      }
    } else {
      this.state = UnitState.MOVING;
      this._moveToward(this.target, dt);
    }
  }

  // ----------------------------------------------------------------
  //  ダメージ受け
  // ----------------------------------------------------------------

  /**
   * @param {number} rawDamage - 攻撃側の attack 値（防御を引く前）
   */
  takeDamage(rawDamage) {
    const dmg = Math.max(1, rawDamage - this.defense);
    this.hp   = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) this.state = UnitState.DEAD;
    return dmg;  // 実ダメージ量を返す
  }

  // ----------------------------------------------------------------
  //  プライベートメソッド
  // ----------------------------------------------------------------

  _dealDamage(target) {
    const dmg = target.takeDamage(this.attack);
    if (this.onDamageDealt) {
      this.onDamageDealt(target.x, target.y, dmg);
    }
  }

  _healNearby(friendlies) {
    for (const f of friendlies) {
      if (f === this || f.state === UnitState.DEAD) continue;
      if (f.hp >= f.maxHp) continue;
      if (this._distanceTo(f) <= this.range) {
        const healed = Math.min(this.healAmount, f.maxHp - f.hp);
        f.hp += healed;
        if (this.onHealDealt && healed > 0) {
          this.onHealDealt(f.x, f.y, healed);
        }
      }
    }
  }

  _findNearestOpponent(opponents) {
    let nearest = null;
    let minDist = Infinity;
    for (const op of opponents) {
      if (op.state === UnitState.DEAD) continue;
      const d = this._distanceTo(op);
      if (d < minDist) { minDist = d; nearest = op; }
    }
    return nearest;
  }

  _moveToward(target, dt) {
    const dx   = target.x - this.x;
    const dy   = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return;
    const speed = (this.moveSpeed * dt) / 1000;
    this.x += (dx / dist) * speed;
    this.y += (dy / dist) * speed;
  }

  /**
   * ターゲットがいないときの前進。
   * 味方は右(+x)、敵は左(-x)へ進む。
   * 画面外への到達判定は BattleManager が担当する。
   */
  _advance(dt) {
    const dir   = this.side === 'ally' ? 1 : -1;
    const speed = (this.moveSpeed * dt) / 1000;
    this.x += dir * speed;
  }

  _distanceTo(other) {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  get isAlive()  { return this.state !== UnitState.DEAD; }
  get hpRatio()  { return this.hp / this.maxHp; }
}

Unit._nextUid = 0;
