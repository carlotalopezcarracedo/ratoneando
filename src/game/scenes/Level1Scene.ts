import Phaser from 'phaser';
import {
  CHAOS,
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  LEVELS,
  SCENES,
  THOUGHTS
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { clamp, damp, pick, rand } from '../utils/helpers';
import { Raton } from '../entities/Raton';
import { Human } from '../entities/Human';
import { MissionHUD } from '../ui/MissionHUD';
import { ProgressBar } from '../ui/ProgressBar';
import { Hint } from '../ui/Hint';
import { TouchControls, needsTouch } from '../ui/TouchControls';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';
import { Transition } from '../systems/Transition';
import { alertMark, floatText, puff, sparkles } from '../art/FX';
import {
  makeBookshelf,
  makeChair,
  makeDesk,
  makeDogBed,
  makeLamp,
  makeMonitor,
  makePoster,
  makeRug,
  makeWindow
} from '../art/props';
import { drawPanel } from '../ui/Panel';

type OwnerState = 'work' | 'phone' | 'turning' | 'watch' | 'stretch';

const GROUND = 600;
const RATON_X = 958;
const OWNER_X = 626;

const STATUS: Record<OwnerState, { text: string; color: number }> = {
  work: { text: 'AHORA', color: PAL.ok },
  phone: { text: 'AHORA', color: PAL.ok },
  turning: { text: '· · ·', color: PAL.amber },
  watch: { text: '¡QUIETO!', color: PAL.danger },
  stretch: { text: '· · ·', color: PAL.amber }
};

export class Level1Scene extends Phaser.Scene {
  private raton!: Raton;
  private owner!: Human;
  private hud!: MissionHUD;
  private hint!: Hint;
  private touch?: TouchControls;

  private needBar!: ProgressBar;
  private lickBar!: ProgressBar;
  private suspicionBar!: ProgressBar;
  private statusPanel!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;
  private cone!: Phaser.GameObjects.Graphics;
  private fly!: Phaser.GameObjects.Container;

  private need = 0.12;
  private lick = 0;
  private suspicion = 0;
  private ownerState: OwnerState = 'work';
  private stateTimer = 2.4;
  private intensity = 0;
  private elapsed = 0;
  private idleTimer = 0;
  private stunned = 0;
  private disguiseCd = 0;
  private forcedLick = 0;
  private segment = 0;
  private caughtCount = 0;
  private cleanLicks = 0;
  private finished = false;
  private taughtLick = false;
  private taughtHide = false;
  private staredAtCamera = false;
  private mustRelease = false;

  private keys!: {
    space: Phaser.Input.Keyboard.Key;
    e: Phaser.Input.Keyboard.Key;
  };

  constructor() {
    super(SCENES.LEVEL1);
  }

  create(): void {
    this.resetState();
    this.buildRoom();
    this.buildCast();
    this.buildHud();
    this.bindInput();

    Audio.playMusic('tension');
    Transition.reveal(this);

    this.hint.show(
      this.tip(
        'Mantén ESPACIO para lamerte la pata izquierda',
        'Mantén pulsado LAMER para lamerte la pata izquierda'
      )
    );
    this.cameras.main.setZoom(1.04);
    this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 900, ease: 'Quad.easeOut' });
  }

  private resetState(): void {
    this.need = 0.12;
    this.lick = 0;
    this.suspicion = 0;
    this.ownerState = 'work';
    this.stateTimer = 2.6;
    this.intensity = 0;
    this.elapsed = 0;
    this.idleTimer = 0;
    this.stunned = 0;
    this.disguiseCd = 0;
    this.forcedLick = 0;
    this.segment = 0;
    this.caughtCount = 0;
    this.cleanLicks = 0;
    this.finished = false;
    this.taughtLick = false;
    this.taughtHide = false;
    this.staredAtCamera = false;
    this.mustRelease = false;
  }

  // ------------------------------------------------------------------ escena

  private buildRoom(): void {
    const g = this.add.graphics().setDepth(0);
    g.fillGradientStyle(PAL.wall, PAL.wall, PAL.wallDeep, PAL.wallShade, 1);
    g.fillRect(0, 0, GAME_WIDTH, 520);
    g.fillStyle(0xfff0cf, 0.15);
    g.fillTriangle(150, 70, 430, 70, 760, 520);
    g.fillStyle(Phaser.Display.Color.IntegerToColor(PAL.wallShade).darken(18).color, 1);
    g.fillRect(0, 494, GAME_WIDTH, 26);
    g.fillStyle(PAL.cream, 0.22);
    g.fillRect(0, 494, GAME_WIDTH, 5);

    g.fillStyle(PAL.floor, 1);
    g.fillRect(0, 520, GAME_WIDTH, GAME_HEIGHT - 520);
    for (let i = 0; i < 8; i++) {
      g.lineStyle(2, PAL.floorDark, 0.4);
      g.lineBetween(0, 540 + i * 26, GAME_WIDTH, 540 + i * 26);
    }
    g.fillStyle(0x000000, 0.18);
    g.fillRect(0, 520, GAME_WIDTH, 20);

    this.add.existing(makeWindow(this, 210, 90)).setDepth(1);
    this.add.existing(makePoster(this, 760, 150, 'NO TOCAR\n(ES SUYO)')).setDepth(1);
    this.add.existing(makeBookshelf(this, 1120, 600)).setDepth(2);
    this.add.existing(makeLamp(this, 1252, 600)).setDepth(2);
    this.add.existing(makeRug(this, 880, 648, 540, 116)).setDepth(3);
    this.add.existing(makeDogBed(this, RATON_X, 636)).setDepth(4);

    this.add.existing(makeChair(this, 790, 600)).setDepth(12);
    this.add.existing(makeMonitor(this, 268, 410)).setDepth(45);
    this.add.existing(makeDesk(this, 322, 610)).setDepth(44);

    this.buildFly();
  }

  private buildFly(): void {
    this.fly = this.add.container(600, 300).setDepth(80).setVisible(false);
    const body = this.add.ellipse(0, 0, 10, 7, 0x241d1a);
    const wing = this.add.ellipse(-2, -4, 9, 5, 0xd8ecf1, 0.65);
    this.fly.add([wing, body]);
    this.tweens.add({ targets: wing, scaleX: 0.4, duration: 60, yoyo: true, repeat: -1 });
  }

  private buildCast(): void {
    this.owner = new Human(this, OWNER_X, GROUND);
    this.owner.setDepth(30);
    this.owner.setFacing(-1).setPose('stand').setActivity('typing').setGaze(-1);

    this.cone = this.add.graphics().setDepth(35);

    this.raton = new Raton(this, RATON_X, GROUND + 14);
    this.raton.setDepth(50);
    this.raton.setPose('sit').setExpression('normal');
    this.raton.lookAt(this.owner.x, GROUND - 160);
  }

  private buildHud(): void {
    const info = LEVELS[0];
    this.hud = new MissionHUD(this, info.code, info.title);

    // Con controles táctiles las barras se van arriba: abajo las tapan el
    // joystick y los botones, que ocupan las dos esquinas inferiores.
    const touch = needsTouch(this);

    this.needBar = new ProgressBar(this, 40, touch ? 116 : GAME_HEIGHT - 118, {
      width: 300,
      label: 'NECESIDAD DE LAMER',
      color: PAL.pop,
      warnColor: PAL.amber,
      warnAt: 0.8
    }).setScrollFactor(0).setDepth(6000);

    this.lickBar = new ProgressBar(this, 40, touch ? 172 : GAME_HEIGHT - 62, {
      width: 300,
      label: 'PROGRESO DE LAMIDO',
      color: PAL.ok,
      warnColor: PAL.ok,
      warnAt: 2
    }).setScrollFactor(0).setDepth(6000);

    this.suspicionBar = new ProgressBar(this, GAME_WIDTH - 340, touch ? 116 : GAME_HEIGHT - 62, {
      width: 300,
      label: 'MEDIDOR DE SOSPECHA',
      color: PAL.amber,
      warnColor: PAL.danger,
      warnAt: 0.62,
      align: 'right'
    }).setScrollFactor(0).setDepth(6000);

    this.statusPanel = this.add.container(OWNER_X, 196).setDepth(6050);
    const g = this.add.graphics();
    drawPanel(g, -84, -24, 168, 48, { radius: 24, fillAlpha: 0.9, strokeWidth: 3 });
    this.statusText = this.add
      .text(0, 0, 'AHORA', {
        fontFamily: FONT_TITLE,
        fontSize: '24px',
        color: css(PAL.ok),
        fontStyle: '800'
      })
      .setOrigin(0.5);
    this.statusPanel.add([g, this.statusText]);

    this.hint = new Hint(this, touch ? 240 : 128);

    if (touch) {
      this.touch = new TouchControls(this, {
        stick: false,
        // Sin joystick, los botones van a la izquierda: a la derecha taparían
        // a Ratón, que es justo lo que hay que mirar.
        buttonSide: 'left',
        buttons: [
          { key: 'lick', label: 'LAMER', color: PAL.ok },
          { key: 'hide', label: 'DISIMULAR', color: PAL.pop }
        ]
      });
    }
  }

  private bindInput(): void {
    const kb = this.input.keyboard;
    if (!kb) return;
    this.keys = {
      space: kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      e: kb.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };
    kb.on('keydown-M', () => Audio.toggleMute());
    kb.on('keydown-ESC', () => this.pauseGame());
    // Reintento inmediato: en un juego de intentos cortos, volver al menú
    // de pausa para repetir es un peaje innecesario.
    kb.on('keydown-R', () => {
      if (!this.finished) this.scene.restart();
    });
    kb.on('keydown-P', () => this.pauseGame());
    this.input.keyboard?.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
  }

  private pauseGame(): void {
    if (this.finished) return;
    this.scene.pause();
    this.scene.launch(SCENES.PAUSE, { from: SCENES.LEVEL1 });
  }

  /** Texto de tutorial según el mando activo. */
  private tip(desktop: string, touch: string): string {
    return this.touch ? touch : desktop;
  }


  // ------------------------------------------------------------------- ciclo

  override update(_time: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.raton.tick(delta);
    this.owner.tick(delta);
    this.hud.tick(delta);
    this.needBar.tick(delta);
    this.lickBar.tick(delta);
    this.suspicionBar.tick(delta);

    if (this.finished) {
      this.touch?.endFrame();
      return;
    }

    this.elapsed += dt;
    this.intensity = clamp(this.elapsed / 55, 0, 1);
    this.updateOwner(dt);
    this.updatePlayer(dt);
    this.updateMeters(dt);
    this.updateFeedback(dt);
    this.touch?.endFrame();
  }

  // ------------------------------------------------------------------- dueño

  private updateOwner(dt: number): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) this.nextOwnerState();

    const status = STATUS[this.ownerState];
    this.statusText.setText(status.text).setColor(css(status.color));
    this.statusPanel.x = damp(this.statusPanel.x, this.owner.x, 8, dt);
    this.statusPanel.y = damp(this.statusPanel.y, this.ownerState === 'watch' ? 184 : 196, 8, dt);

    this.drawCone();
  }

  private nextOwnerState(): void {
    const i = this.intensity;
    switch (this.ownerState) {
      case 'work':
      case 'phone': {
        const roll = Math.random();
        if (roll < 0.62) this.setOwnerState('turning', rand(0.85, 1.05) - i * 0.35);
        else if (roll < 0.82) this.setOwnerState('phone', rand(1.6, 2.6));
        else this.setOwnerState('stretch', rand(2.2, 3.0));
        break;
      }
      case 'turning':
        this.setOwnerState('watch', rand(1.2, 1.9) + i * 0.5);
        break;
      case 'watch':
        this.setOwnerState(Math.random() < 0.6 ? 'work' : 'phone', rand(1.8, 3.2) - i * 0.8);
        break;
      default:
        this.setOwnerState('work', rand(2.4, 3.8) - i * 0.9);
    }
  }

  private setOwnerState(state: OwnerState, duration: number): void {
    this.ownerState = state;
    this.stateTimer = Math.max(0.5, duration);
    if (state !== 'stretch') {
      this.tweens.killTweensOf(this.owner);
      this.owner.x = OWNER_X;
    }

    switch (state) {
      case 'work':
        this.owner.setActivity('typing').setGaze(-1);
        this.owner.lookOffset(-0.6, 0.2);
        break;
      case 'phone':
        this.owner.setActivity('phone').setGaze(-1, 0.06);
        this.owner.lookOffset(-0.4, 0.6);
        break;
      case 'turning':
        this.owner.setActivity('idle');
        this.owner.lookOffset(0.7, 0);
        Audio.suspicion();
        alertMark(this, this.owner.x + 46, 214, '···', PAL.amber);
        // Ratón lo oye antes de verlo: las orejas se ponen tiesas.
        this.raton.perkEars(this.stateTimer + 0.3);
        break;
      case 'watch':
        this.owner.setGaze(1);
        this.owner.lookOffset(0.8, 0.1);
        Audio.alert();
        break;
      case 'stretch':
        this.owner.setActivity('searching').setGaze(-1);
        this.tweens.add({
          targets: this.owner,
          x: OWNER_X + 90,
          duration: 900,
          yoyo: true,
          hold: 500,
          ease: 'Sine.easeInOut'
        });
        this.time.delayedCall(700, () => {
          if (this.ownerState === 'stretch') this.owner.setGaze(1, 0.04);
        });
        this.time.delayedCall(1500, () => {
          if (this.ownerState === 'stretch') this.owner.setGaze(-1);
        });
        break;
    }
  }

  private get ownerIsLooking(): boolean {
    return this.ownerState === 'watch';
  }

  private drawCone(): void {
    const g = this.cone;
    g.clear();
    if (this.ownerState === 'work' || this.ownerState === 'phone') return;

    const eye = this.owner.eyeWorld();
    const strong = this.ownerState === 'watch';
    const range = strong ? 560 : 330;
    const spread = strong ? 0.3 : 0.2;
    const alpha = strong ? 0.24 : 0.12;
    const color = strong ? PAL.danger : PAL.amber;

    // Cuando vigila, el cono apunta directamente a Ratón: no hay ambigüedad.
    const dir = strong
      ? Math.atan2(this.raton.y - 120 - eye.y, this.raton.x - eye.x)
      : this.owner.gaze === 1
        ? 0
        : Math.PI;
    const p1 = { x: eye.x + Math.cos(dir - spread) * range, y: eye.y + Math.sin(dir - spread) * range };
    const p2 = { x: eye.x + Math.cos(dir + spread) * range, y: eye.y + Math.sin(dir + spread) * range };

    g.fillStyle(color, alpha);
    g.fillTriangle(eye.x, eye.y, p1.x, p1.y, p2.x, p2.y);
    g.lineStyle(2, color, alpha + 0.2);
    g.strokeTriangle(eye.x, eye.y, p1.x, p1.y, p2.x, p2.y);
  }

  // ---------------------------------------------------------------- jugador

  private wantsLick(): boolean {
    if (this.forcedLick > 0) return true;
    if (this.stunned > 0) return false;
    const held = this.keys?.space.isDown === true || this.touch?.isDown('lick') === true;
    // Tras un susto hay que soltar y volver a pulsar: nada de castigos en bucle.
    if (this.mustRelease) {
      if (!held) this.mustRelease = false;
      return false;
    }
    return held;
  }

  private wantsDisguise(): boolean {
    return (
      (this.keys && Phaser.Input.Keyboard.JustDown(this.keys.e)) || this.touch?.justPressed('hide') === true
    );
  }

  private updatePlayer(dt: number): void {
    if (this.stunned > 0) {
      this.stunned -= dt;
      if (this.stunned <= 0) {
        this.raton.freeze(false);
        this.raton.setExpression('alert');
      }
      return;
    }

    if (this.forcedLick > 0) this.forcedLick -= dt;

    const wants = this.wantsLick();
    if (wants && !this.raton.isLicking) {
      this.raton.startLick();
      this.raton.setExpression('obsessed');
      this.idleTimer = 0;
      if (!this.taughtLick) {
        this.taughtLick = true;
        this.hint.hide();
        this.time.delayedCall(1400, () => {
          if (!this.finished && !this.taughtHide) {
            this.taughtHide = true;
            this.hint.show(
              this.tip(
                'Pero no dejes que te vea. Suelta cuando aparezca «· · ·»',
                'Pero no dejes que te vea. Suelta cuando aparezca «· · ·»'
              ),
              4200
            );
          }
        });
      }
    } else if (!wants && this.raton.isLicking) {
      this.endLickSegment();
    }

    // Lamer mientras te miran = te pillan (justo al girarse o si empiezas tarde).
    if (this.raton.isLicking && this.ownerIsLooking) {
      this.checkBusted();
      return;
    }

    if (this.raton.isLicking) {
      this.lick = clamp(this.lick + dt * 0.24, 0, 1);
      this.need = clamp(this.need - dt * 0.34, 0, 1);
      this.segment += dt;
      if (this.ownerState === 'turning') this.suspicion = clamp(this.suspicion + dt * 0.07, 0, 1);
      if (this.lick >= 1) this.win();
    } else {
      this.raton.setExpression(this.ownerIsLooking ? 'alert' : this.need > 0.75 ? 'obsessed' : 'normal');
    }

    if (this.wantsDisguise() && this.disguiseCd <= 0 && !this.raton.isLicking) {
      this.disguise();
    }
    if (this.disguiseCd > 0) this.disguiseCd -= dt;
  }

  private endLickSegment(): void {
    this.raton.stopLick();
    if (this.segment > 0.55) {
      this.cleanLicks++;
      Run.bump('clandestineLicks');
      // Cuanto más aguantas el lametón sin que te vean, más multiplica.
      const streak = Math.min(4, 1 + Math.floor(this.segment / 1.3));
      const gained = Run.addChaos(CHAOS.CLANDESTINE_LICK * streak, 1);
      this.hud.bump(true);
      const paw = this.raton.leftPawWorld();
      const label = streak > 1 ? `+${gained}  LAMIDO CLANDESTINO x${streak}` : `+${gained} LAMIDO CLANDESTINO`;
      floatText(this, paw.x, paw.y - 90, label, {
        color: streak > 2 ? PAL.amber : PAL.ok,
        size: 20 + streak * 2
      });
      sparkles(this, paw.x, paw.y - 40, { count: 4 + streak * 2, radius: 40, color: PAL.ok });
      if (streak >= 3) Audio.bell();
    }
    this.segment = 0;
  }

  private disguise(): void {
    this.disguiseCd = 4.2;
    this.suspicion = clamp(this.suspicion - 0.14, 0, 1);
    this.suspicionBar.flashPulse();
    Audio.hover();

    const roll = Math.random();
    const head = this.raton.headWorld();
    if (roll < 0.45) {
      this.showFly();
      floatText(this, head.x, head.y - 10, 'mirando una mosca', { color: PAL.creamDim, size: 17 });
    } else if (roll < 0.8) {
      this.raton.setExpression('sleepy');
      floatText(this, head.x, head.y - 10, '*bosteza*', { color: PAL.creamDim, size: 19 });
      this.time.delayedCall(900, () => this.raton.setExpression('normal'));
    } else {
      floatText(this, head.x, head.y - 10, pick(THOUGHTS.idle), { color: PAL.creamDim, size: 17 });
    }
  }

  private showFly(): void {
    this.fly.setVisible(true).setPosition(rand(560, 820), rand(220, 360));
    this.raton.lookAt(this.fly.x, this.fly.y);
    this.tweens.add({
      targets: this.fly,
      x: rand(700, 1000),
      y: rand(180, 400),
      duration: 1400,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.raton.lookAt(this.fly.x, this.fly.y),
      onComplete: () => {
        this.fly.setVisible(false);
        this.raton.lookAt(this.owner.x, GROUND - 160);
      }
    });
  }

  // ------------------------------------------------------------------ medidores

  private updateMeters(dt: number): void {
    if (!this.raton.isLicking) {
      this.need = clamp(this.need + dt * (0.052 + this.intensity * 0.02), 0, 1);
      if (this.need >= 1 && this.forcedLick <= 0 && this.stunned <= 0) {
        this.forcedLick = 1.1;
        const head = this.raton.headWorld();
        floatText(this, head.x, head.y, 'NO PUEDO MÁS', { color: PAL.danger, size: 22, title: true });
      }
    }

    const watched = this.ownerIsLooking;
    if (!watched && !this.raton.isLicking) {
      this.suspicion = clamp(this.suspicion - dt * 0.075, 0, 1);
    }

    if (this.suspicion >= 1) this.lose();

    this.needBar.setValue(this.need);
    this.lickBar.setValue(this.lick);
    this.suspicionBar.setValue(this.suspicion);
  }

  /** El dueño acaba de girarse: ¿estaba Ratón haciendo algo? */
  private checkBusted(): void {
    if (this.finished) return;
    if (!this.raton.isLicking && this.forcedLick <= 0) {
      this.raton.setExpression('alert');
      return;
    }

    this.caughtCount++;
    Run.bump('caught');
    Run.addChaos(CHAOS.CAUGHT, 1);
    this.hud.bump(false);

    this.suspicion = clamp(this.suspicion + 0.3, 0, 1);
    this.suspicionBar.flashPulse();
    this.segment = 0;
    this.forcedLick = 0;
    this.stunned = 1.15;
    this.mustRelease = true;

    this.raton.abortLick();
    this.raton.setExpression('caught');
    this.raton.freeze(true);
    this.owner.setActivity('startled');

    Audio.alert();
    this.cameras.main.shake(220, 0.006);
    this.cameras.main.flash(120, 90, 40, 30);

    const head = this.raton.headWorld();
    alertMark(this, head.x + 40, head.y, '!', PAL.danger);
    floatText(this, head.x, head.y - 30, pick(THOUGHTS.caught), {
      color: PAL.danger,
      size: 24,
      title: true
    });
    puff(this, this.raton.x, this.raton.y, { count: 6, color: PAL.creamDim });

    this.time.delayedCall(500, () => {
      if (!this.finished) this.owner.setActivity('idle');
    });

    if (!this.taughtHide) {
      this.taughtHide = true;
      this.hint.show(this.tip('E · DISIMULAR baja la sospecha', 'DISIMULAR baja la sospecha'), 4000);
    }
  }

  // ------------------------------------------------------------ realimentación

  private updateFeedback(dt: number): void {
    // Easter egg 4: quince segundos sin hacer nada.
    if (!this.raton.isLicking && this.stunned <= 0) {
      this.idleTimer += dt;
      if (this.idleTimer > 15 && !this.staredAtCamera) {
        this.staredAtCamera = true;
        this.raton.lookAtCamera(3.4);
        floatText(this, this.raton.x, this.raton.y - 230, '¿…y tú qué miras?', {
          color: PAL.creamDim,
          size: 20
        });
        this.time.delayedCall(6000, () => {
          this.staredAtCamera = false;
          this.idleTimer = 0;
        });
      }
    } else {
      this.idleTimer = 0;
    }

    if (!this.raton.isLicking && this.fly.visible === false) {
      this.raton.lookAt(this.owner.x, GROUND - 170);
    }

    this.raton.tremble(this.suspicion > 0.72);
  }

  // ---------------------------------------------------------------- desenlace

  private win(): void {
    if (this.finished) return;
    this.finished = true;
    this.raton.stopLick();
    this.raton.setExpression('happy');
    Run.addTime(this.elapsed * 1000);

    this.time.timeScale = 0.35;
    this.tweens.timeScale = 0.35;
    this.cameras.main.zoomTo(1.35, 700, 'Quad.easeOut');
    this.cameras.main.pan(this.raton.x, this.raton.y - 120, 700, 'Quad.easeOut');
    Audio.success();

    const big = this.add
      .text(GAME_WIDTH / 2, 300, 'PATA LAMIDA', {
        fontFamily: FONT_TITLE,
        fontSize: '82px',
        color: css(PAL.cream),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 12
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(9000)
      .setScale(0.4);
    this.tweens.add({ targets: big, scale: 1, duration: 500, ease: 'Back.easeOut' });

    this.time.delayedCall(500, () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
      this.add
        .text(GAME_WIDTH / 2, 378, 'Nadie ha visto nada.', {
          fontFamily: FONT_UI,
          fontSize: '28px',
          color: css(PAL.amber),
          fontStyle: '800',
          stroke: css(PAL.ink),
          strokeThickness: 6
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(9000);
      this.raton.celebrate();
    });

    const speedBonus = Math.round(clamp((50 - this.elapsed) / 38, 0, 1) * CHAOS.SPEED_BONUS_MAX);
    const stealthBonus = Math.max(0, 3 - this.caughtCount) * 100;
    Run.addChaos(CHAOS.MISSION_COMPLETE, 1);
    if (speedBonus > 0) Run.addChaos(speedBonus, 1);
    if (stealthBonus > 0) Run.addChaos(stealthBonus, 1);
    Run.completeLevel(1);

    this.time.delayedCall(2600, () => {
      Transition.to(this, SCENES.RESULT, {
        level: 1,
        success: true,
        title: 'PATA LAMIDA',
        subtitle: 'Nadie ha visto nada.',
        bonuses: [
          ['Misión completada', CHAOS.MISSION_COMPLETE],
          ['Rapidez', speedBonus],
          ['Discreción', stealthBonus],
          [`Lamidos clandestinos (${this.cleanLicks})`, this.cleanLicks * CHAOS.CLANDESTINE_LICK],
          ['Veces descubierto', this.caughtCount * CHAOS.CAUGHT]
        ],
        notes: [`Tiempo: ${this.elapsed.toFixed(1)} s`, 'La pata derecha sigue sin lamer. Otro día.']
      });
    });
  }

  private lose(): void {
    if (this.finished) return;
    this.finished = true;
    Run.addTime(this.elapsed * 1000);
    this.raton.abortLick();
    this.raton.setExpression('caught');
    this.raton.freeze(true);
    this.owner.setGaze(1).setActivity('startled');
    this.cameras.main.shake(320, 0.008);
    Audio.fail();

    this.time.delayedCall(1200, () => {
      Transition.to(this, SCENES.RESULT, {
        level: 1,
        success: false,
        title: 'TE HAN PILLADO',
        subtitle: 'Ratón, sabemos perfectamente lo que estabas haciendo.',
        notes: [
          `Progreso de lamido alcanzado: ${Math.round(this.lick * 100)}%`,
          'Ratón niega todas las acusaciones.'
        ]
      });
    });
  }
}
