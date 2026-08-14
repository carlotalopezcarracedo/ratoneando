import Phaser from 'phaser';
import { PAL } from '../utils/palette';
import { GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import { rand } from '../utils/helpers';

type G = Phaser.GameObjects.Graphics;

const shade = (c: number, amount: number): number =>
  amount >= 0
    ? Phaser.Display.Color.IntegerToColor(c).lighten(amount).color
    : Phaser.Display.Color.IntegerToColor(c).darken(-amount).color;

/** Caja con volumen: cara frontal, canto superior claro y sombra inferior. */
function box(g: G, x: number, y: number, w: number, h: number, color: number, r = 6): void {
  g.fillStyle(0x000000, 0.22);
  g.fillRoundedRect(x + 3, y + 5, w, h, r);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(shade(color, 14), 1);
  g.fillRoundedRect(x, y, w, Math.min(h * 0.28, 16), r);
  g.fillStyle(shade(color, -16), 0.75);
  g.fillRect(x + 2, y + h - Math.min(h * 0.22, 12), w - 4, Math.min(h * 0.22, 12));
  g.lineStyle(3, shade(color, -34), 0.9);
  g.strokeRoundedRect(x, y, w, h, r);
}

function planks(g: G, x: number, y: number, w: number, h: number, base: number, rows = 5): void {
  g.fillStyle(base, 1);
  g.fillRect(x, y, w, h);
  const rowH = h / rows;
  for (let i = 0; i < rows; i++) {
    g.fillStyle(shade(base, i % 2 === 0 ? 6 : -6), 0.5);
    g.fillRect(x, y + i * rowH, w, rowH);
    g.lineStyle(2, shade(base, -22), 0.35);
    g.lineBetween(x, y + i * rowH, x + w, y + i * rowH);
    for (let j = 0; j < 6; j++) {
      const px = x + ((j + (i % 2) * 0.5) * w) / 6;
      g.lineBetween(px, y + i * rowH, px, y + (i + 1) * rowH);
    }
  }
}

// ---------------------------------------------------------------- NIVEL 1

/** Habitación/despacho cálido: pared, rodapié, suelo, ventana, estantería, cuadros. */
export function makeRoom1(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const floorY = 520;

  // pared
  g.fillGradientStyle(PAL.wall, PAL.wall, PAL.wallDeep, PAL.wallShade, 1);
  g.fillRect(0, 0, GAME_WIDTH, floorY);

  // luz cálida desde la ventana
  g.fillStyle(0xfff0cf, 0.16);
  g.fillTriangle(190, 90, 470, 90, 700, floorY);
  g.fillStyle(0xfff0cf, 0.1);
  g.fillTriangle(150, 90, 430, 90, 820, floorY);

  // rodapié
  g.fillStyle(shade(PAL.wallShade, -18), 1);
  g.fillRect(0, floorY - 26, GAME_WIDTH, 26);
  g.fillStyle(PAL.cream, 0.25);
  g.fillRect(0, floorY - 26, GAME_WIDTH, 5);

  // suelo
  planks(g, 0, floorY, GAME_WIDTH, GAME_HEIGHT - floorY, PAL.floor, 5);
  g.fillStyle(0x000000, 0.16);
  g.fillRect(0, floorY, GAME_WIDTH, 22);

  c.add(g);
  c.add(makeWindow(scene, 300, 60));
  c.add(makePoster(scene, 940, 120, 'MUY BUEN\nPERRO'));
  c.add(makeBookshelf(scene, 1090, floorY));
  c.add(makeRug(scene, 700, 620, 560, 120));
  return c;
}

export function makeWindow(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 240;
  const h = 220;

  g.fillStyle(shade(PAL.wood, -20), 1);
  g.fillRoundedRect(-14, -14, w + 28, h + 28, 8);
  g.fillGradientStyle(0xbfdfe8, 0xd8ecf1, 0x9ec9d6, 0xbcdfe6, 1);
  g.fillRect(0, 0, w, h);

  // paisaje simple
  g.fillStyle(0x8fae72, 1);
  g.fillRect(0, h * 0.62, w, h * 0.38);
  g.fillStyle(0x6f8f5f, 1);
  g.fillCircle(58, h * 0.6, 44);
  g.fillCircle(160, h * 0.64, 34);
  g.fillStyle(0xffffff, 0.55);
  g.fillCircle(180, 44, 22);
  g.fillCircle(202, 48, 17);
  g.fillCircle(158, 50, 15);

  g.fillStyle(PAL.woodDark, 1);
  g.fillRect(w / 2 - 5, 0, 10, h);
  g.fillRect(0, h / 2 - 5, w, 10);
  g.fillStyle(0xffffff, 0.16);
  g.fillTriangle(10, h, w * 0.55, 0, w * 0.8, 0);

  g.lineStyle(6, shade(PAL.wood, -30), 1);
  g.strokeRect(0, 0, w, h);

  c.add(g);
  return c;
}

export function makePoster(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.2);
  g.fillRoundedRect(-76, -52, 160, 210, 6);
  g.fillStyle(PAL.cream, 1);
  g.fillRoundedRect(-80, -56, 160, 210, 6);
  g.fillStyle(PAL.danger, 1);
  g.fillRoundedRect(-68, -44, 136, 130, 4);
  g.fillStyle(PAL.ink, 0.85);
  g.fillCircle(0, 20, 40);
  g.fillStyle(PAL.cream, 1);
  g.fillTriangle(-34, -6, -14, -50, -4, -4);
  g.fillTriangle(34, -6, 14, -50, 4, -4);
  g.lineStyle(4, shade(PAL.cream, -30), 1);
  g.strokeRoundedRect(-80, -56, 160, 210, 6);
  c.add(g);

  c.add(
    scene.add
      .text(0, 118, text, {
        fontFamily: 'Nunito, sans-serif',
        fontSize: '17px',
        color: '#241d1a',
        fontStyle: '900',
        align: 'center'
      })
      .setOrigin(0.5)
  );
  return c;
}

export function makeBookshelf(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 250;
  const h = 340;

  box(g, -w / 2, -h, w, h, PAL.wood, 8);
  const shelves = 3;
  for (let i = 1; i <= shelves; i++) {
    const sy = -h + (h / (shelves + 1)) * i;
    g.fillStyle(shade(PAL.woodDark, 8), 1);
    g.fillRect(-w / 2 + 8, sy, w - 16, 10);
  }

  const bookColors = [PAL.danger, PAL.green, PAL.pop, PAL.amber, PAL.creamDim, PAL.popDeep];
  for (let i = 0; i <= shelves; i++) {
    const sy = -h + (h / (shelves + 1)) * (i + 1);
    let bx = -w / 2 + 18;
    while (bx < w / 2 - 40) {
      const bw = rand(12, 26);
      const bh = rand(46, 72);
      g.fillStyle(bookColors[Math.floor(rand(0, bookColors.length))], 1);
      g.fillRect(bx, sy - bh, bw, bh);
      g.fillStyle(0xffffff, 0.15);
      g.fillRect(bx, sy - bh, bw, 6);
      g.lineStyle(2, 0x2a1d14, 0.5);
      g.strokeRect(bx, sy - bh, bw, bh);
      bx += bw + 3;
    }
  }
  c.add(g);
  return c;
}

export function makeRug(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.14);
  g.fillEllipse(4, 8, w, h);
  g.fillStyle(PAL.greenDark, 1);
  g.fillEllipse(0, 0, w, h);
  g.fillStyle(PAL.green, 1);
  g.fillEllipse(0, 0, w * 0.86, h * 0.82);
  g.fillStyle(PAL.creamDim, 0.5);
  g.fillEllipse(0, 0, w * 0.6, h * 0.55);
  g.fillStyle(PAL.greenLight, 0.7);
  g.fillEllipse(0, 0, w * 0.32, h * 0.3);
  c.add(g);
  return c;
}

export function makeDesk(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 420;
  const h = 200;

  g.fillStyle(shade(PAL.woodDark, -6), 1);
  g.fillRect(-w / 2 + 22, -h + 26, 26, h - 26);
  g.fillRect(w / 2 - 48, -h + 26, 26, h - 26);

  box(g, -w / 2 - 10, -h, w + 20, 30, PAL.wood, 6);

  // cajonera
  box(g, w / 2 - 150, -h + 34, 140, 120, shade(PAL.wood, -10), 5);
  g.fillStyle(shade(PAL.woodDark, 12), 1);
  g.fillRoundedRect(w / 2 - 138, -h + 46, 116, 40, 4);
  g.fillRoundedRect(w / 2 - 138, -h + 94, 116, 40, 4);
  g.fillStyle(PAL.creamDim, 1);
  g.fillRoundedRect(w / 2 - 96, -h + 62, 32, 7, 3);
  g.fillRoundedRect(w / 2 - 96, -h + 110, 32, 7, 3);

  c.add(g);
  return c;
}

export function makeMonitor(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x2b2a2e, 1);
  g.fillRoundedRect(-18, -26, 36, 26, 4);
  g.fillStyle(0x1f1e22, 1);
  g.fillRoundedRect(-56, -8, 112, 12, 6);
  box(g, -128, -168, 256, 150, 0x2b2a2e, 8);
  g.fillGradientStyle(0x3f7d8e, 0x59b0c4, 0x2f6d80, 0x3f7d8e, 1);
  g.fillRoundedRect(-116, -158, 232, 126, 4);
  g.fillStyle(0xffffff, 0.12);
  g.fillTriangle(-116, -32, -10, -158, 46, -158);
  g.fillStyle(0xd8ecf1, 0.55);
  for (let i = 0; i < 6; i++) g.fillRect(-104, -146 + i * 17, rand(60, 190), 7);
  c.add(g);

  const glow = scene.add.rectangle(0, -95, 250, 140, 0x9fd4e8, 0.1);
  c.add(glow);
  scene.tweens.add({ targets: glow, alpha: 0.18, duration: 1800, yoyo: true, repeat: -1 });
  return c;
}

export function makeChair(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x35323a, 1);
  g.fillRoundedRect(-8, -110, 16, 96, 6);
  g.fillStyle(0x2a272e, 1);
  for (let i = -2; i <= 2; i++) {
    if (i === 0) continue;
    g.fillRoundedRect(i * 34 - 6, -22, 12, 22, 5);
    g.fillCircle(i * 34, 2, 9);
  }
  box(g, -70, -130, 140, 26, 0x3e3a44, 8);
  box(g, -66, -270, 132, 150, 0x46414d, 14);
  g.fillStyle(0x2f2c35, 0.55);
  g.fillRoundedRect(-52, -256, 104, 30, 8);
  g.fillRoundedRect(-52, -216, 104, 30, 8);
  c.add(g);
  return c;
}

export function makeDogBed(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(6, 12, 300, 74);
  g.fillStyle(shade(PAL.danger, -22), 1);
  g.fillEllipse(0, 0, 300, 78);
  g.fillStyle(PAL.danger, 1);
  g.fillEllipse(0, -8, 300, 70);
  g.fillStyle(shade(PAL.danger, -30), 1);
  g.fillEllipse(0, -4, 226, 46);
  g.fillStyle(PAL.creamDim, 1);
  g.fillEllipse(0, -6, 212, 40);
  g.fillStyle(PAL.cream, 0.7);
  g.fillEllipse(-30, -12, 120, 20);
  c.add(g);
  return c;
}

export function makeLamp(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x4a4038, 1);
  g.fillEllipse(0, 0, 80, 20);
  g.fillRect(-5, -230, 10, 230);
  g.fillStyle(PAL.amber, 0.15);
  g.fillTriangle(-62, -226, 62, -226, 122, 60);
  g.fillTriangle(-62, -226, 122, 60, -122, 60);
  g.fillStyle(PAL.cream, 1);
  g.fillTriangle(-58, -228, 58, -228, 40, -300);
  g.fillTriangle(40, -300, -40, -300, -58, -228);
  g.fillStyle(shade(PAL.cream, -18), 1);
  g.fillRect(-58, -232, 116, 8);
  c.add(g);
  return c;
}

// ---------------------------------------------------------------- NIVEL 2

/** Fondo del paseo: cielo cálido, edificios, arbolado y acera superior. */
export function makeStreetBackdrop(
  scene: Phaser.Scene,
  worldWidth: number,
  topY: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();

  g.fillGradientStyle(PAL.sky, PAL.sky, PAL.skyDeep, PAL.skyDeep, 1);
  g.fillRect(0, 0, worldWidth, topY);

  // skyline
  let bx = -40;
  while (bx < worldWidth + 60) {
    const bw = rand(90, 190);
    const bh = rand(120, 300);
    const tone = shade(0xb08a6a, rand(-16, 12));
    g.fillStyle(tone, 1);
    g.fillRect(bx, topY - 60 - bh, bw, bh + 60);
    g.fillStyle(0xf3d9a8, 0.5);
    for (let wy = topY - 50 - bh + 20; wy < topY - 80; wy += 34) {
      for (let wx = bx + 12; wx < bx + bw - 18; wx += 30) {
        if (Math.random() < 0.55) g.fillRect(wx, wy, 14, 18);
      }
    }
    bx += bw + rand(8, 26);
  }

  // franja de árboles
  g.fillStyle(PAL.greenDark, 1);
  g.fillRect(0, topY - 90, worldWidth, 90);
  for (let tx = 20; tx < worldWidth; tx += 120) {
    g.fillStyle(shade(PAL.green, rand(-12, 10)), 1);
    g.fillCircle(tx, topY - 96, rand(46, 66));
    g.fillCircle(tx + 34, topY - 74, rand(34, 50));
    g.fillStyle(PAL.woodDark, 1);
    g.fillRect(tx - 7, topY - 74, 14, 74);
  }

  c.add(g);
  return c;
}

export function makeBench(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.16);
  g.fillEllipse(4, 8, 180, 26);
  g.fillStyle(0x4a4038, 1);
  g.fillRect(-72, -34, 12, 34);
  g.fillRect(60, -34, 12, 34);
  for (let i = 0; i < 3; i++) {
    g.fillStyle(shade(PAL.wood, i * 4), 1);
    g.fillRoundedRect(-88, -46 - i * 16, 176, 12, 4);
  }
  c.add(g);
  return c;
}

// ---------------------------------------------------------------- NIVEL 3

/** Salón/cocina en 2.5D: pared del fondo, armarios y suelo con perspectiva. */
export function makeRoom3(
  scene: Phaser.Scene,
  width: number,
  horizonY: number,
  floorBottom: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0);
  const g = scene.add.graphics();

  g.fillGradientStyle(PAL.wallDeep, PAL.wallDeep, PAL.wall, PAL.wall, 1);
  g.fillRect(0, 0, width, horizonY);

  // alicatado de cocina a la izquierda
  g.fillStyle(shade(PAL.cream, -6), 1);
  g.fillRect(0, horizonY - 210, width * 0.46, 210);
  g.lineStyle(2, shade(PAL.creamDim, -12), 0.7);
  for (let tx = 0; tx < width * 0.46; tx += 54) g.lineBetween(tx, horizonY - 210, tx, horizonY);
  for (let ty = horizonY - 210; ty < horizonY; ty += 54) g.lineBetween(0, ty, width * 0.46, ty);

  // zócalo
  g.fillStyle(shade(PAL.wallShade, -22), 1);
  g.fillRect(0, horizonY - 22, width, 22);

  // suelo
  planks(g, 0, horizonY, width, floorBottom - horizonY, PAL.floor, 7);
  g.fillStyle(0x000000, 0.2);
  g.fillRect(0, horizonY, width, 26);
  g.fillStyle(0xfff0cf, 0.09);
  g.fillTriangle(width * 0.2, horizonY, width * 0.85, horizonY, width * 1.05, floorBottom);

  c.add(g);
  return c;
}

export function makeCounter(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const h = 150;
  box(g, -w / 2, -h, w, h, shade(PAL.cream, -10), 6);
  g.fillStyle(shade(PAL.wallShade, -6), 1);
  g.fillRoundedRect(-w / 2 - 10, -h - 18, w + 20, 22, 6);
  g.fillStyle(0xffffff, 0.18);
  g.fillRoundedRect(-w / 2 - 6, -h - 15, w + 12, 8, 4);
  const doors = Math.max(2, Math.round(w / 150));
  for (let i = 0; i < doors; i++) {
    const dw = (w - 24) / doors;
    const dx = -w / 2 + 12 + i * dw;
    g.lineStyle(3, shade(PAL.creamDim, -22), 0.8);
    g.strokeRoundedRect(dx + 4, -h + 14, dw - 8, h - 30, 5);
    g.fillStyle(shade(PAL.wallShade, -20), 1);
    g.fillRoundedRect(dx + dw / 2 - 16, -h + 30, 32, 7, 3);
  }
  c.add(g);
  return c;
}

export function makeFridge(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  box(g, -80, -320, 160, 320, 0xdfe3e2, 8);
  g.lineStyle(4, 0xa9b0ae, 1);
  g.lineBetween(-72, -212, 72, -212);
  g.fillStyle(0x8f9896, 1);
  g.fillRoundedRect(46, -300, 12, 70, 6);
  g.fillRoundedRect(46, -196, 12, 90, 6);
  g.fillStyle(PAL.amber, 1);
  g.fillRect(-58, -300, 40, 30);
  g.fillStyle(PAL.pop, 1);
  g.fillRect(-12, -294, 30, 22);
  c.add(g);
  return c;
}

export function makeSofa(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 380;
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(6, 12, w + 30, 40);
  box(g, -w / 2, -190, w, 110, PAL.greenDark, 16);
  box(g, -w / 2 + 6, -110, w - 12, 78, PAL.green, 14);
  box(g, -w / 2 - 18, -150, 46, 120, shade(PAL.green, -8), 14);
  box(g, w / 2 - 28, -150, 46, 120, shade(PAL.green, -8), 14);
  g.fillStyle(PAL.creamDim, 1);
  g.fillRoundedRect(-120, -170, 74, 62, 10);
  g.fillStyle(PAL.amber, 1);
  g.fillRoundedRect(48, -168, 70, 58, 10);
  g.fillStyle(0x2f2c28, 1);
  g.fillRect(-w / 2 + 18, -34, 18, 34);
  g.fillRect(w / 2 - 36, -34, 18, 34);
  c.add(g);
  return c;
}

export function makeTable(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 320;
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(6, 10, w + 20, 36);
  g.fillStyle(shade(PAL.woodDark, -4), 1);
  g.fillRect(-w / 2 + 24, -110, 20, 110);
  g.fillRect(w / 2 - 44, -110, 20, 110);
  box(g, -w / 2, -132, w, 26, PAL.wood, 6);
  c.add(g);
  return c;
}

export function makeCabinetTop(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  box(g, -w / 2, -110, w, 110, shade(PAL.wood, -4), 6);
  const doors = Math.max(2, Math.round(w / 130));
  for (let i = 0; i < doors; i++) {
    const dw = (w - 20) / doors;
    const dx = -w / 2 + 10 + i * dw;
    g.lineStyle(3, shade(PAL.woodDark, -6), 0.9);
    g.strokeRoundedRect(dx + 4, -100, dw - 8, 90, 5);
    g.fillStyle(PAL.creamDim, 1);
    g.fillRoundedRect(dx + dw / 2 - 4, -66, 8, 22, 4);
  }
  c.add(g);
  return c;
}

export function makeCrate(scene: Phaser.Scene, x: number, y: number, s = 1): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const w = 110 * s;
  const h = 90 * s;
  box(g, -w / 2, -h, w, h, PAL.woodLight, 5);
  g.lineStyle(4, shade(PAL.woodDark, 4), 0.8);
  g.lineBetween(-w / 2 + 6, -h + 8, w / 2 - 6, -8);
  g.lineBetween(w / 2 - 6, -h + 8, -w / 2 + 6, -8);
  c.add(g);
  return c;
}
