import Phaser from 'phaser';
import { PAL } from '../utils/palette';
import { clamp } from '../utils/helpers';

/**
 * Los ojos son la mitad de la expresividad de Ratón, así que se construyen con
 * formas de Phaser (no SVG) para poder exagerarlos, dilatarlos y parpadear.
 */
export class Eye extends Phaser.GameObjects.Container {
  private readonly lidGroup: Phaser.GameObjects.Container;
  private readonly irisGroup: Phaser.GameObjects.Container;
  private readonly iris: Phaser.GameObjects.Ellipse;
  private readonly pupil: Phaser.GameObjects.Ellipse;
  private readonly baseR: number;

  private openValue = 1;
  private lidValue = 1;
  private blinkValue = 1;
  private blinkTween?: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, x: number, y: number, radius: number) {
    super(scene, x, y);
    this.baseR = radius;

    this.lidGroup = scene.add.container(0, 0);

    const sclera = scene.add.ellipse(0, 0, radius * 2, radius * 2 * 0.94, PAL.white);
    sclera.setStrokeStyle(radius * 0.16, PAL.furDark, 1);

    this.irisGroup = scene.add.container(0, 0);
    this.iris = scene.add.ellipse(0, 0, radius * 1.5, radius * 1.5, 0x7b4a24);
    this.pupil = scene.add.ellipse(0, 0, radius * 0.82, radius * 0.86, 0x120c08);
    const glint = scene.add.ellipse(
      -radius * 0.34,
      -radius * 0.36,
      radius * 0.42,
      radius * 0.34,
      0xffffff,
      0.92
    );
    const glintSmall = scene.add.ellipse(
      radius * 0.3,
      radius * 0.3,
      radius * 0.2,
      radius * 0.18,
      0xffffff,
      0.6
    );
    this.irisGroup.add([this.iris, this.pupil, glint, glintSmall]);

    this.lidGroup.add([sclera, this.irisGroup]);
    this.add(this.lidGroup);
  }

  private apply(): void {
    this.lidGroup.scaleX = this.openValue;
    this.lidGroup.scaleY = this.openValue * this.lidValue * this.blinkValue;
  }

  /** Escala global del ojo (para exagerar sorpresa o miedo). */
  setOpen(scale: number): void {
    this.openValue = scale;
    this.apply();
  }

  get openScale(): number {
    return this.openValue;
  }

  /** Entrecerrar (felicidad, sueño). 1 = abierto, 0 = cerrado. */
  setLid(v: number): void {
    this.lidValue = clamp(v, 0.02, 1.4);
    this.apply();
  }

  /** Dirección de la mirada, en unidades normalizadas -1..1. */
  look(dx: number, dy: number): void {
    const range = this.baseR * 0.34;
    this.irisGroup.setPosition(clamp(dx, -1, 1) * range, clamp(dy, -1, 1) * range);
  }

  /** Dilatación de la pupila: >1 asustado, <1 concentrado. */
  setDilation(v: number): void {
    this.pupil.setScale(clamp(v, 0.35, 1.9));
    this.iris.setScale(clamp(0.9 + (v - 1) * 0.35, 0.7, 1.35));
  }

  blink(duration = 90): void {
    if (this.blinkTween?.isPlaying()) return;
    const proxy = { k: 1 };
    this.blinkTween = this.scene.tweens.add({
      targets: proxy,
      k: 0.06,
      duration,
      yoyo: true,
      ease: 'Quad.easeInOut',
      onUpdate: () => {
        this.blinkValue = proxy.k;
        this.apply();
      },
      onComplete: () => {
        this.blinkValue = 1;
        this.apply();
      }
    });
  }

  override destroy(fromScene?: boolean): void {
    this.blinkTween?.remove();
    super.destroy(fromScene);
  }
}
