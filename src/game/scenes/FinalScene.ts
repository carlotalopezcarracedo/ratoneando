import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENES,
  rankFor
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { formatTime } from '../utils/helpers';
import { Raton } from '../entities/Raton';
import { Button } from '../ui/Button';
import { drawPanel } from '../ui/Panel';
import { Run } from '../systems/RunState';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { Transition } from '../systems/Transition';
import { confetti, sparkles } from '../art/FX';

export class FinalScene extends Phaser.Scene {
  private raton!: Raton;

  constructor() {
    super(SCENES.FINAL);
  }

  create(): void {
    Run.finishRun();

    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(PAL.wallShade, 0.16);
    g.fillEllipse(GAME_WIDTH / 2, 620, 1100, 300);

    Audio.playMusic('victory');
    Transition.reveal(this);
    this.playMontage();
  }

  /** Montaje corto: pata · bicicleta · nuez, y después la pose heroica. */
  private playMontage(): void {
    const items: Array<[string, string, number]> = [
      ['raton-leg-front', 'LA PATA IZQUIERDA', 1.6],
      ['bike-city', 'LAS BICICLETAS', 0.9],
      ['nut', 'LA NUEZ', 2.6]
    ];

    items.forEach(([texture, caption, scale], i) => {
      this.time.delayedCall(200 + i * 750, () => {
        const img = this.add
          .image(GAME_WIDTH / 2, 300, texture)
          .setScale(scale * 0.4)
          .setDepth(100)
          .setAlpha(0);
        const label = this.add
          .text(GAME_WIDTH / 2, 470, caption, {
            fontFamily: FONT_TITLE,
            fontSize: '44px',
            color: css(PAL.cream),
            fontStyle: '800',
            stroke: css(PAL.ink),
            strokeThickness: 8
          })
          .setOrigin(0.5)
          .setDepth(100)
          .setAlpha(0);

        this.tweens.add({ targets: [img, label], alpha: 1, duration: 200 });
        this.tweens.add({ targets: img, scale: scale * 0.5, duration: 700, ease: 'Quad.easeOut' });
        this.tweens.add({
          targets: [img, label],
          alpha: 0,
          delay: 480,
          duration: 220,
          onComplete: () => {
            img.destroy();
            label.destroy();
          }
        });
        Audio.click();
      });
    });

    this.time.delayedCall(2600, () => this.showHero());
  }

  private showHero(): void {
    this.raton = new Raton(this, 268, 560);
    this.raton.setDepth(200);
    this.raton.setPose('sit').setExpression('happy');
    this.raton.setScale(1.15);
    this.raton.lookAtCamera(999);
    Audio.success();
    confetti(this, GAME_WIDTH / 2, 200, 60);
    sparkles(this, 268, 420, { count: 16 });

    const title = this.add
      .text(268, 210, 'RATÓN', {
        fontFamily: FONT_TITLE,
        fontSize: '108px',
        color: css(PAL.cream),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 12
      })
      .setOrigin(0.5)
      .setDepth(210)
      .setScale(0.5);
    this.tweens.add({ targets: title, scale: 1, duration: 420, ease: 'Back.easeOut' });

    this.add
      .text(268, 282, 'BUEN PERRO.', {
        fontFamily: FONT_TITLE,
        fontSize: '34px',
        color: css(PAL.amber),
        fontStyle: '800'
      })
      .setOrigin(0.5)
      .setDepth(210);
    this.add
      .text(268, 320, 'CUESTIONABLES DECISIONES.', {
        fontFamily: FONT_TITLE,
        fontSize: '26px',
        color: css(PAL.creamDim),
        fontStyle: '800'
      })
      .setOrigin(0.5)
      .setDepth(210);

    this.showStats();
    this.showButtons();
  }

  private showStats(): void {
    const s = Run.s;
    const rank = rankFor(s.chaos);

    const g = this.add.graphics().setDepth(150);
    drawPanel(g, 560, 120, 660, 480, { radius: 24, fillAlpha: 0.94, stroke: PAL.amber });

    this.add
      .text(890, 168, 'INFORME FINAL', {
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: css(PAL.amber),
        fontStyle: '900'
      })
      .setOrigin(0.5)
      .setDepth(160);

    const chaosLabel = this.add
      .text(890, 216, '0', {
        fontFamily: FONT_TITLE,
        fontSize: '72px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5)
      .setDepth(160);

    this.add
      .text(890, 262, 'CAOS TOTAL', {
        fontFamily: FONT_UI,
        fontSize: '15px',
        color: css(PAL.creamDim),
        fontStyle: '900'
      })
      .setOrigin(0.5)
      .setDepth(160);

    // Contador animado.
    const counter = { v: 0 };
    this.tweens.add({
      targets: counter,
      v: s.chaos,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onUpdate: () => chaosLabel.setText(`${Math.round(counter.v)}`),
      onComplete: () => {
        chaosLabel.setText(`${s.chaos}`);
        sparkles(this, 890, 216, { count: 12, depth: 400 });
      }
    });

    const rankText = this.add
      .text(890, 314, rank.title, {
        fontFamily: FONT_TITLE,
        fontSize: '31px',
        color: css(PAL.amber),
        fontStyle: '800',
        align: 'center',
        wordWrap: { width: 580 }
      })
      .setOrigin(0.5)
      .setDepth(160)
      .setAlpha(0);
    this.tweens.add({ targets: rankText, alpha: 1, duration: 400, delay: 1400 });

    this.add
      .text(890, 364, rank.blurb, {
        fontFamily: FONT_UI,
        fontSize: '17px',
        color: css(PAL.creamDim),
        fontStyle: '600',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(160);

    const rows: Array<[string, string]> = [
      ...Run.absurdStats.slice(0, 6),
      ['Tiempo total de operaciones', formatTime(s.timeMs)],
      ['Récord anterior de CAOS', `${Save.data.bestChaos}`]
    ];

    rows.forEach(([label, value], i) => {
      const y = 404 + Math.floor(i / 2) * 34;
      const x = 600 + (i % 2) * 316;
      const row = this.add.container(x, y).setDepth(160).setAlpha(0);
      row.add(
        this.add
          .text(0, 0, label, {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: css(PAL.creamDim),
            fontStyle: '700',
            wordWrap: { width: 210 }
          })
          .setOrigin(0, 0.5)
      );
      row.add(
        this.add
          .text(290, 0, value, {
            fontFamily: FONT_TITLE,
            fontSize: '22px',
            color: css(PAL.cream),
            fontStyle: '800'
          })
          .setOrigin(1, 0.5)
      );
      this.tweens.add({ targets: row, alpha: 1, duration: 220, delay: 900 + i * 90 });
    });
  }

  private showButtons(): void {
    new Button(this, 300, GAME_HEIGHT - 74, 'JUGAR OTRA VEZ', () => this.again(), {
      width: 300,
      height: 60,
      fontSize: 24
    });
    new Button(
      this,
      640,
      GAME_HEIGHT - 74,
      'SELECCIONAR MISIÓN',
      () => Transition.to(this, SCENES.LEVEL_SELECT),
      { width: 320, height: 54, fontSize: 20, variant: 'secondary' }
    );
    new Button(this, 980, GAME_HEIGHT - 74, 'CRÉDITOS', () => Transition.to(this, SCENES.CREDITS), {
      width: 240,
      height: 54,
      fontSize: 20,
      variant: 'ghost'
    });
  }

  private again(): void {
    Run.reset();
    Transition.to(this, SCENES.LEVEL_INTRO, { level: 1 });
  }

  override update(_time: number, delta: number): void {
    this.raton?.tick(delta);
  }
}
