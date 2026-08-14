import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { Audio } from '../systems/AudioManager';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonOptions {
  width?: number;
  height?: number;
  variant?: ButtonVariant;
  fontSize?: number;
  title?: boolean;
  enabled?: boolean;
}

const STYLES: Record<ButtonVariant, { fill: number; text: number; stroke: number }> = {
  primary: { fill: PAL.danger, text: 0xfff6e6, stroke: 0x8c2c17 },
  secondary: { fill: PAL.inkSoft, text: PAL.cream, stroke: PAL.cream },
  ghost: { fill: 0x000000, text: PAL.cream, stroke: PAL.creamDim }
};

export class Button extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly boxW: number;
  private readonly boxH: number;
  private readonly variant: ButtonVariant;
  private enabledState: boolean;
  private hovered = false;
  private pressed = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    opts: ButtonOptions = {}
  ) {
    super(scene, x, y);
    this.variant = opts.variant ?? 'primary';
    this.boxW = opts.width ?? 260;
    this.boxH = opts.height ?? 66;
    this.enabledState = opts.enabled !== false;

    this.g = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, text, {
        fontFamily: opts.title === false ? FONT_UI : FONT_TITLE,
        fontSize: `${opts.fontSize ?? 26}px`,
        color: css(STYLES[this.variant].text),
        fontStyle: opts.title === false ? '700' : '800'
      })
      .setOrigin(0.5);

    this.add([this.g, this.label]);
    this.redraw();

    this.setSize(this.boxW, this.boxH);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH),
      Phaser.Geom.Rectangle.Contains
    );

    this.on('pointerover', () => {
      if (!this.enabledState) return;
      this.hovered = true;
      Audio.hover();
      scene.tweens.add({ targets: this, scale: 1.05, duration: 130, ease: 'Back.easeOut' });
      this.redraw();
    });
    this.on('pointerout', () => {
      this.hovered = false;
      this.pressed = false;
      scene.tweens.add({ targets: this, scale: 1, duration: 130 });
      this.redraw();
    });
    this.on('pointerdown', () => {
      if (!this.enabledState) return;
      this.pressed = true;
      scene.tweens.add({ targets: this, scale: 0.95, duration: 80 });
      this.redraw();
    });
    this.on('pointerup', () => {
      if (!this.enabledState || !this.pressed) return;
      this.pressed = false;
      scene.tweens.add({ targets: this, scale: 1.04, duration: 110, ease: 'Back.easeOut' });
      this.redraw();
      Audio.click();
      onClick();
    });

    scene.add.existing(this);
  }

  setEnabled(enabled: boolean): this {
    this.enabledState = enabled;
    this.setAlpha(enabled ? 1 : 0.45);
    this.redraw();
    return this;
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  private redraw(): void {
    const s = STYLES[this.variant];
    const g = this.g;
    const x = -this.boxW / 2;
    const y = -this.boxH / 2;
    const r = Math.min(20, this.boxH / 2);
    g.clear();

    g.fillStyle(0x000000, 0.3);
    g.fillRoundedRect(x + 4, y + (this.pressed ? 3 : 7), this.boxW, this.boxH, r);

    const lighten = this.hovered && this.enabledState ? 16 : 0;
    const fill = Phaser.Display.Color.IntegerToColor(s.fill).lighten(lighten).color;
    g.fillStyle(this.variant === 'ghost' ? 0x000000 : fill, this.variant === 'ghost' ? 0.34 : 1);
    g.fillRoundedRect(x, y + (this.pressed ? 3 : 0), this.boxW, this.boxH, r);

    g.lineStyle(3.5, s.stroke, this.variant === 'ghost' ? 0.7 : 0.95);
    g.strokeRoundedRect(x, y + (this.pressed ? 3 : 0), this.boxW, this.boxH, r);

    if (this.variant !== 'ghost') {
      g.fillStyle(0xffffff, 0.13);
      g.fillRoundedRect(x + 6, y + 5 + (this.pressed ? 3 : 0), this.boxW - 12, this.boxH * 0.36, r * 0.7);
    }

    this.label.y = this.pressed ? 3 : 0;
  }
}
