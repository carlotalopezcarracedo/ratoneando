import Phaser from 'phaser';
import { FONT_UI } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { clamp } from '../utils/helpers';

export interface ProgressBarOptions {
  width?: number;
  height?: number;
  color?: number;
  warnColor?: number;
  warnAt?: number;
  label?: string;
  align?: 'left' | 'right';
  showPercent?: boolean;
}

/** Barra de progreso del HUD (necesidad, lamido, sospecha, pánico, robo…). */
export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly caption?: Phaser.GameObjects.Text;
  private readonly boxW: number;
  private readonly boxH: number;
  private readonly opts: ProgressBarOptions;
  private value = 0;
  private shown = -1;
  private pulse = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ProgressBarOptions = {}) {
    super(scene, x, y);
    this.opts = opts;
    this.boxW = opts.width ?? 240;
    this.boxH = opts.height ?? 20;

    this.g = scene.add.graphics();
    this.add(this.g);

    if (opts.label) {
      this.caption = scene.add
        .text(opts.align === 'right' ? this.boxW : 0, -this.boxH - 8, opts.label, {
          fontFamily: FONT_UI,
          fontSize: '15px',
          color: css(PAL.cream),
          fontStyle: '900',
          stroke: css(PAL.ink),
          strokeThickness: 4
        })
        .setOrigin(opts.align === 'right' ? 1 : 0, 0);
      this.add(this.caption);
    }

    this.redraw();
    scene.add.existing(this);
  }

  setValue(v: number): this {
    this.value = clamp(v, 0, 1);
    return this;
  }

  get current(): number {
    return this.value;
  }

  flashPulse(): this {
    this.pulse = 1;
    return this;
  }

  tick(delta: number): void {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - delta / 260);
    if (Math.abs(this.shown - this.value) > 0.0015 || this.pulse > 0) {
      this.shown = this.value;
      this.redraw();
    }
  }

  private redraw(): void {
    const g = this.g;
    const r = this.boxH / 2;
    g.clear();

    g.fillStyle(0x000000, 0.45);
    g.fillRoundedRect(-3, -3, this.boxW + 6, this.boxH + 6, r + 3);

    g.fillStyle(PAL.ink, 0.9);
    g.fillRoundedRect(0, 0, this.boxW, this.boxH, r);

    const warnAt = this.opts.warnAt ?? 0.75;
    const color =
      this.value >= warnAt ? this.opts.warnColor ?? PAL.danger : this.opts.color ?? PAL.ok;

    const fillW = Math.max(this.value > 0 ? this.boxH * 0.7 : 0, this.boxW * this.value);
    if (fillW > 0) {
      g.fillStyle(color, 1);
      g.fillRoundedRect(2, 2, Math.min(fillW, this.boxW - 4), this.boxH - 4, r - 2);
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(4, 4, Math.min(fillW - 4, this.boxW - 8), (this.boxH - 4) * 0.42, r - 3);
    }

    g.lineStyle(2.5, PAL.cream, 0.55 + this.pulse * 0.45);
    g.strokeRoundedRect(0, 0, this.boxW, this.boxH, r);

    if (this.pulse > 0) {
      g.lineStyle(4, color, this.pulse * 0.6);
      g.strokeRoundedRect(-4, -4, this.boxW + 8, this.boxH + 8, r + 4);
    }
  }
}
