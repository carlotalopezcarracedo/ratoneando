import Phaser from 'phaser';
import { FONT_UI, GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from './Panel';

/**
 * Tutorial contextual: una línea, abajo, que desaparece cuando el jugador
 * demuestra que ha entendido la acción.
 */
export class Hint extends Phaser.GameObjects.Container {
  private readonly g: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private hideTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, y = GAME_HEIGHT - 72) {
    super(scene, GAME_WIDTH / 2, y);
    this.setScrollFactor(0).setDepth(6100).setAlpha(0);

    this.g = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '20px',
        color: css(PAL.cream),
        fontStyle: '800',
        align: 'center'
      })
      .setOrigin(0.5);
    this.add([this.g, this.label]);
    scene.add.existing(this);
  }

  show(text: string, autoHideMs = 0): this {
    this.hideTimer?.remove();
    this.label.setText(text);
    const w = Math.max(240, this.label.width + 64);
    const h = this.label.height + 30;
    this.g.clear();
    drawPanel(this.g, -w / 2, -h / 2, w, h, { radius: h / 2, fillAlpha: 0.88, strokeWidth: 3 });

    this.scene.tweens.add({ targets: this, alpha: 1, y: this.y, duration: 220 });
    this.setScale(0.9);
    this.scene.tweens.add({ targets: this, scale: 1, duration: 240, ease: 'Back.easeOut' });

    if (autoHideMs > 0) {
      this.hideTimer = this.scene.time.delayedCall(autoHideMs, () => this.hide());
    }
    return this;
  }

  hide(): this {
    this.hideTimer?.remove();
    this.scene.tweens.add({ targets: this, alpha: 0, scale: 0.92, duration: 240 });
    return this;
  }

  override destroy(fromScene?: boolean): void {
    this.hideTimer?.remove();
    super.destroy(fromScene);
  }
}
