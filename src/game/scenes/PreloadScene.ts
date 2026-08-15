import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  LOADING_MESSAGES,
  SCENES,
  SVG_LOAD_SCALE,
  type LevelIndex
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { assetUrl, pick } from '../utils/helpers';
import { Save } from '../systems/SaveManager';
import { CHARACTER_TEXTURES } from '../art/CharacterRig';

const PROPS = [
  'bike-city',
  'bike-road',
  'bike-mtb',
  'wheel-fat',
  'wheel-slim',
  'cyclist-body',
  'cyclist-leg',
  'nut',
  'nut-jar',
  'ball',
  'shoe',
  'paw-icon',
  'plant',
  'bowl'
];

export class PreloadScene extends Phaser.Scene {
  private bar!: Phaser.GameObjects.Graphics;
  private percent!: Phaser.GameObjects.Text;
  private earL!: Phaser.GameObjects.Graphics;
  private earR!: Phaser.GameObjects.Graphics;
  private jumpTo: LevelIndex | null = null;
  private characterTest = false;

  constructor() {
    super(SCENES.PRELOAD);
  }

  init(data: { jumpTo?: LevelIndex | null; characterTest?: boolean }): void {
    this.jumpTo = data?.jumpTo ?? null;
    this.characterTest = data?.characterTest === true;
  }

  preload(): void {
    this.buildLoadingScreen();

    // Los personajes son recortes de la ilustración maestra: PNG con alfa.
    CHARACTER_TEXTURES.forEach((k) => this.load.image(k, assetUrl(`assets/characters/${k}.png`)));
    const opts = { scale: SVG_LOAD_SCALE };
    PROPS.forEach((k) => this.load.svg(k, assetUrl(`assets/props/${k}.svg`), opts));

    this.load.on(Phaser.Loader.Events.PROGRESS, (v: number) => this.drawBar(v));
  }

  create(): void {
    this.time.delayedCall(240, () => {
      if (this.characterTest) {
        this.scene.start(SCENES.CHARACTER_TEST);
      } else if (this.jumpTo) {
        Save.unlockLevel(this.jumpTo);
        this.scene.start(SCENES.LEVEL_INTRO, { level: this.jumpTo });
      } else {
        this.scene.start(SCENES.MENU);
      }
    });
  }

  private buildLoadingScreen(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const bg = this.add.graphics();
    bg.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    bg.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Dos orejas dibujadas a mano mientras cargan los SVG reales.
    this.earL = this.add.graphics().setPosition(cx - 46, cy - 64);
    this.earR = this.add.graphics().setPosition(cx + 46, cy - 64);
    [this.earL, this.earR].forEach((g, i) => {
      g.fillStyle(PAL.fur, 1);
      g.lineStyle(5, PAL.furDark, 1);
      g.beginPath();
      g.moveTo(0, 60);
      g.lineTo(i === 0 ? -26 : 26, -56);
      g.lineTo(i === 0 ? 24 : -24, -12);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.setRotation(i === 0 ? -0.18 : 0.18);
    });
    this.tweens.add({
      targets: [this.earL, this.earR],
      scaleY: 1.14,
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add
      .text(cx, cy + 34, 'RATÓN', {
        fontFamily: FONT_TITLE,
        fontSize: '56px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 84, pick(LOADING_MESSAGES), {
        fontFamily: FONT_UI,
        fontSize: '18px',
        color: css(PAL.creamDim),
        fontStyle: '700'
      })
      .setOrigin(0.5);

    this.percent = this.add
      .text(cx, GAME_HEIGHT / 2 + 168, '0 %', {
        fontFamily: FONT_UI,
        fontSize: '15px',
        color: css(PAL.amber),
        fontStyle: '900'
      })
      .setOrigin(0.5);

    this.bar = this.add.graphics();
    this.drawBar(0);
  }

  private drawBar(v: number): void {
    this.percent?.setText(`${Math.round(v * 100)} %`);
    const w = 420;
    const x = (GAME_WIDTH - w) / 2;
    const y = GAME_HEIGHT / 2 + 132;
    this.bar.clear();
    this.bar.fillStyle(PAL.ink, 0.9);
    this.bar.fillRoundedRect(x, y, w, 16, 8);
    this.bar.fillStyle(PAL.amber, 1);
    this.bar.fillRoundedRect(x + 3, y + 3, Math.max(10, (w - 6) * v), 10, 5);
    this.bar.lineStyle(3, PAL.cream, 0.6);
    this.bar.strokeRoundedRect(x, y, w, 16, 8);
  }
}
