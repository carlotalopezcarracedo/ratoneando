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
  BACKGROUND_CHARACTER_SCALE
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { chance, clamp, pick, rand } from '../utils/helpers';
import { Raton } from '../entities/Raton';
import { Human } from '../entities/Human';
import { Bicycle, type BikeKind } from '../entities/Bicycle';
import { MissionHUD } from '../ui/MissionHUD';
import { ProgressBar } from '../ui/ProgressBar';
import { Hint } from '../ui/Hint';
import { TouchControls, needsTouch } from '../ui/TouchControls';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';
import { Transition } from '../systems/Transition';
import { Save } from '../systems/SaveManager';
import { alertMark, floatText, puff, sparkles } from '../art/FX';
import { makeBench, makeStreetBackdrop } from '../art/props';
import { drawPanel } from '../ui/Panel';

interface Lane {
  y: number;
  dir: -1 | 1;
  gap: [number, number];
  kinds: BikeKind[];
  timer: number;
}

const WORLD_H = 2100;
const LANE_H = 104;
const SAFE_H = 120;
const SPEED = 232;
/** Borde superior de la acera de llegada; lo fija buildWorld según los carriles. */
const GOAL_FALLBACK = 768;

export class Level2Scene extends Phaser.Scene {
  private raton!: Raton;
  private hud!: MissionHUD;
  private hint!: Hint;
  private touch?: TouchControls;
  private panicBar!: ProgressBar;
  private chaosBar!: ProgressBar;

  private lanes: Lane[] = [];
  private safeBands: Array<[number, number]> = [];
  private bikes: Bicycle[] = [];
  private lifeIcons: Phaser.GameObjects.Image[] = [];
  private pedestrians: Human[] = [];
  private leaves: Phaser.GameObjects.Ellipse[] = [];

  private lives = 3;
  private panic = 0;
  private chaosMeter = 0;
  private barkCd = 0;
  private respawning = 0;
  private checkpointY = WORLD_H - 60;
  private checkpointIndex = 0;
  private elapsed = 0;
  private bestY = WORLD_H;
  private finished = false;
  private heartbeatCd = 0;
  private tinySpawned = false;
  private taughtMove = false;
  private taughtBark = false;
  private nearMisses = new Set<Bicycle>();
  private goalTop = GOAL_FALLBACK;
  private advanceMark = WORLD_H;
  private laneCombo = 0;
  private lastAdvanceAt = 0;

  private keys!: {
    up: Phaser.Input.Keyboard.Key[];
    down: Phaser.Input.Keyboard.Key[];
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    space: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super(SCENES.LEVEL2);
  }

  create(): void {
    this.resetState();
    this.buildWorld();
    this.buildCast();
    this.buildHud();
    this.bindInput();

    this.cameras.main.setBounds(0, 0, GAME_WIDTH, WORLD_H);
    this.cameras.main.startFollow(this.raton, true, 0.12, 0.14);
    this.cameras.main.setDeadzone(GAME_WIDTH, 140);

    Audio.playMusic('tension');
    Transition.reveal(this);
    this.hint.show(this.tip('WASD · CRUZA          ESPACIO · LADRA', 'JOYSTICK · CRUZA          ¡GUAU! · LADRA'));
  }

  private resetState(): void {
    this.lanes = [];
    this.safeBands = [];
    this.bikes = [];
    this.lifeIcons = [];
    this.pedestrians = [];
    this.leaves = [];
    this.lives = 3;
    this.panic = 0;
    this.chaosMeter = 0;
    this.barkCd = 0;
    this.respawning = 0;
    this.checkpointY = WORLD_H - 60;
    this.checkpointIndex = 0;
    this.elapsed = 0;
    this.bestY = WORLD_H;
    this.finished = false;
    this.heartbeatCd = 0;
    this.tinySpawned = false;
    this.taughtMove = false;
    this.taughtBark = false;
    this.nearMisses = new Set();
    this.goalTop = GOAL_FALLBACK;
    this.advanceMark = WORLD_H;
    this.laneCombo = 0;
    this.lastAdvanceAt = 0;
  }

  // ------------------------------------------------------------------ mundo

  private buildWorld(): void {
    const g = this.add.graphics().setDepth(0);

    // Construcción de bandas de abajo arriba.
    let y = WORLD_H;
    const bands: Array<{ type: 'safe' | 'lane' | 'goal'; top: number; bottom: number }> = [];
    const push = (type: 'safe' | 'lane' | 'goal', h: number): void => {
      bands.push({ type, top: y - h, bottom: y });
      y -= h;
    };

    // Ocho carriles en vez de diez: la travesía se hacía larga y repetitiva.
    push('safe', SAFE_H);
    for (let i = 0; i < 3; i++) push('lane', LANE_H);
    push('safe', SAFE_H);
    for (let i = 0; i < 2; i++) push('lane', LANE_H);
    push('safe', SAFE_H);
    for (let i = 0; i < 3; i++) push('lane', LANE_H);
    push('goal', 140);

    const roadTop = bands[bands.length - 1].bottom;
    this.add.existing(makeStreetBackdrop(this, GAME_WIDTH, roadTop)).setDepth(-10);

    let laneIndex = 0;
    bands.forEach((band) => {
      const h = band.bottom - band.top;
      if (band.type === 'lane') {
        g.fillStyle(laneIndex % 2 === 0 ? PAL.asphalt : PAL.asphaltDark, 1);
        g.fillRect(0, band.top, GAME_WIDTH, h);
        g.fillStyle(0x000000, 0.16);
        g.fillRect(0, band.top, GAME_WIDTH, 8);
        // marcas discontinuas
        g.fillStyle(PAL.cream, 0.42);
        for (let mx = 20; mx < GAME_WIDTH; mx += 130) g.fillRect(mx, band.top + h / 2 - 3, 68, 6);

        const dir: -1 | 1 = laneIndex % 2 === 0 ? 1 : -1;
        const difficulty = laneIndex / 7;
        this.lanes.push({
          y: band.top + h / 2 + 26,
          dir,
          gap: [Math.max(1.6, 3.0 - difficulty), Math.max(2.7, 5.0 - difficulty * 1.6)],
          kinds: this.kindsFor(laneIndex),
          timer: rand(0.2, 1.8)
        });
        laneIndex++;
      } else {
        const isGoal = band.type === 'goal';
        if (isGoal) this.goalTop = band.top;
        g.fillStyle(isGoal ? PAL.greenDark : PAL.creamDim, 1);
        g.fillRect(0, band.top, GAME_WIDTH, h);
        g.fillStyle(isGoal ? PAL.green : PAL.cream, 1);
        g.fillRect(0, band.top + 8, GAME_WIDTH, h - 14);
        if (!isGoal) {
          g.lineStyle(2, PAL.creamDim, 0.85);
          for (let mx = 0; mx < GAME_WIDTH; mx += 84) g.lineBetween(mx, band.top + 8, mx, band.bottom - 6);
          for (let my = band.top + 8; my < band.bottom - 6; my += 46)
            g.lineBetween(0, my, GAME_WIDTH, my);
        } else {
          g.fillStyle(PAL.greenLight, 0.4);
          for (let i = 0; i < 40; i++) {
            const gx = rand(0, GAME_WIDTH);
            const gy = rand(band.top + 14, band.bottom - 10);
            g.fillTriangle(gx, gy, gx + 5, gy - 14, gx + 10, gy);
          }
        }
        this.safeBands.push([band.top + 6, band.bottom - 6]);
      }
    });

    // Bordillos entre acera y calzada.
    this.safeBands.forEach(([top, bottom]) => {
      g.fillStyle(PAL.wallShade, 1);
      g.fillRect(0, top - 8, GAME_WIDTH, 8);
      g.fillRect(0, bottom - 2, GAME_WIDTH, 8);
    });

    // Decoración (después de recorrer las bandas: ya se conoce this.goalTop).
    this.add.existing(makeBench(this, 220, WORLD_H - 34)).setDepth(2);
    this.add.existing(makeBench(this, 1060, WORLD_H - 34)).setDepth(2);
    this.add.existing(makeBench(this, 640, this.goalTop + 84)).setDepth(2);

    for (let i = 0; i < 16; i++) {
      const leaf = this.add
        .ellipse(rand(0, GAME_WIDTH), rand(this.goalTop, WORLD_H), rand(7, 13), rand(4, 8), PAL.amber, 0.8)
        .setDepth(70)
        .setAngle(rand(0, 360));
      this.leaves.push(leaf);
    }
  }

  private kindsFor(index: number): BikeKind[] {
    if (index < 3) return ['city', 'city', 'mtb'];
    if (index < 6) return ['city', 'mtb', 'road'];
    return ['road', 'road', 'mtb', 'city'];
  }

  private buildCast(): void {
    this.raton = new Raton(this, GAME_WIDTH / 2, WORLD_H - 60);
    this.raton.setDepth(WORLD_H - 54);
    this.raton.setExpression('alert');

    // Peatones decorativos en las aceras.
    const spots: Array<[number, number, -1 | 1]> = [
      [200, WORLD_H - 74, 1],
      [980, this.goalTop + 90, -1]
    ];
    spots.forEach(([x, y, dir]) => {
      const p = new Human(this, x, y, {
        scale: BACKGROUND_CHARACTER_SCALE,
        tint: chance(0.5) ? 0xb9c4cf : 0xd7c3a8
      });
      p.setDepth(Math.round(y));
      p.setFacing(dir).setActivity('walking').setMotion(0.45);
      this.pedestrians.push(p);
      this.tweens.add({
        targets: p,
        x: dir === 1 ? x + 320 : x - 320,
        duration: 9000,
        yoyo: true,
        repeat: -1,
        onYoyo: () => p.setFacing(dir === 1 ? -1 : 1),
        onRepeat: () => p.setFacing(dir)
      });
    });
  }

  private buildHud(): void {
    const info = LEVELS[1];
    this.hud = new MissionHUD(this, info.code, info.title);

    // Con controles táctiles las barras se van arriba: abajo las tapan el
    // joystick y los botones, que ocupan las dos esquinas inferiores.
    const touch = needsTouch(this);

    this.panicBar = new ProgressBar(this, 40, touch ? 116 : GAME_HEIGHT - 62, {
      width: 280,
      label: 'MEDIDOR DE PÁNICO',
      color: PAL.pop,
      warnColor: PAL.danger,
      warnAt: 0.6
    })
      .setScrollFactor(0)
      .setDepth(6000);

    this.chaosBar = new ProgressBar(this, GAME_WIDTH - 320, touch ? 178 : GAME_HEIGHT - 62, {
      width: 280,
      label: 'MEDIDOR DE CAOS (LADRIDOS)',
      color: PAL.amber,
      warnColor: PAL.danger,
      warnAt: 0.7,
      align: 'right'
    })
      .setScrollFactor(0)
      .setDepth(6000);

    const livesPanel = this.add.graphics().setScrollFactor(0).setDepth(5990);
    drawPanel(livesPanel, GAME_WIDTH - 176, 88, 158, 46, {
      radius: 22,
      fillAlpha: 0.82,
      strokeWidth: 3
    });

    for (let i = 0; i < 3; i++) {
      const icon = this.add
        .image(GAME_WIDTH - 60 - i * 44, 111, 'paw-icon')
        .setScale(0.5)
        .setScrollFactor(0)
        .setDepth(6000);
      this.lifeIcons.push(icon);
    }

    this.hint = new Hint(this, touch ? 244 : 132);

    if (touch) {
      this.touch = new TouchControls(this, {
        stick: true,
        buttons: [{ key: 'bark', label: '¡GUAU!', color: PAL.danger }]
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
      space: kb.addKey(K.SPACE)
    };
    kb.addCapture([K.SPACE, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    kb.on('keydown-M', () => Audio.toggleMute());
    kb.on('keydown-ESC', () => this.pauseGame());
    // Reintento inmediato: en un juego de intentos cortos, volver al menú
    // de pausa para repetir es un peaje innecesario.
    kb.on('keydown-R', () => {
      if (!this.finished) this.scene.restart();
    });
    kb.on('keydown-P', () => this.pauseGame());
  }

  private pauseGame(): void {
    if (this.finished) return;
    this.scene.pause();
    this.scene.launch(SCENES.PAUSE, { from: SCENES.LEVEL2 });
  }

  /** Texto de tutorial según el mando activo. */
  private tip(desktop: string, touch: string): string {
    return this.touch ? touch : desktop;
  }


  // ------------------------------------------------------------------- ciclo

  override update(time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);

    this.raton.tick(delta);
    this.pedestrians.forEach((p) => p.tick(delta));
    this.hud.tick(delta);
    this.panicBar.tick(delta);
    this.chaosBar.tick(delta);
    this.updateLeaves(dt);
    this.updateBikes(time, delta);

    if (!this.finished) {
      this.elapsed += dt;
      this.spawnTraffic(dt);
      this.updateMovement(dt);
      this.updateBark(dt);
      this.updatePanic(dt);
      this.checkCollisions();
      this.checkProgress();
    }

    this.chaosMeter = clamp(this.chaosMeter - dt * 0.055, 0, 1);
    this.chaosBar.setValue(this.chaosMeter);
    this.panicBar.setValue(this.panic);
    this.touch?.endFrame();
  }

  private updateLeaves(dt: number): void {
    this.leaves.forEach((leaf) => {
      leaf.x += Math.sin(this.elapsed * 1.4 + leaf.y) * 24 * dt;
      leaf.y += 26 * dt;
      leaf.angle += 46 * dt;
      if (leaf.y > WORLD_H) {
        leaf.y = this.goalTop;
        leaf.x = rand(0, GAME_WIDTH);
      }
    });
  }

  // ---------------------------------------------------------------- tráfico

  private spawnTraffic(dt: number): void {
    const pressure = 1 - this.chaosMeter * 0.42;
    this.lanes.forEach((lane) => {
      lane.timer -= dt;
      if (lane.timer > 0) return;
      lane.timer = rand(lane.gap[0], lane.gap[1]) * pressure;
      this.spawnBike(lane);
    });
  }

  private spawnBike(lane: Lane): void {
    let kind: BikeKind = pick(lane.kinds);
    if (!this.tinySpawned && chance(0.03)) {
      kind = 'tiny';
      this.tinySpawned = true;
    } else if (chance(0.07)) {
      kind = 'slowpoke';
    } else if (chance(0.06)) {
      kind = 'rocket';
    }

    // Aviso en el borde del carril antes de que entre la bici: nada de golpes
    // que no se puedan ver venir.
    this.showLaneWarning(lane, kind === 'rocket');
    this.time.delayedCall(660, () => this.createBike(lane, kind));
  }

  private showLaneWarning(lane: Lane, urgent: boolean): void {
    const x = lane.dir === 1 ? 30 : GAME_WIDTH - 30;
    const tip = 26 * lane.dir;
    const arrow = this.add
      .triangle(x, lane.y - 46, 0, 0, 0, 34, tip, 17, urgent ? PAL.danger : PAL.amber)
      .setDepth(8000)
      .setAlpha(0);
    this.tweens.add({
      targets: arrow,
      alpha: 0.95,
      duration: 150,
      yoyo: true,
      repeat: 1,
      onComplete: () => arrow.destroy()
    });
  }

  private createBike(lane: Lane, kind: BikeKind): void {
    if (this.finished) return;
    const x = lane.dir === 1 ? -240 : GAME_WIDTH + 240;
    const bike = new Bicycle(this, x, lane.y, kind, lane.dir);
    bike.setDepth(Math.round(lane.y));
    this.bikes.push(bike);

    if (kind === 'tiny') {
      floatText(this, GAME_WIDTH / 2, lane.y - 130, 'BICI MINÚSCULA DETECTADA', {
        color: PAL.amber,
        size: 22,
        title: true
      });
    }
  }

  private updateBikes(time: number, delta: number): void {
    for (let i = this.bikes.length - 1; i >= 0; i--) {
      const bike = this.bikes[i];
      bike.update(time, delta);
      if (bike.x < -420 || bike.x > GAME_WIDTH + 420) {
        this.nearMisses.delete(bike);
        bike.destroy();
        this.bikes.splice(i, 1);
      }
    }
  }

  // -------------------------------------------------------------- movimiento

  private axis(negative: Phaser.Input.Keyboard.Key[], positive: Phaser.Input.Keyboard.Key[]): number {
    const n = negative.some((k) => k.isDown) ? 1 : 0;
    const p = positive.some((k) => k.isDown) ? 1 : 0;
    return p - n;
  }

  private updateMovement(dt: number): void {
    if (this.respawning > 0) {
      this.respawning -= dt;
      this.raton.setMotion(0);
      return;
    }

    let dx = this.keys ? this.axis(this.keys.left, this.keys.right) : 0;
    let dy = this.keys ? this.axis(this.keys.up, this.keys.down) : 0;
    if (this.touch) {
      const v = this.touch.vector;
      if (v.lengthSq() > 0.02) {
        dx = v.x;
        dy = v.y;
      }
    }

    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }

    const speed = SPEED * (Save.data.ratonMode ? 1.1 : 1);
    this.raton.x = clamp(this.raton.x + dx * speed * dt, 60, GAME_WIDTH - 60);
    this.raton.y = clamp(this.raton.y + dy * speed * dt, this.goalTop + 40, WORLD_H - 40);
    this.raton.setDepth(Math.round(this.raton.y) + 6);
    this.raton.setMotion(Math.min(1, Math.hypot(dx, dy)));

    if (dx < -0.2) this.raton.setFacing(-1);
    else if (dx > 0.2) this.raton.setFacing(1);

    if (!this.taughtMove && (Math.abs(dx) > 0 || Math.abs(dy) > 0)) {
      this.taughtMove = true;
      this.time.delayedCall(2600, () => {
        if (!this.finished && !this.taughtBark) {
          this.hint.show(
            this.tip(
              'ESPACIO · ladra para asustar a los ciclistas',
              '¡GUAU! · ladra para asustar a los ciclistas'
            ),
            4000
          );
        }
      });
    }
  }

  // ------------------------------------------------------------------ ladrido

  private updateBark(dt: number): void {
    if (this.barkCd > 0) this.barkCd -= dt;
    const pressed =
      (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.space)) ||
      this.touch?.justPressed('bark') === true;
    if (!pressed || this.barkCd > 0 || this.respawning > 0) return;

    this.barkCd = 1.35;
    this.taughtBark = true;
    this.hint.hide();
    this.raton.bark({ depth: 9000 });
    Run.bump('barks');
    this.chaosMeter = clamp(this.chaosMeter + 0.17, 0, 1);
    this.chaosBar.flashPulse();
    this.cameras.main.shake(90, 0.0022);

    let spooked = 0;
    const now = this.time.now;
    this.bikes.forEach((bike) => {
      if (Phaser.Math.Distance.Between(bike.x, bike.y, this.raton.x, this.raton.y) < 340) {
        bike.spook(now);
        spooked++;
      }
    });

    if (spooked > 0) {
      Run.bump('bikesBarked', spooked);
      const gained = Run.addChaos(CHAOS.GOOD_BARK, 2);
      this.hud.bump(true);
      floatText(this, this.raton.x, this.raton.y - 190, `+${gained} LADRIDO OPORTUNO`, {
        color: PAL.ok,
        size: 21,
        depth: 9000
      });
    }
  }

  // -------------------------------------------------------------------- pánico

  private updatePanic(dt: number): void {
    let closest = 9999;
    this.bikes.forEach((bike) => {
      const d = Math.hypot(bike.x - this.raton.x, (bike.y - this.raton.y) * 1.8);
      if (d < closest) closest = d;

      // Esquivar por poco tiene premio.
      if (d < 120 && !this.nearMisses.has(bike)) this.nearMisses.add(bike);
      else if (d > 300 && this.nearMisses.has(bike)) {
        this.nearMisses.delete(bike);
        Run.addChaos(CHAOS.BIKE_DODGED, 2);
        this.hud.bump(true);
      }
    });

    const threat = clamp(1 - (closest - 60) / 180, 0, 1);
    this.panic = clamp(this.panic + (threat * 2.2 - 0.75) * dt, 0, 1);

    if (this.panic > 0.55) {
      this.raton.setExpression('fear');
      this.raton.tremble(true);
      this.cameras.main.setZoom(1 + this.panic * 0.03);
    } else {
      this.raton.tremble(false);
      if (this.raton.currentExpression !== 'happy') {
        this.raton.setExpression(this.panic > 0.28 ? 'alert' : 'normal');
      }
      this.cameras.main.setZoom(1);
    }

    this.heartbeatCd -= dt;
    if (this.panic > 0.68 && this.heartbeatCd <= 0) {
      this.heartbeatCd = 0.85;
      Audio.heartbeat();
    }

    if (this.panic > 0.9 && chance(dt * 0.6)) {
      floatText(this, this.raton.x, this.raton.y - 210, pick(THOUGHTS.bikeSpotted), {
        color: PAL.danger,
        size: 19,
        depth: 9000
      });
    }
  }

  // ---------------------------------------------------------------- colisiones

  private checkCollisions(): void {
    if (this.respawning > 0) return;
    for (const bike of this.bikes) {
      if (Math.abs(bike.y - this.raton.y) > 52) continue;
      if (Math.abs(bike.x - this.raton.x) > bike.halfWidth * 0.72 + 24) continue;
      this.hitByBike(bike);
      return;
    }
  }

  private hitByBike(bike: Bicycle): void {
    this.lives--;
    Run.bump('bikeHits');
    Run.addChaos(CHAOS.CAUGHT, 2);
    this.hud.bump(false);
    this.respawning = 1.2;
    this.panic = 1;

    const icon = this.lifeIcons[this.lives];
    if (icon) {
      this.tweens.add({
        targets: icon,
        alpha: 0.2,
        scale: 0.3,
        angle: 40,
        duration: 300
      });
    }

    this.raton.recoilJump(bike.dir);
    Audio.thud();
    this.cameras.main.shake(320, 0.011);
    this.cameras.main.flash(160, 120, 40, 30);
    alertMark(this, this.raton.x + 50, this.raton.y - 200, '!', PAL.danger, 9000);

    const banner = this.add
      .text(GAME_WIDTH / 2, 300, 'DEMASIADAS RUEDAS', {
        fontFamily: FONT_TITLE,
        fontSize: '62px',
        color: css(PAL.danger),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 10
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9500)
      .setScale(0.5);
    this.tweens.add({ targets: banner, scale: 1, duration: 260, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: banner,
      alpha: 0,
      delay: 800,
      duration: 300,
      onComplete: () => banner.destroy()
    });

    if (this.lives <= 0) {
      this.lose();
      return;
    }

    this.time.delayedCall(900, () => {
      if (this.finished) return;
      this.raton.setPosition(GAME_WIDTH / 2, this.checkpointY);
      this.raton.setExpression('alert');
      puff(this, this.raton.x, this.raton.y, { count: 8, spread: 60 });
      this.cameras.main.flash(200, 240, 220, 190);
    });
  }

  // ------------------------------------------------------------------ progreso

  private checkProgress(): void {
    const y = this.raton.y;
    if (y < this.bestY) this.bestY = y;

    // Avanzar sin pararse encadena bonificación: premia arriesgar.
    if (y < this.advanceMark - LANE_H) {
      this.advanceMark -= LANE_H;
      const now = this.time.now;
      this.laneCombo = now - this.lastAdvanceAt < 3400 ? this.laneCombo + 1 : 1;
      this.lastAdvanceAt = now;
      if (this.laneCombo >= 2) {
        const gained = Run.addChaos(50 * this.laneCombo, 2);
        this.hud.bump(true);
        floatText(this, this.raton.x, this.raton.y - 170, `¡SIN PARAR! x${this.laneCombo}  +${gained}`, {
          color: PAL.amber,
          size: 20,
          title: true,
          depth: 9000
        });
      }
    }

    this.safeBands.forEach((band, i) => {
      if (y > band[0] && y < band[1] && i > this.checkpointIndex) {
        this.checkpointIndex = i;
        this.checkpointY = (band[0] + band[1]) / 2;
        const gained = Run.addChaos(CHAOS.CHECKPOINT, 2);
        this.hud.bump(true);
        Audio.bell();
        sparkles(this, this.raton.x, this.raton.y - 60, { count: 10, depth: 9000 });
        floatText(this, this.raton.x, this.raton.y - 190, `ZONA SEGURA  +${gained}`, {
          color: PAL.ok,
          size: 22,
          title: true,
          depth: 9000
        });
      }
    });

    if (y <= this.goalTop + 76) this.win();
  }

  // ---------------------------------------------------------------- desenlace

  private win(): void {
    if (this.finished) return;
    this.finished = true;
    Run.addTime(this.elapsed * 1000);
    this.raton.setMotion(0).tremble(false);
    this.raton.setExpression('happy');
    this.cameras.main.stopFollow();

    const dodgeBonus = Math.max(0, 3 - Run.s.bikeHits) * 120;
    const speedBonus = Math.round(clamp((110 - this.elapsed) / 80, 0, 1) * CHAOS.SPEED_BONUS_MAX);
    Run.addChaos(CHAOS.MISSION_COMPLETE, 2);
    if (dodgeBonus) Run.addChaos(dodgeBonus, 2);
    if (speedBonus) Run.addChaos(speedBonus, 2);
    Run.completeLevel(2);

    Audio.success();
    this.cameras.main.zoomTo(1.25, 900, 'Quad.easeOut');
    this.cameras.main.pan(this.raton.x, this.raton.y - 40, 900, 'Quad.easeOut');

    // Se gira hacia la carretera… y ladra igualmente.
    this.time.delayedCall(700, () => {
      this.raton.setFacing(1).setExpression('alert');
      const lane = this.lanes[this.lanes.length - 1];
      const farBike = new Bicycle(this, GAME_WIDTH + 200, lane.y, 'road', -1);
      farBike.setDepth(400);
      this.bikes.push(farBike);
    });

    this.time.delayedCall(1500, () => {
      this.raton.bark({ power: 1.4, depth: 9000 });
      this.cameras.main.shake(140, 0.004);
    });

    this.time.delayedCall(2000, () => {
      this.add
        .text(GAME_WIDTH / 2, 250, 'CARRETERA CONQUISTADA', {
          fontFamily: FONT_TITLE,
          fontSize: '64px',
          color: css(PAL.cream),
          fontStyle: '800',
          stroke: css(PAL.ink),
          strokeThickness: 11,
          align: 'center',
          wordWrap: { width: 1100 }
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9500);
      this.add
        .text(GAME_WIDTH / 2, 320, 'Las bicicletas siguen siendo sospechosas.', {
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
      sparkles(this, this.raton.x, this.raton.y - 100, { count: 14, depth: 9000 });
    });

    this.time.delayedCall(3800, () => {
      Transition.to(this, SCENES.RESULT, {
        level: 2,
        success: true,
        title: 'CARRETERA CONQUISTADA',
        subtitle: 'Las bicicletas siguen siendo sospechosas.',
        bonuses: [
          ['Misión completada', CHAOS.MISSION_COMPLETE],
          ['Rapidez', speedBonus],
          ['Ruedas esquivadas', dodgeBonus],
          [`Ladridos oportunos (${Run.s.bikesBarked})`, 0]
        ],
        notes: [
          `Tiempo: ${this.elapsed.toFixed(1)} s`,
          `Atropellos leves y sin consecuencias: ${Run.s.bikeHits}`
        ]
      });
    });
  }

  private lose(): void {
    if (this.finished) return;
    this.finished = true;
    Run.addTime(this.elapsed * 1000);
    this.raton.setExpression('caught');
    this.raton.freeze(true);
    Audio.fail();
    this.cameras.main.shake(400, 0.01);

    this.time.delayedCall(1300, () => {
      Transition.to(this, SCENES.RESULT, {
        level: 2,
        success: false,
        title: 'DEMASIADAS RUEDAS',
        subtitle: 'Ratón se retira a una distancia prudencial. Estratégicamente.',
        notes: [
          `Distancia recorrida: ${Math.round(clamp((WORLD_H - this.bestY) / (WORLD_H - this.goalTop), 0, 1) * 100)}%`,
          'Las bicicletas siguen ahí fuera.'
        ]
      });
    });
  }
}
