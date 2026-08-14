import Phaser from 'phaser';
import { SVG_DISPLAY_SCALE } from '../utils/constants';

/**
 * Una pieza de un personaje: un contenedor cuyo origen (0,0) es el pivote de la
 * imagen. Rotar o escalar el contenedor rota/escala alrededor de ese pivote, así
 * que los tweens se escriben con valores naturales (scale 1, rotation 0).
 */
export class Part extends Phaser.GameObjects.Container {
  readonly img: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    texture: string,
    x = 0,
    y = 0,
    originX = 0.5,
    originY = 0.5
  ) {
    super(scene, x, y);
    this.img = scene.add
      .image(0, 0, texture)
      .setOrigin(originX, originY)
      .setScale(SVG_DISPLAY_SCALE);
    this.add(this.img);
  }

  tint(color: number): this {
    this.img.setTint(color);
    return this;
  }

  clearTintColor(): this {
    this.img.clearTint();
    return this;
  }

  /** Tamaño de la pieza en unidades de diseño. */
  get designWidth(): number {
    return this.img.width * SVG_DISPLAY_SCALE;
  }

  get designHeight(): number {
    return this.img.height * SVG_DISPLAY_SCALE;
  }
}
