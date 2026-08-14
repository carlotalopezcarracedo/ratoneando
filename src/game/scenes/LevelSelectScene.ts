import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVELS,
  SCENES,
  type LevelIndex
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Transition } from '../systems/Transition';
import { Save } from '../systems/SaveManager';
import { Run } from '../systems/RunState';
import { Audio } from '../systems/AudioManager';

export class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super(SCENES.LEVEL_SELECT);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(GAME_WIDTH / 2, 96, 'SELECCIONAR MISIÓN', {
        fontFamily: FONT_TITLE,
        fontSize: '52px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5);

    LEVELS.forEach((info, i) => {
      const x = 240 + i * 400;
      const unlocked = Save.data.unlocked >= info.index;
      const best = Save.data.bestPerLevel[i];

      const card = this.add.graphics();
      drawPanel(card, x - 170, 170, 340, 360, {
        radius: 22,
        fillAlpha: unlocked ? 0.95 : 0.6,
        stroke: unlocked ? PAL.amber : PAL.creamDim,
        strokeWidth: unlocked ? 4 : 2
      });

      this.add
        .text(x, 210, info.code, {
          fontFamily: FONT_UI,
          fontSize: '16px',
          color: css(unlocked ? PAL.amber : PAL.creamDim),
          fontStyle: '900'
        })
        .setOrigin(0.5);

      this.add
        .text(x, 274, info.title, {
          fontFamily: FONT_TITLE,
          fontSize: '30px',
          color: css(unlocked ? PAL.cream : PAL.creamDim),
          fontStyle: '800',
          align: 'center',
          wordWrap: { width: 290 }
        })
        .setOrigin(0.5);

      this.add
        .text(x, 356, unlocked ? info.subtitle : 'Bloqueada. Ratón aún no ha llegado hasta aquí.', {
          fontFamily: FONT_UI,
          fontSize: '17px',
          color: css(PAL.creamDim),
          fontStyle: '600',
          align: 'center',
          wordWrap: { width: 280 }
        })
        .setOrigin(0.5);

      if (unlocked && best > 0) {
        this.add
          .text(x, 424, `MEJOR CAOS · ${best}`, {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: css(PAL.amber),
            fontStyle: '900'
          })
          .setOrigin(0.5);
      }

      const btn = new Button(
        this,
        x,
        486,
        unlocked ? 'JUGAR' : 'BLOQUEADA',
        () => this.play(info.index as LevelIndex),
        { width: 220, height: 52, fontSize: 22, variant: unlocked ? 'primary' : 'ghost' }
      );
      btn.setEnabled(unlocked);
    });

    new Button(this, GAME_WIDTH / 2 - 150, GAME_HEIGHT - 64, 'VOLVER', () => Transition.to(this, SCENES.MENU), {
      width: 220,
      height: 54,
      fontSize: 22,
      variant: 'secondary'
    });

    new Button(
      this,
      GAME_WIDTH / 2 + 150,
      GAME_HEIGHT - 64,
      'PERSONAJES',
      () => Transition.to(this, SCENES.CHARACTER_TEST),
      { width: 220, height: 54, fontSize: 20, variant: 'ghost' }
    );

    this.input.keyboard?.once('keydown-ESC', () => Transition.to(this, SCENES.MENU));
    Audio.playMusic('menu');
    Transition.reveal(this);
  }

  private play(level: LevelIndex): void {
    Run.reset();
    Transition.to(this, SCENES.LEVEL_INTRO, { level });
  }
}
