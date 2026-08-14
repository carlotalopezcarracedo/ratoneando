import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GAME_WIDTH } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { Run } from '../systems/RunState';
import { drawPanel } from './Panel';

/** Barra superior común a los tres niveles: misión + CAOS. */
export class MissionHUD extends Phaser.GameObjects.Container {
  private readonly chaosText: Phaser.GameObjects.Text;
  private shownChaos = 0;

  constructor(scene: Phaser.Scene, code: string, title: string) {
    super(scene, 0, 0);
    this.setScrollFactor(0).setDepth(6000);

    const g = scene.add.graphics();
    drawPanel(g, 18, 14, 430, 62, { radius: 18, fillAlpha: 0.82, strokeWidth: 3 });
    drawPanel(g, GAME_WIDTH - 268, 14, 250, 62, { radius: 18, fillAlpha: 0.82, strokeWidth: 3 });
    this.add(g);

    this.add(
      scene.add
        .text(38, 24, code, {
          fontFamily: FONT_UI,
          fontSize: '13px',
          color: css(PAL.amber),
          fontStyle: '900'
        })
        .setOrigin(0, 0)
    );
    this.add(
      scene.add
        .text(38, 40, title, {
          fontFamily: FONT_TITLE,
          fontSize: '25px',
          color: css(PAL.cream),
          fontStyle: '800'
        })
        .setOrigin(0, 0)
    );

    this.add(
      scene.add
        .text(GAME_WIDTH - 248, 24, 'CAOS', {
          fontFamily: FONT_UI,
          fontSize: '13px',
          color: css(PAL.amber),
          fontStyle: '900'
        })
        .setOrigin(0, 0)
    );

    this.chaosText = scene.add
      .text(GAME_WIDTH - 38, 34, '0', {
        fontFamily: FONT_TITLE,
        fontSize: '32px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(1, 0);
    this.add(this.chaosText);

    scene.add.existing(this);
  }

  /** Anima el contador hacia el CAOS real. */
  tick(delta: number): void {
    const target = Run.s.chaos;
    if (this.shownChaos === target) return;
    const step = Math.max(1, Math.ceil(Math.abs(target - this.shownChaos) * (delta / 90)));
    this.shownChaos += Math.sign(target - this.shownChaos) * step;
    if (Math.abs(target - this.shownChaos) < step) this.shownChaos = target;
    this.chaosText.setText(`${this.shownChaos}`);
  }

  bump(positive: boolean): void {
    this.chaosText.setColor(css(positive ? PAL.ok : PAL.danger));
    this.scene.tweens.add({
      targets: this.chaosText,
      scale: 1.28,
      duration: 130,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => this.chaosText.setColor(css(PAL.cream))
    });
  }
}
