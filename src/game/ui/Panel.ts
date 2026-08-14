import Phaser from 'phaser';
import { PAL } from '../utils/palette';

export interface PanelOptions {
  fill?: number;
  fillAlpha?: number;
  stroke?: number;
  strokeWidth?: number;
  radius?: number;
  shadow?: boolean;
}

/** Panel redondeado reutilizable (diálogos, tarjetas, HUD). */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {}
): void {
  const r = opts.radius ?? 22;
  if (opts.shadow !== false) {
    g.fillStyle(0x000000, 0.28);
    g.fillRoundedRect(x + 6, y + 9, w, h, r);
  }
  g.fillStyle(opts.fill ?? PAL.inkSoft, opts.fillAlpha ?? 0.96);
  g.fillRoundedRect(x, y, w, h, r);
  if (opts.strokeWidth !== 0) {
    g.lineStyle(opts.strokeWidth ?? 4, opts.stroke ?? PAL.cream, 0.85);
    g.strokeRoundedRect(x, y, w, h, r);
  }
}

export class Panel extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly boxW: number,
    private readonly boxH: number,
    private readonly opts: PanelOptions = {}
  ) {
    super(scene, x, y);
    this.g = scene.add.graphics();
    this.add(this.g);
    this.redraw();
    scene.add.existing(this);
  }

  redraw(): void {
    this.g.clear();
    drawPanel(this.g, -this.boxW / 2, -this.boxH / 2, this.boxW, this.boxH, this.opts);
  }
}
