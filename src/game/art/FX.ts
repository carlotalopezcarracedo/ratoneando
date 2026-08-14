import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { rand, randInt } from '../utils/helpers';

const TOP = 5000;

/** Texto que sale disparado hacia arriba y se desvanece. */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  opts: { color?: number; size?: number; depth?: number; rise?: number; title?: boolean } = {}
): Phaser.GameObjects.Text {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: opts.title ? FONT_TITLE : FONT_UI,
      fontSize: `${opts.size ?? 24}px`,
      color: css(opts.color ?? PAL.cream),
      fontStyle: '900',
      stroke: css(PAL.ink),
      strokeThickness: 6
    })
    .setOrigin(0.5)
    .setDepth(opts.depth ?? TOP)
    .setScale(0.4);

  scene.tweens.add({
    targets: label,
    scale: 1,
    duration: 180,
    ease: 'Back.easeOut'
  });
  scene.tweens.add({
    targets: label,
    y: y - (opts.rise ?? 60),
    alpha: 0,
    duration: 900,
    delay: 220,
    ease: 'Quad.easeIn',
    onComplete: () => label.destroy()
  });
  return label;
}

/** Onda circular del ladrido. */
export function barkWave(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { scale?: number; depth?: number; color?: number } = {}
): void {
  const s = opts.scale ?? 1;
  for (let i = 0; i < 3; i++) {
    const ring = scene.add.circle(x, y, 14, undefined, 0);
    ring.setStrokeStyle(6 - i * 1.4, opts.color ?? PAL.cream, 0.9);
    ring.setDepth(opts.depth ?? TOP - 1);
    scene.tweens.add({
      targets: ring,
      radius: (90 + i * 34) * s,
      alpha: 0,
      duration: 460 + i * 110,
      delay: i * 70,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });
  }
}

/** Nubecillas de polvo (pasos, frenazos, aterrizajes). */
export function puff(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { count?: number; color?: number; depth?: number; spread?: number; scale?: number } = {}
): void {
  const count = opts.count ?? 5;
  const spread = opts.spread ?? 34;
  for (let i = 0; i < count; i++) {
    const dot = scene.add
      .circle(x + rand(-8, 8), y + rand(-4, 4), rand(4, 9) * (opts.scale ?? 1), opts.color ?? PAL.creamDim, 0.75)
      .setDepth(opts.depth ?? TOP - 2);
    scene.tweens.add({
      targets: dot,
      x: dot.x + rand(-spread, spread),
      y: dot.y - rand(4, spread * 0.7),
      alpha: 0,
      scale: rand(1.3, 2.1),
      duration: rand(340, 620),
      ease: 'Quad.easeOut',
      onComplete: () => dot.destroy()
    });
  }
}

/** Destellos para recompensas. */
export function sparkles(
  scene: Phaser.Scene,
  x: number,
  y: number,
  opts: { count?: number; color?: number; depth?: number; radius?: number } = {}
): void {
  const count = opts.count ?? 8;
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + rand(-0.3, 0.3);
    const r = opts.radius ?? 60;
    const star = scene.add
      .star(x, y, 4, 2, rand(7, 12), opts.color ?? PAL.amber)
      .setDepth(opts.depth ?? TOP)
      .setAlpha(0.95);
    scene.tweens.add({
      targets: star,
      x: x + Math.cos(a) * r * rand(0.6, 1.2),
      y: y + Math.sin(a) * r * rand(0.6, 1.2),
      alpha: 0,
      angle: rand(-220, 220),
      scale: 0.2,
      duration: rand(420, 760),
      ease: 'Cubic.easeOut',
      onComplete: () => star.destroy()
    });
  }
}

const CONFETTI_COLORS = [PAL.amber, PAL.pop, PAL.green, PAL.cream, PAL.danger];

export function confetti(
  scene: Phaser.Scene,
  x: number,
  y: number,
  count = 26,
  depth: number = TOP
): void {
  for (let i = 0; i < count; i++) {
    const piece = scene.add
      .rectangle(x, y, rand(7, 13), rand(10, 18), CONFETTI_COLORS[randInt(0, CONFETTI_COLORS.length - 1)])
      .setDepth(depth)
      .setAngle(rand(0, 360));
    scene.tweens.add({
      targets: piece,
      x: x + rand(-330, 330),
      y: y + rand(-260, 160),
      angle: piece.angle + rand(-540, 540),
      alpha: 0,
      duration: rand(700, 1300),
      ease: 'Quad.easeOut',
      onComplete: () => piece.destroy()
    });
  }
}

/** Gotitas de baba (easter egg del bote de nueces). */
export function drool(scene: Phaser.Scene, x: number, y: number, depth: number = TOP - 3): void {
  const drop = scene.add.ellipse(x, y, 8, 12, 0xbfe4ef, 0.85).setDepth(depth);
  scene.tweens.add({
    targets: drop,
    y: y + rand(40, 70),
    scaleY: 1.8,
    scaleX: 0.7,
    alpha: 0,
    duration: rand(520, 780),
    ease: 'Quad.easeIn',
    onComplete: () => drop.destroy()
  });
}

/** Signo de exclamación / interrogación sobre un personaje. */
export function alertMark(
  scene: Phaser.Scene,
  x: number,
  y: number,
  symbol: '!' | '?' | '···',
  color: number = PAL.danger,
  depth: number = TOP
): void {
  const mark = scene.add
    .text(x, y, symbol, {
      fontFamily: FONT_TITLE,
      fontSize: '46px',
      color: css(color),
      fontStyle: '800',
      stroke: css(PAL.ink),
      strokeThickness: 7
    })
    .setOrigin(0.5)
    .setDepth(depth)
    .setScale(0.2);

  scene.tweens.add({
    targets: mark,
    scale: 1,
    y: y - 14,
    duration: 220,
    ease: 'Back.easeOut'
  });
  scene.tweens.add({
    targets: mark,
    alpha: 0,
    y: y - 34,
    delay: 620,
    duration: 320,
    onComplete: () => mark.destroy()
  });
}

/** Flash de pantalla suave. */
export function flash(scene: Phaser.Scene, color = 0xffffff, alpha = 0.5, duration = 220): void {
  const cam = scene.cameras.main;
  const r = ((color >> 16) & 0xff) * alpha;
  const g = ((color >> 8) & 0xff) * alpha;
  const b = (color & 0xff) * alpha;
  cam.flash(duration, r, g, b, false);
}
