/**
 * main.js — エントリーポイント
 *
 * ゲームインスタンスを生成し、シーンを登録してスタートする。
 */

import { Game }                  from './game/Game.js';
import { TitleScene }            from './scenes/TitleScene.js';
import { StageSelectScene }      from './scenes/StageSelectScene.js';
import { BattleScene }           from './scenes/BattleScene.js';
import { TacticalBattleScene }   from './scenes/TacticalBattleScene.js';

const appEl = document.getElementById('app');
if (!appEl) throw new Error('#app element not found.');

const game = new Game(appEl);

game.register('title',          new TitleScene());
game.register('stageSelect',    new StageSelectScene());
game.register('battle',         new BattleScene());
game.register('tacticalBattle', new TacticalBattleScene());

game.start('title');
