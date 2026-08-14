import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import { PAL } from '../utils/palette';
import { Audio } from './AudioManager';

const DEPTH = 90000;
const CENTER_L = GAME_WIDTH * 0.30;
const CENTER_R = GAME_WIDTH * 0.70;
const OUT_L = -GAME_WIDTH * 0.55;
const OUT_R = GAME_WIDTH * 1.55;

interface Overlay {
  fill: Phaser.GameObjects.Rectangle;
  left: Phaser.GameObjects.Image;
  right: Phaser.GameObjects.Image;
  destroy(): void;
}

function buildOverlay(scene: Phaser.Scene, covered: boolean): Overlay {
  const fill = scene.add
    .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 1.2, GAME_HEIGHT * 1.2, PAL.fur)
    .setScrollFactor(0)
    .setDepth(DEPTH)
    .setAlpha(covered ? 1 : 0);

  const make = (x: number, flip: boolean): Phaser.GameObjects.Image => {
    const img = scene.add
      .image(x, GAME_HEIGHT * 0.98, 'raton-ear-l')
      .setOrigin(0.5, 0.94)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1)
      .setScale((flip ? -1 : 1) * 5.6, 4.8)
      .setRotation(flip ? -0.24 : 0.24);
    return img;
  };

  const left = make(covered ? CENTER_L : OUT_L, false);
  const right = make(covered ? CENTER_R : OUT_R, true);

  return {
    fill,
    left,
    right,
    destroy(): void {
      fill.destroy();
      left.destroy();
      right.destroy();
    }
  };
}

/**
 * Cortinilla característica del juego: las dos orejas gigantes de Ratón entran
 * desde los lados y tapan la pantalla.
 */
export const Transition = {
  /** Tapa la pantalla y ejecuta el callback cuando está cubierta. */
  cover(scene: Phaser.Scene, onCovered: () => void, duration = 420): void {
    if (!scene.textures.exists('raton-ear-l')) {
      scene.cameras.main.fadeOut(200, 20, 15, 14);
      scene.time.delayedCall(220, onCovered);
      return;
    }
    Audio.whoosh();
    const ov = buildOverlay(scene, false);
    scene.tweens.add({
      targets: ov.left,
      x: CENTER_L,
      duration,
      ease: 'Cubic.easeIn'
    });
    scene.tweens.add({
      targets: ov.right,
      x: CENTER_R,
      duration,
      ease: 'Cubic.easeIn'
    });
    scene.tweens.add({
      targets: ov.fill,
      alpha: 1,
      delay: duration * 0.62,
      duration: duration * 0.42,
      onComplete: () => onCovered()
    });
  },

  /** Abre la cortinilla al entrar en una escena. */
  reveal(scene: Phaser.Scene, duration = 460): void {
    if (!scene.textures.exists('raton-ear-l')) return;
    const ov = buildOverlay(scene, true);
    scene.tweens.add({
      targets: ov.fill,
      alpha: 0,
      duration: duration * 0.5,
      delay: 60
    });
    scene.tweens.add({
      targets: ov.left,
      x: OUT_L,
      duration,
      delay: 40,
      ease: 'Cubic.easeOut'
    });
    scene.tweens.add({
      targets: ov.right,
      x: OUT_R,
      duration,
      delay: 40,
      ease: 'Cubic.easeOut',
      onComplete: () => ov.destroy()
    });
  },

  /** Atajo: cubrir + cambiar de escena. */
  to(scene: Phaser.Scene, key: string, data?: object): void {
    scene.input.enabled = false;
    Transition.cover(scene, () => {
      scene.scene.start(key, data);
    });
  }
};
