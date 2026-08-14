import Phaser from 'phaser';
import {
  CHAOS,
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVELS,
  SCENES,
  THOUGHTS,
  CHARACTER_SCALE
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { clamp, pick, rand, segmentIntersectsRect, type Rect } from '../utils/helpers';
import { Raton } from '../entities/Raton';
import { Human } from '../entities/Human';
import { MissionHUD } from '../ui/MissionHUD';
import { drawPanel } from '../ui/Panel';
import { ProgressBar } from '../ui/ProgressBar';
import { Hint } from '../ui/Hint';
import { TouchControls, needsTouch } from '../ui/TouchControls';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';
import { Transition } from '../systems/Transition';
import { Save } from '../systems/SaveManager';
import { alertMark, drool, floatText, puff, sparkles } from '../art/FX';
import {
  makeCabinetTop,
  makeCounter,
  makeCrate,
  makeDogBed,
  makeFridge,
  makeRoom3,
  makeRug,
  makeSofa,
  makeTable
} from '../art/props';

interface Solid extends Rect {
  sight: boolean;
  move: boolean;
}

interface Watcher {
  human: Human;
  home: number;
  patrol: [number, number];
  dir: -1 | 1;
  state: 'patrol' | 'pause' | 'investigate';
  timer: number;
  target: { x: number; y: number } | null;
  floorY: number;
  range: number;
}

interface Distraction {
  node: Phaser.GameObjects.Container;
  x: number;
  y: number;
  used: boolean;
  label: string;
}

const FLOOR_TOP = 336;
const FLOOR_BOTTOM = 672;
const WALK_TOP = 420;
const HIDEOUT = { x: 172, y: 646 };
const JAR = { x: 928, y: 430 };

export class Level3Scene extends Phaser.Scene {
  private raton!: Raton;
  private hud!: MissionHUD;
  private hint!: Hint;
  private touch?: TouchControls;
  private stealBar!: ProgressBar;
  private detectionBar!: ProgressBar;
  private cones!: Phaser.GameObjects.Graphics;
  private jarNode!: Phaser.GameObjects.Container;
  private objectiveMark!: Phaser.GameObjects.Container;
  private stealthChip!: Phaser.GameObjects.Container;
  private stealthLabel!: Phaser.GameObjects.Text;

  private solids: Solid[] = [];
  private watchers: Watcher[] = [];
  private distractions: Distraction[] = [];

  private detection = 0;
  private stealProgress = 0;
  private hasNut = false;
  private elapsed = 0;
  private caughtCount = 0;
  private barkCd = 0;
  private droolTimer = 0;
  private idleAtJar = 0;
  private playable = false;
  private finished = false;
  private taughtInteract = false;

  private keys!: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    space: Phaser.Input.Keyboard.Key;
    e: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super(SCENES.LEVEL3);
  }

  create(): void {
    this.resetState();
    this.buildRoom();
    this.buildCast();
    this.buildHud();
    this.bindInput();

    Audio.playMusic('heist');
    Transition.reveal(this);
    this.time.delayedCall(400, () => this.playIntro());
  }

  private resetState(): void {
    this.solids = [];
    this.watchers = [];
    this.distractions = [];
    this.detection = 0;
    this.stealProgress = 0;
    this.hasNut = false;
    this.elapsed = 0;
    this.caughtCount = 0;
    this.barkCd = 0;
    this.droolTimer = 0;
    this.idleAtJar = 0;
    this.playable = false;
    this.finished = false;
    this.taughtInteract = false;
  }

  // ------------------------------------------------------------------ escena

  private buildRoom(): void {
    this.add.existing(makeRoom3(this, GAME_WIDTH, FLOOR_TOP, GAME_HEIGHT)).setDepth(0);

    this.add.existing(makeCabinetTop(this, 300, 170, 420)).setDepth(1);
    this.add.existing(makeRug(this, 660, 560, 620, 190)).setDepth(2);

    const addProp = (node: Phaser.GameObjects.Container, depthY: number): void => {
      this.add.existing(node).setDepth(Math.round(depthY));
    };

    addProp(makeCounter(this, 320, FLOOR_TOP + 26, 440), FLOOR_TOP + 26);
    addProp(makeFridge(this, 1152, FLOOR_TOP + 30), FLOOR_TOP + 30);
    addProp(makeSofa(this, 296, 588), 588);
    addProp(makeTable(this, 760, 440), 440);
    addProp(makeCrate(this, 1094, 632, 1), 632);
    addProp(makeCrate(this, 1180, 616, 0.8), 616);
    addProp(makeDogBed(this, HIDEOUT.x, HIDEOUT.y + 18), HIDEOUT.y - 6);

    // ¿Dónde no se puede pasar y qué corta la línea de visión?
    this.solids = [
      { x: 96, y: 336, w: 448, h: 58, sight: true, move: true }, // encimera
      { x: 1068, y: 336, w: 168, h: 58, sight: true, move: true }, // nevera
      { x: 118, y: 540, w: 356, h: 56, sight: true, move: true }, // sofá
      { x: 1036, y: 588, w: 186, h: 50, sight: true, move: true }, // cajas
      { x: 606, y: 386, w: 308, h: 58, sight: true, move: false } // mesa: se pasa por debajo
    ];

    // Sombras de contacto de los muebles que no bloquean el paso (la mesa).
    const contactShadows = this.add.graphics().setDepth(3);
    contactShadows.fillStyle(0x000000, 0.12);
    this.solids.forEach((s) => {
      if (!s.move) contactShadows.fillEllipse(s.x + s.w / 2, s.y + s.h + 24, s.w * 0.95, 34);
    });

    this.cones = this.add.graphics().setDepth(4);

    // El objetivo.
    this.jarNode = this.add.container(JAR.x, JAR.y).setDepth(Math.round(JAR.y));
    const stool = this.add.graphics();
    stool.fillStyle(0x000000, 0.2);
    stool.fillEllipse(4, 8, 120, 28);
    stool.fillStyle(PAL.wood, 1);
    stool.fillRoundedRect(-52, -32, 104, 34, 8);
    stool.fillStyle(PAL.woodDark, 1);
    stool.fillRect(-40, 0, 14, 24);
    stool.fillRect(26, 0, 14, 24);
    const jar = this.add.image(0, -34, 'nut-jar').setOrigin(0.5, 1).setScale(0.62);
    this.jarNode.add([stool, jar]);
    this.tweens.add({
      targets: jar,
      scaleY: 0.64,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.objectiveMark = this.add.container(JAR.x, JAR.y - 150).setDepth(5000);
    const ring = this.add.circle(0, 0, 26, undefined, 0);
    ring.setStrokeStyle(4, PAL.amber, 0.9);
    const arrow = this.add.triangle(0, 26, -12, 0, 12, 0, 0, 16, PAL.amber);
    this.objectiveMark.add([ring, arrow]);
    this.tweens.add({
      targets: this.objectiveMark,
      y: JAR.y - 168,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.buildDistractions();
  }

  private buildDistractions(): void {
    const specs: Array<[string, number, number, string]> = [
      ['ball', 604, 636, 'PELOTA'],
      ['shoe', 918, 654, 'ZAPATILLA'],
      ['bowl', 470, 668, 'COMEDERO']
    ];
    specs.forEach(([tex, x, y, label]) => {
      const node = this.add.container(x, y).setDepth(Math.round(y));
      const shadow = this.add.ellipse(2, 6, 60, 18, 0x000000, 0.2);
      const img = this.add.image(0, 0, tex).setOrigin(0.5, 0.85).setScale(0.62);
      node.add([shadow, img]);
      this.tweens.add({
        targets: img,
        y: -4,
        duration: 1400 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.distractions.push({ node, x, y, used: false, label });
    });
  }

  private buildCast(): void {
    this.raton = new Raton(this, HIDEOUT.x + 40, HIDEOUT.y);
    this.raton.setDepth(Math.round(HIDEOUT.y));
    this.raton.setFacing(1).setExpression('normal');

    const owner = new Human(this, 660, 500);
    owner.setFacing(-1).setActivity('walking');
    this.watchers.push({
      human: owner,
      home: 660,
      patrol: [420, 900],
      dir: 1,
      state: 'patrol',
      timer: rand(2, 4),
      target: null,
      floorY: 500,
      range: 430
    });

    const visitor = new Human(this, 1140, 466, { scale: CHARACTER_SCALE * 0.94, tint: 0xa8b6c4 });
    visitor.setFacing(-1).setActivity('idle');
    this.watchers.push({
      human: visitor,
      home: 1140,
      patrol: [1046, 1204],
      dir: -1,
      state: 'pause',
      timer: rand(1.6, 3),
      target: null,
      floorY: 466,
      range: 360
    });

    this.watchers.forEach((w) => w.human.setDepth(Math.round(w.floorY)));
  }

  private buildHud(): void {
    const info = LEVELS[2];
    this.hud = new MissionHUD(this, info.code, info.title);

    this.detectionBar = new ProgressBar(this, GAME_WIDTH - 340, GAME_HEIGHT - 62, {
      width: 300,
      label: 'NIVEL DE SOSPECHA',
      color: PAL.amber,
      warnColor: PAL.danger,
      warnAt: 0.6,
      align: 'right'
    })
      .setScrollFactor(0)
      .setDepth(6000);

    this.stealBar = new ProgressBar(this, GAME_WIDTH / 2 - 170, GAME_HEIGHT - 150, {
      width: 340,
      label: 'ROBO EN PROGRESO',
      color: PAL.ok,
      warnColor: PAL.ok,
      warnAt: 2
    })
      .setScrollFactor(0)
      .setDepth(6000)
      .setVisible(false);

    // Indicador de sigilo pegado a Ratón: OCULTO / ¡TE VEN!
    this.stealthChip = this.add.container(0, 0).setDepth(8500).setVisible(false);
    const chipBg = this.add.graphics();
    drawPanel(chipBg, -62, -19, 124, 38, { radius: 19, fillAlpha: 0.9, strokeWidth: 3 });
    this.stealthLabel = this.add
      .text(0, 0, 'OCULTO', {
        fontFamily: FONT_TITLE,
        fontSize: '19px',
        color: css(PAL.ok),
        fontStyle: '800'
      })
      .setOrigin(0.5);
    this.stealthChip.add([chipBg, this.stealthLabel]);

    this.hint = new Hint(this, 132);

    if (needsTouch(this)) {
      this.touch = new TouchControls(this, {
        stick: true,
        buttons: [
          { key: 'use', label: 'E', color: PAL.ok },
          { key: 'bark', label: '¡GUAU!', color: PAL.danger }
        ]
      });
    }
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: [kb.addKey(K.W), kb.addKey(K.UP)],
      down: [kb.addKey(K.S), kb.addKey(K.DOWN)],
      left: [kb.addKey(K.A), kb.addKey(K.LEFT)],
      right: [kb.addKey(K.D), kb.addKey(K.RIGHT)],
      space: kb.addKey(K.SPACE),
      e: kb.addKey(K.E)
    };
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT, K.E]);
    kb.on('keydown-M', () => Audio.toggleMute());
    kb.on('keydown-ESC', () => this.pauseGame());
    kb.on('keydown-P', () => this.pauseGame());
  }

  private pauseGame(): void {
    if (this.finished) return;
    this.scene.pause();
    this.scene.launch(SCENES.PAUSE, { from: SCENES.LEVEL3 });
  }

  /** Texto de tutorial según el mando activo. */
  private tip(desktop: string, touch: string): string {
    return this.touch ? touch : desktop;
  }


  // --------------------------------------------------------------- cinemática

  private playIntro(): void {
    const cam = this.cameras.main;
    cam.pan(JAR.x, JAR.y - 60, 900, 'Quad.easeOut');
    cam.zoomTo(1.9, 1000, 'Quad.easeOut');

    this.time.delayedCall(1200, () => {
      floatText(this, JAR.x, JAR.y - 210, pick(THOUGHTS.nutSpotted), {
        color: PAL.amber,
        size: 24,
        title: true,
        depth: 9000
      });
      Audio.nut();
    });

    this.time.delayedCall(2000, () => {
      cam.pan(this.raton.x, this.raton.y - 90, 700, 'Quad.easeInOut');
      cam.zoomTo(2.3, 800, 'Quad.easeInOut');
      this.raton.setExpression('obsessed');
    });

    this.time.delayedCall(3100, () => {
      const banner = this.add
        .text(GAME_WIDTH / 2, 200, 'OBJETIVO LOCALIZADO', {
          fontFamily: FONT_TITLE,
          fontSize: '58px',
          color: css(PAL.amber),
          fontStyle: '800',
          stroke: css(PAL.ink),
          strokeThickness: 10
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9500)
        .setScale(0.5);
      this.tweens.add({ targets: banner, scale: 1, duration: 320, ease: 'Back.easeOut' });
      this.tweens.add({
        targets: banner,
        alpha: 0,
        delay: 1100,
        duration: 400,
        onComplete: () => banner.destroy()
      });
      Audio.sting();
    });

    this.time.delayedCall(4100, () => {
      cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 700, 'Quad.easeInOut');
      cam.zoomTo(1, 700, 'Quad.easeInOut');
      this.time.delayedCall(700, () => {
        this.playable = true;
        this.raton.setExpression('alert');
        this.hint.show(
          this.tip(
            'WASD · MOVERSE     E · INTERACTUAR     ESPACIO · LADRAR',
            'JOYSTICK · MOVERSE     E · INTERACTUAR     ¡GUAU! · LADRAR'
          ),
          5000
        );
      });
    });

    this.input.keyboard?.once('keydown-SPACE', () => this.skipIntro());
    this.input.once('pointerdown', () => this.skipIntro());
  }

  private skipIntro(): void {
    if (this.playable || this.finished) return;
    this.playable = true;
    const cam = this.cameras.main;
    cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 260);
    cam.zoomTo(1, 260);
    this.raton.setExpression('alert');
  }

  // ------------------------------------------------------------------- ciclo

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);

    this.raton.tick(delta);
    this.watchers.forEach((w) => w.human.tick(delta));
    this.hud.tick(delta);
    this.stealBar.tick(delta);
    this.detectionBar.tick(delta);

    if (this.playable && !this.finished) {
      this.elapsed += dt;
      this.updateWatchers(dt);
      this.updateMovement(dt);
      this.updateInteraction(dt);
      this.updateDetection(dt);
      this.updateEasterEgg(dt);
    }

    this.drawCones();
    this.detectionBar.setValue(this.detection);
    this.touch?.endFrame();
  }

  // ------------------------------------------------------------------- NPCs

  private updateWatchers(dt: number): void {
    this.watchers.forEach((w) => {
      w.timer -= dt;

      if (w.state === 'investigate' && w.target) {
        const dx = w.target.x - w.human.x;
        if (Math.abs(dx) > 12) {
          const step = Math.sign(dx) * 108 * dt;
          w.human.x += step;
          w.human.setFacing(step < 0 ? -1 : 1).setActivity('walking').setMotion(0.6);
          w.human.setGaze(step < 0 ? -1 : 1);
        } else {
          w.human.setMotion(0).setActivity('searching');
          if (w.timer <= 0) {
            w.state = 'patrol';
            w.target = null;
            w.timer = rand(1.4, 2.6);
            w.human.setActivity('walking');
          }
        }
        return;
      }

      if (w.state === 'pause') {
        w.human.setMotion(0).setActivity('idle');
        if (w.timer <= 0) {
          w.state = 'patrol';
          w.timer = rand(2.4, 4.2);
          w.human.setActivity('walking');
          if (Math.random() < 0.5) {
            w.dir = (w.dir * -1) as -1 | 1;
            w.human.setFacing(w.dir).setGaze(w.dir);
          }
        }
        return;
      }

      // patrulla
      const speed = 92;
      w.human.x += w.dir * speed * dt;
      w.human.setMotion(0.55).setActivity('walking');
      w.human.setFacing(w.dir).setGaze(w.dir);

      if (w.human.x < w.patrol[0] || w.human.x > w.patrol[1]) {
        w.human.x = clamp(w.human.x, w.patrol[0], w.patrol[1]);
        w.dir = (w.dir * -1) as -1 | 1;
        w.state = 'pause';
        w.timer = rand(1.1, 2.4);
      } else if (w.timer <= 0) {
        w.state = 'pause';
        w.timer = rand(1.2, 2.6);
      }
    });
  }

  private alertWatchers(x: number, y: number, radius = 620): void {
    let nearest: Watcher | null = null;
    let best = radius;
    this.watchers.forEach((w) => {
      const d = Math.abs(w.human.x - x) + Math.abs(w.floorY - y) * 0.4;
      if (d < best) {
        best = d;
        nearest = w;
      }
    });
    if (!nearest) return;
    const w = nearest as Watcher;
    w.state = 'investigate';
    w.target = { x: clamp(x, 120, GAME_WIDTH - 120), y };
    w.timer = 4.4;
    alertMark(this, w.human.x + 30, w.floorY - 250, '?', PAL.amber, 9000);
  }

  private drawCones(): void {
    const g = this.cones;
    g.clear();
    this.watchers.forEach((w) => {
      const ox = w.human.x;
      const oy = w.floorY - 6;
      const dir = w.human.gaze === 1 ? 0 : Math.PI;
      const spread = w.state === 'investigate' ? 0.62 : 0.42;
      const range = w.state === 'investigate' ? w.range * 0.75 : w.range;
      const hot = this.detection > 0.25;

      const steps = 10;
      g.fillStyle(hot ? PAL.danger : PAL.amber, 0.26);
      g.beginPath();
      g.moveTo(ox, oy);
      for (let i = 0; i <= steps; i++) {
        const a = dir - spread + (spread * 2 * i) / steps;
        g.lineTo(ox + Math.cos(a) * range, oy + Math.sin(a) * range * 0.55);
      }
      g.closePath();
      g.fillPath();

      g.lineStyle(3, hot ? PAL.danger : PAL.amber, 0.5);
      g.strokePath();
    });
  }

  // -------------------------------------------------------------- movimiento

  private axis(negative: Phaser.Input.Keyboard.Key[], positive: Phaser.Input.Keyboard.Key[]): number {
    const n = negative.some((k) => k.isDown) ? 1 : 0;
    const p = positive.some((k) => k.isDown) ? 1 : 0;
    return p - n;
  }

  private blocked(x: number, y: number): boolean {
    const boxW = 54;
    const boxH = 30;
    const r: Rect = { x: x - boxW / 2, y: y - boxH, w: boxW, h: boxH };
    return this.solids.some(
      (s) => s.move && r.x < s.x + s.w && r.x + r.w > s.x && r.y < s.y + s.h && r.y + r.h > s.y
    );
  }

  private updateMovement(dt: number): void {
    let dx = this.keys ? this.axis(this.keys.left, this.keys.right) : 0;
    let dy = this.keys ? this.axis(this.keys.up, this.keys.down) : 0;
    if (this.touch) {
      const v = this.touch.vector;
      if (v.lengthSq() > 0.02) {
        dx = v.x;
        dy = v.y;
      }
    }
    if (this.stealProgress > 0 && this.stealProgress < 1) {
      dx = 0;
      dy = 0;
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    const speed = (this.hasNut ? 168 : 232) * (Save.data.ratonMode ? 1.08 : 1);
    const nx = clamp(this.raton.x + dx * speed * dt, 70, GAME_WIDTH - 70);
    const ny = clamp(this.raton.y + dy * speed * dt * 0.82, WALK_TOP, FLOOR_BOTTOM);

    if (!this.blocked(nx, this.raton.y)) this.raton.x = nx;
    if (!this.blocked(this.raton.x, ny)) this.raton.y = ny;

    this.raton.setDepth(Math.round(this.raton.y) + 1);
    this.raton.setMotion(Math.min(1, Math.hypot(dx, dy)));
    // Ligera perspectiva: más cerca de la cámara, más grande.
    this.raton.setScale(0.82 + ((this.raton.y - WALK_TOP) / (FLOOR_BOTTOM - WALK_TOP)) * 0.26);

    if (dx < -0.2) this.raton.setFacing(-1);
    else if (dx > 0.2) this.raton.setFacing(1);
  }

  // ------------------------------------------------------------ interacción

  private nearestDistraction(): Distraction | null {
    let best: Distraction | null = null;
    let bestD = 110;
    this.distractions.forEach((d) => {
      if (d.used) return;
      const dist = Math.hypot(d.x - this.raton.x, (d.y - this.raton.y) * 1.4);
      if (dist < bestD) {
        bestD = dist;
        best = d;
      }
    });
    return best;
  }

  private get nearJar(): boolean {
    return Math.hypot(JAR.x - this.raton.x, (JAR.y - this.raton.y) * 1.4) < 128;
  }

  private get nearHideout(): boolean {
    return Math.hypot(HIDEOUT.x - this.raton.x, (HIDEOUT.y - this.raton.y) * 1.4) < 120;
  }

  private useHeld(): boolean {
    return this.keys?.e.isDown === true || this.touch?.isDown('use') === true;
  }

  private usePressed(): boolean {
    return (
      (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.e)) ||
      this.touch?.justPressed('use') === true
    );
  }

  private updateInteraction(dt: number): void {
    if (this.barkCd > 0) this.barkCd -= dt;

    // Ladrar: mucho CAOS, pero llama la atención. Con la nuez en la boca, no puede.
    const barkPressed =
      (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.space)) ||
      this.touch?.justPressed('bark') === true;
    if (barkPressed && this.barkCd <= 0 && !this.hasNut) {
      this.barkCd = 1.6;
      this.raton.bark({ depth: 9000 });
      Run.bump('barks');
      Run.addChaos(100, 3);
      this.hud.bump(true);
      this.alertWatchers(this.raton.x, this.raton.y);
    } else if (barkPressed && this.hasNut) {
      floatText(this, this.raton.x, this.raton.y - 200, 'no puedo, tengo la boca ocupada', {
        color: PAL.creamDim,
        size: 17,
        depth: 9000
      });
    }

    // Robo de la nuez.
    if (!this.hasNut && this.nearJar) {
      if (!this.taughtInteract) {
        this.taughtInteract = true;
        this.hint.show(this.tip('Mantén E para robar la nuez', 'Mantén pulsado E para robar la nuez'));
      }
      if (this.useHeld()) {
        this.stealProgress = clamp(this.stealProgress + dt * 0.52, 0, 1);
        this.stealBar.setVisible(true).setValue(this.stealProgress);
        this.raton.setExpression('obsessed');
        this.idleAtJar = 0;
        if (this.stealProgress >= 1) this.stealNut();
        return;
      }
      this.stealProgress = clamp(this.stealProgress - dt * 0.7, 0, 1);
      this.stealBar.setVisible(this.stealProgress > 0.01).setValue(this.stealProgress);
      this.idleAtJar += dt;
    } else {
      this.stealProgress = clamp(this.stealProgress - dt * 0.9, 0, 1);
      this.stealBar.setVisible(this.stealProgress > 0.01).setValue(this.stealProgress);
      this.idleAtJar = 0;
      if (!this.hasNut && this.taughtInteract) this.hint.hide();
    }

    // Escape con la nuez.
    if (this.hasNut && this.nearHideout) {
      this.win();
      return;
    }

    // Distracciones.
    const target = this.nearestDistraction();
    if (target && !this.hasNut) {
      if (!this.taughtInteract) {
        this.taughtInteract = true;
        this.hint.show(`E · empujar la ${target.label.toLowerCase()} para hacer ruido`, 3600);
      }
      if (this.usePressed()) this.pushObject(target);
    }
  }

  private pushObject(target: Distraction): void {
    target.used = true;
    Run.bump('distractions');
    const gained = Run.addChaos(CHAOS.DISTRACTION, 3);
    this.hud.bump(true);
    this.hint.hide();

    const dir = this.raton.facingDir;
    const dropX = clamp(target.x + dir * 240, 120, GAME_WIDTH - 120);
    this.tweens.add({
      targets: target.node,
      x: dropX,
      duration: 620,
      ease: 'Quad.easeOut',
      onComplete: () => {
        Audio.thud();
        puff(this, dropX, target.y, { count: 6, spread: 50 });
        this.alertWatchers(dropX, target.y);
        for (let i = 0; i < 3; i++) {
          const ring = this.add.circle(dropX, target.y - 10, 12, undefined, 0).setDepth(9000);
          ring.setStrokeStyle(4, PAL.amber, 0.7);
          this.tweens.add({
            targets: ring,
            radius: 120 + i * 40,
            alpha: 0,
            duration: 620,
            delay: i * 90,
            onComplete: () => ring.destroy()
          });
        }
      }
    });
    this.tweens.add({ targets: target.node, y: target.y - 26, duration: 300, yoyo: true });
    floatText(this, this.raton.x, this.raton.y - 190, `+${gained} RUIDO SOSPECHOSO`, {
      color: PAL.ok,
      size: 20,
      depth: 9000
    });
    Audio.click();
  }

  private stealNut(): void {
    this.hasNut = true;
    this.stealBar.setVisible(false);
    this.stealProgress = 0;
    this.raton.setCarryingNut(true);
    this.raton.setExpression('obsessed');
    Run.bump('nuts');
    const gained = Run.addChaos(CHAOS.NUT_STOLEN, 3);
    this.hud.bump(true);
    this.hint.hide();

    Audio.sting();
    Audio.nut();
    this.objectiveMark.setVisible(false);

    const cam = this.cameras.main;
    this.time.timeScale = 0.4;
    this.tweens.timeScale = 0.4;
    cam.zoomTo(1.9, 500, 'Quad.easeOut');
    cam.pan(this.raton.x, this.raton.y - 80, 500, 'Quad.easeOut');
    cam.flash(220, 255, 230, 180);
    sparkles(this, this.raton.x, this.raton.y - 120, { count: 16, depth: 9000 });

    floatText(this, this.raton.x, this.raton.y - 210, `+${gained}  NUEZ ADQUIRIDA`, {
      color: PAL.amber,
      size: 26,
      title: true,
      depth: 9000
    });

    this.time.delayedCall(320, () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      cam.zoomTo(1, 600, 'Quad.easeInOut');
      cam.pan(GAME_WIDTH / 2, GAME_HEIGHT / 2, 600, 'Quad.easeInOut');
    });

    this.time.delayedCall(1000, () => {
      if (this.finished) return;
      this.hint.show('¡Corre a tu cama! (más lento y más visible)', 4200);
      // Todo el mundo se pone nervioso.
      this.watchers.forEach((w) => {
        w.range *= 1.12;
      });
    });

    // Marcador del escondite.
    const mark = this.add.container(HIDEOUT.x, HIDEOUT.y - 130).setDepth(5000);
    const ring = this.add.circle(0, 0, 24, undefined, 0);
    ring.setStrokeStyle(4, PAL.ok, 0.9);
    mark.add([ring, this.add.triangle(0, 24, -12, 0, 12, 0, 0, 16, PAL.ok)]);
    this.tweens.add({
      targets: mark,
      y: HIDEOUT.y - 148,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // -------------------------------------------------------------- detección

  private canSee(w: Watcher): boolean {
    const ox = w.human.x;
    const oy = w.floorY - 6;
    const dx = this.raton.x - ox;
    const dy = (this.raton.y - oy) * 1.8;
    const dist = Math.hypot(dx, dy);
    const range = w.range * (this.hasNut ? 1.15 : 1);
    if (dist > range) return false;

    const dir = w.human.gaze === 1 ? 0 : Math.PI;
    const angle = Math.atan2(dy, dx);
    const spread = w.state === 'investigate' ? 0.7 : 0.5;
    if (Math.abs(Phaser.Math.Angle.Wrap(angle - dir)) > spread) return false;

    return !this.solids.some(
      (s) => s.sight && segmentIntersectsRect(ox, w.floorY, this.raton.x, this.raton.y, s)
    );
  }

  private updateDetection(dt: number): void {
    const seenBy = this.watchers.filter((w) => this.canSee(w));
    this.updateStealthChip(seenBy.length > 0);
    if (seenBy.length > 0) {
      const rate = (0.42 + seenBy.length * 0.16) * (this.hasNut ? 1.5 : 1);
      this.detection = clamp(this.detection + rate * dt, 0, 1);
      this.raton.setExpression(this.detection > 0.5 ? 'fear' : 'alert');
      this.raton.tremble(this.detection > 0.55);
      if (this.detection > 0.35) {
        this.detectionBar.flashPulse();
        seenBy.forEach((w) => w.human.lookOffset(w.human.gaze, 0.3));
      }
    } else {
      this.detection = clamp(this.detection - dt * 0.3, 0, 1);
      this.raton.tremble(false);
      if (this.raton.currentExpression === 'fear') this.raton.setExpression('alert');
    }

    if (this.detection >= 1) this.busted();
  }

  /** Dice al jugador, sin ambigüedad, si ahora mismo está a cubierto. */
  private updateStealthChip(seen: boolean): void {
    const nearWatcher = this.watchers.some(
      (w) => Math.hypot(w.human.x - this.raton.x, (w.floorY - this.raton.y) * 1.8) < w.range + 90
    );
    if (!nearWatcher && !seen) {
      this.stealthChip.setVisible(false);
      return;
    }
    this.stealthChip.setVisible(true);
    this.stealthChip.setPosition(this.raton.x, this.raton.y - 196);
    this.stealthLabel
      .setText(seen ? '¡TE VEN!' : 'OCULTO')
      .setColor(css(seen ? PAL.danger : PAL.ok));
  }

  private busted(): void {
    if (this.finished) return;
    this.caughtCount++;
    Run.bump('caught');
    Run.addChaos(CHAOS.CAUGHT, 3);
    this.hud.bump(false);
    this.detection = 0;

    Audio.fail();
    this.cameras.main.shake(300, 0.008);
    this.cameras.main.flash(200, 130, 40, 30);
    this.raton.setExpression('caught');
    this.raton.freeze(true);
    this.playable = false;

    const head = this.raton.headWorld();
    alertMark(this, head.x + 40, head.y, '!', PAL.danger, 9000);
    floatText(this, this.raton.x, this.raton.y - 210, pick(THOUGHTS.caught), {
      color: PAL.danger,
      size: 24,
      title: true,
      depth: 9000
    });

    const banner = this.add
      .text(GAME_WIDTH / 2, 300, 'TE HAN PILLADO', {
        fontFamily: FONT_TITLE,
        fontSize: '68px',
        color: css(PAL.danger),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 11
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9500)
      .setScale(0.5);
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.easeOut' });

    if (this.caughtCount >= 3) {
      this.time.delayedCall(1300, () => this.lose());
      return;
    }

    this.time.delayedCall(1400, () => {
      banner.destroy();
      if (this.finished) return;
      this.raton.freeze(false);
      this.raton.setExpression('alert');
      this.raton.setPosition(HIDEOUT.x + 40, HIDEOUT.y);
      this.raton.setCarryingNut(this.hasNut);
      this.playable = true;
      puff(this, this.raton.x, this.raton.y, { count: 8, spread: 60 });
      floatText(this, this.raton.x, this.raton.y - 200, 'Ratón lo niega todo y vuelve a empezar', {
        color: PAL.creamDim,
        size: 17,
        depth: 9000
      });
    });
  }

  // ------------------------------------------------------------- easter egg

  private updateEasterEgg(dt: number): void {
    if (this.idleAtJar > 5 && !this.hasNut) {
      this.droolTimer -= dt;
      if (this.droolTimer <= 0) {
        this.droolTimer = 0.42;
        const m = this.raton.muzzleWorld();
        drool(this, m.x, m.y + 10, 9000);
        this.raton.setExpression('obsessed');
      }
      if (this.idleAtJar > 5.1 && this.idleAtJar < 5.2) {
        floatText(this, this.raton.x, this.raton.y - 210, '*babea audiblemente*', {
          color: PAL.pop,
          size: 19,
          depth: 9000
        });
      }
    }
  }

  // ---------------------------------------------------------------- desenlace

  private win(): void {
    if (this.finished) return;
    this.finished = true;
    this.playable = false;
    Run.addTime(this.elapsed * 1000);
    this.hint.hide();

    const cam = this.cameras.main;
    cam.zoomTo(1.85, 900, 'Quad.easeOut');
    cam.pan(HIDEOUT.x + 60, HIDEOUT.y - 60, 900, 'Quad.easeOut');
    Audio.success();

    this.raton.setMotion(0);
    this.tweens.add({
      targets: this.raton,
      x: HIDEOUT.x,
      y: HIDEOUT.y,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.raton.setCarryingNut(false);
        const nut = this.add
          .image(HIDEOUT.x + 46, HIDEOUT.y - 6, 'nut')
          .setScale(0.5)
          .setDepth(Math.round(HIDEOUT.y) + 5);
        this.tweens.add({ targets: nut, y: nut.y - 26, duration: 260, yoyo: true, ease: 'Quad.easeOut' });
        sparkles(this, nut.x, nut.y, { count: 12, depth: 9000 });
        this.raton.setExpression('happy');
        this.time.delayedCall(400, () => this.raton.setPose('lie'));
      }
    });

    const speedBonus = Math.round(clamp((120 - this.elapsed) / 90, 0, 1) * CHAOS.SPEED_BONUS_MAX);
    const ghostBonus = this.caughtCount === 0 ? 400 : 0;
    Run.addChaos(CHAOS.MISSION_COMPLETE, 3);
    if (speedBonus) Run.addChaos(speedBonus, 3);
    if (ghostBonus) Run.addChaos(ghostBonus, 3);
    Run.completeLevel(3);

    this.time.delayedCall(1500, () => {
      this.add
        .text(GAME_WIDTH / 2, 240, 'GOLPE PERFECTO', {
          fontFamily: FONT_TITLE,
          fontSize: '78px',
          color: css(PAL.cream),
          fontStyle: '800',
          stroke: css(PAL.ink),
          strokeThickness: 12
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9500);
      this.add
        .text(GAME_WIDTH / 2, 312, 'Valor del botín: aproximadamente 0,12 €.', {
          fontFamily: FONT_UI,
          fontSize: '26px',
          color: css(PAL.amber),
          fontStyle: '800',
          stroke: css(PAL.ink),
          strokeThickness: 6
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9500);
      floatText(this, GAME_WIDTH / 2, 380, pick(THOUGHTS.nutStolen), {
        color: PAL.creamDim,
        size: 20,
        depth: 9500,
        rise: 20
      });
    });

    this.time.delayedCall(3600, () => {
      Transition.to(this, SCENES.RESULT, {
        level: 3,
        success: true,
        title: 'GOLPE PERFECTO',
        subtitle: 'Valor del botín: aproximadamente 0,12 €.',
        bonuses: [
          ['Misión completada', CHAOS.MISSION_COMPLETE],
          ['Nuez sustraída', CHAOS.NUT_STOLEN],
          ['Rapidez', speedBonus],
          ['Sin ser visto ni una vez', ghostBonus]
        ],
        notes: [
          `Tiempo: ${this.elapsed.toFixed(1)} s`,
          `Distracciones provocadas: ${Run.s.distractions}`
        ]
      });
    });
  }

  private lose(): void {
    if (this.finished) return;
    this.finished = true;
    Run.addTime(this.elapsed * 1000);
    Audio.fail();

    Transition.to(this, SCENES.RESULT, {
      level: 3,
      success: false,
      title: 'OPERACIÓN ABORTADA',
      subtitle: 'Las nueces siguen en el bote. Provisionalmente.',
      notes: [
        `Veces descubierto: ${this.caughtCount}`,
        this.hasNut ? 'La nuez ha sido confiscada.' : 'Ni una sola nuez. Humillante.',
        'Ratón niega todas las acusaciones.'
      ]
    });
  }
}
