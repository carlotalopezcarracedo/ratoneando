import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVELS,
  LOADING_MESSAGES,
  SCENES,
  type LevelIndex
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from '../ui/Panel';
import { Transition } from '../systems/Transition';
import { Audio } from '../systems/AudioManager';
import { pick } from '../utils/helpers';

interface LevelIntroData {
  level?: LevelIndex;
}

/** Tarjeta de misión + mensaje de carga entre niveles. */
export class LevelIntroScene extends Phaser.Scene {
  private level: LevelIndex = 1;
  private leaving = false;

  constructor() {
    super(SCENES.LEVEL_INTRO);
  }

  init(data: LevelIntroData): void {
    this.level = data.level ?? 1;
    this.leaving = false;
  }

  private go(target: string): void {
    if (this.leaving) return;
    this.leaving = true;
    Transition.to(this, target);
  }

  create(): void {
    const info = LEVELS[this.level - 1];

    const g = this.add.graphics();
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawPanel(g, 180, 200, GAME_WIDTH - 360, 300, { radius: 26, fillAlpha: 0.92 });
    g.fillStyle(PAL.amber, 1);
    g.fillRect(180, 200, GAME_WIDTH - 360, 8);

    const code = this.add
      .text(GAME_WIDTH / 2, 250, info.code, {
        fontFamily: FONT_UI,
        fontSize: '20px',
        color: css(PAL.amber),
        fontStyle: '900'
      })
      .setOrigin(0.5);

    const title = this.add
      .text(GAME_WIDTH / 2, 312, info.title, {
        fontFamily: FONT_TITLE,
        fontSize: '58px',
        color: css(PAL.cream),
        fontStyle: '800',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 420 }
      })
      .setOrigin(0.5);

    const sub = this.add
      .text(GAME_WIDTH / 2, 392, info.subtitle, {
        fontFamily: FONT_UI,
        fontSize: '23px',
        color: css(PAL.creamDim),
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 460 }
      })
      .setOrigin(0.5);

    [code, title, sub].forEach((t, i) => {
      t.setAlpha(0).setY(t.y + 22);
      this.tweens.add({
        targets: t,
        alpha: 1,
        y: t.y - 22,
        duration: 420,
        delay: 120 + i * 130,
        ease: 'Back.easeOut'
      });
    });

    const loading = this.add
      .text(GAME_WIDTH / 2, 566, pick(LOADING_MESSAGES), {
        fontFamily: FONT_UI,
        fontSize: '19px',
        color: css(PAL.creamDim),
        fontStyle: '700'
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: loading, alpha: 0.45, duration: 800, yoyo: true, repeat: -1 });

    const dots = this.add.container(GAME_WIDTH / 2, 620);
    for (let i = 0; i < 3; i++) {
      const d = this.add.circle((i - 1) * 26, 0, 7, PAL.amber);
      dots.add(d);
      this.tweens.add({
        targets: d,
        y: -12,
        duration: 380,
        yoyo: true,
        repeat: -1,
        delay: i * 130,
        ease: 'Sine.easeInOut'
      });
    }

    Audio.playMusic(this.level === 3 ? 'heist' : 'tension');
    Transition.reveal(this);

    this.time.delayedCall(2300, () => this.go(info.scene));
    this.input.keyboard?.once('keydown-SPACE', () => this.go(info.scene));
    this.input.once('pointerdown', () => this.go(info.scene));
  }
}
