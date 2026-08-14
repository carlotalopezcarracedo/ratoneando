import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENES,
  type LevelIndex
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Raton } from '../entities/Raton';
import { Transition } from '../systems/Transition';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';
import { confetti, sparkles } from '../art/FX';

export interface ResultData {
  level: LevelIndex;
  success: boolean;
  title: string;
  subtitle: string;
  bonuses?: Array<[string, number]>;
  notes?: string[];
}

/** Pantalla de resultado compartida por las tres misiones (éxito y fracaso). */
export class ResultScene extends Phaser.Scene {
  private result!: ResultData;
  private raton!: Raton;

  constructor() {
    super(SCENES.RESULT);
  }

  init(data: ResultData): void {
    this.result = data;
  }

  create(): void {
    const { success, title, subtitle, level } = this.result;

    const g = this.add.graphics();
    g.fillGradientStyle(
      success ? PAL.inkSoft : 0x2c1714,
      success ? PAL.inkSoft : 0x2c1714,
      PAL.ink,
      PAL.ink,
      1
    );
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawPanel(g, 150, 92, GAME_WIDTH - 300, 486, {
      radius: 26,
      fillAlpha: 0.94,
      stroke: success ? PAL.amber : PAL.danger
    });

    this.add
      .text(GAME_WIDTH / 2, 168, title, {
        fontFamily: FONT_TITLE,
        fontSize: '64px',
        color: css(success ? PAL.cream : PAL.danger),
        fontStyle: '800',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 400 }
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 228, subtitle, {
        fontFamily: FONT_UI,
        fontSize: '22px',
        color: css(PAL.creamDim),
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 420 }
      })
      .setOrigin(0.5);

    this.raton = new Raton(this, 292, 536);
    this.raton.setDepth(20);
    if (success) {
      this.raton.celebrate();
      Audio.success();
      confetti(this, GAME_WIDTH / 2, 240, 44);
      this.time.delayedCall(320, () => sparkles(this, 300, 420, { count: 12 }));
    } else {
      this.raton.setPose('sit').setExpression('caught', true);
      this.raton.lookAtCamera(6);
      Audio.fail();
      this.cameras.main.shake(280, 0.005);
    }

    this.buildBonuses();
    this.buildButtons(level, success);

    this.input.keyboard?.once('keydown-SPACE', () => this.primaryAction(level, success));
    Transition.reveal(this);
  }

  private buildBonuses(): void {
    const bonuses = this.result.bonuses ?? [];
    const notes = this.result.notes ?? [];
    const x = 556;
    let y = 276;

    bonuses.forEach(([label, value], i) => {
      const row = this.add.container(x, y + i * 38).setAlpha(0);
      row.add(
        this.add
          .text(0, 0, label, {
            fontFamily: FONT_UI,
            fontSize: '21px',
            color: css(PAL.cream),
            fontStyle: '700'
          })
          .setOrigin(0, 0.5)
      );
      row.add(
        this.add
          .text(500, 0, `${value >= 0 ? '+' : ''}${value}`, {
            fontFamily: FONT_TITLE,
            fontSize: '26px',
            color: css(value >= 0 ? PAL.ok : PAL.danger),
            fontStyle: '800'
          })
          .setOrigin(1, 0.5)
      );
      this.tweens.add({
        targets: row,
        alpha: 1,
        x: x + 10,
        duration: 260,
        delay: 260 + i * 150,
        ease: 'Quad.easeOut',
        onStart: () => Audio.click()
      });
    });

    y += bonuses.length * 38 + 16;

    const totalRow = this.add.container(x, y).setAlpha(0);
    totalRow.add(
      this.add
        .text(0, 0, 'CAOS ACUMULADO', {
          fontFamily: FONT_UI,
          fontSize: '18px',
          color: css(PAL.amber),
          fontStyle: '900'
        })
        .setOrigin(0, 0.5)
    );
    totalRow.add(
      this.add
        .text(510, 0, `${Run.s.chaos}`, {
          fontFamily: FONT_TITLE,
          fontSize: '44px',
          color: css(PAL.amber),
          fontStyle: '800'
        })
        .setOrigin(1, 0.5)
    );
    this.tweens.add({
      targets: totalRow,
      alpha: 1,
      duration: 300,
      delay: 320 + bonuses.length * 150
    });

    notes.forEach((note, i) => {
      this.add
        .text(x, y + 42 + i * 23, `·  ${note}`, {
          fontFamily: FONT_UI,
          fontSize: '16px',
          color: css(PAL.creamDim),
          fontStyle: '600'
        })
        .setOrigin(0, 0.5)
        .setAlpha(0.9);
    });
  }

  private buildButtons(level: LevelIndex, success: boolean): void {
    if (success) {
      new Button(
        this,
        420,
        GAME_HEIGHT - 74,
        level < 3 ? 'SIGUIENTE MISIÓN' : 'VER RESULTADO',
        () => this.primaryAction(level, success),
        { width: 340, height: 62, fontSize: 25 }
      );
      new Button(this, 740, GAME_HEIGHT - 74, 'REPETIR', () => this.retry(level), {
        width: 200,
        height: 54,
        fontSize: 20,
        variant: 'secondary'
      });
    } else {
      new Button(this, 460, GAME_HEIGHT - 74, 'VOLVER A INTENTAR', () => this.retry(level), {
        width: 360,
        height: 62,
        fontSize: 25
      });
    }

    new Button(this, success ? 960 : 800, GAME_HEIGHT - 74, 'MENÚ', () => this.menu(), {
      width: 180,
      height: 50,
      fontSize: 19,
      variant: 'ghost'
    });
  }

  private primaryAction(level: LevelIndex, success: boolean): void {
    if (!success) {
      this.retry(level);
      return;
    }
    if (level < 3) {
      Transition.to(this, SCENES.LEVEL_INTRO, { level: (level + 1) as LevelIndex });
    } else {
      Transition.to(this, SCENES.FINAL);
    }
  }

  private retry(level: LevelIndex): void {
    Transition.to(this, SCENES.LEVEL_INTRO, { level });
  }

  private menu(): void {
    Audio.stopMusic();
    Transition.to(this, SCENES.MENU);
  }

  override update(_time: number, delta: number): void {
    this.raton.tick(delta);
  }
}
