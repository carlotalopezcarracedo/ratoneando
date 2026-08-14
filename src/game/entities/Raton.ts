import Phaser from 'phaser';
import { Part } from '../art/Part';
import { Eye } from './Eye';
import { PAL } from '../utils/palette';
import { clamp, damp, rand } from '../utils/helpers';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { barkWave, floatText, puff } from '../art/FX';

export type RatonExpression =
  | 'normal'
  | 'alert'
  | 'fear'
  | 'obsessed'
  | 'caught'
  | 'happy'
  | 'sleepy';

export type RatonPose = 'stand' | 'sit' | 'lie';

interface Look {
  eyeOpen: number;
  lid: number;
  dilation: number;
  /** Rotación de cada oreja. Negativa = la punta cae hacia delante. */
  earNear: number;
  earFar: number;
  crouch: number;
  wagSpeed: number;
  wagAmp: number;
  headTilt: number;
}

/**
 * Las orejas de Ratón se abren mucho hacia los lados (es su rasgo más
 * reconocible) y sólo se enderezan cuando está alerta. Cada expresión mueve
 * orejas, ojos, cola y altura del cuerpo a la vez.
 */
const LOOKS: Record<RatonExpression, Look> = {
  normal:   { eyeOpen: 1,    lid: 1,    dilation: 1,    earNear: -0.54, earFar: 0.50, crouch:  0, wagSpeed: 1.6, wagAmp: 0.16, headTilt:  0 },
  alert:    { eyeOpen: 1.12, lid: 1,    dilation: 1.14, earNear: -0.28, earFar: 0.24, crouch: -4, wagSpeed: 2.6, wagAmp: 0.10, headTilt: -0.06 },
  fear:     { eyeOpen: 1.34, lid: 1,    dilation: 1.5,  earNear:  0.22, earFar: 0.92, crouch: 10, wagSpeed: 0.6, wagAmp: 0.05, headTilt:  0.12 },
  obsessed: { eyeOpen: 1.16, lid: 1,    dilation: 0.6,  earNear: -0.62, earFar: 0.38, crouch:  2, wagSpeed: 8.5, wagAmp: 0.34, headTilt: -0.12 },
  caught:   { eyeOpen: 1.45, lid: 1,    dilation: 0.48, earNear: -0.06, earFar: 0.74, crouch:  5, wagSpeed: 0.2, wagAmp: 0.02, headTilt:  0.07 },
  happy:    { eyeOpen: 1.06, lid: 0.34, dilation: 1,    earNear: -0.66, earFar: 0.58, crouch: -3, wagSpeed: 9.5, wagAmp: 0.42, headTilt: -0.09 },
  sleepy:   { eyeOpen: 0.95, lid: 0.3,  dilation: 0.9,  earNear: -0.16, earFar: 0.72, crouch:  6, wagSpeed: 0.8, wagAmp: 0.07, headTilt:  0.13 }
};

/** El cuello del torso sube por delante; la cabeza se apoya justo encima. */
const HEAD_X = -122;
const HEAD_Y = -190;
const RIG_SCALE = 0.44;
const FAR_TINT = 0x8a7f7a;

/** Hocico en coordenadas locales de la cabeza (bocadillos y ondas de ladrido). */
const MUZZLE = { x: -62, y: 6 };

/** Pose de lamido de la pata delantera IZQUIERDA. */
const LICK = { leg: 1.67, legScale: 1.05, headRot: -0.5, headDX: 10, headDY: 26 };

const POSE_OFFSETS: Record<RatonPose, { rig: number; torso: number; head: number; headX: number }> = {
  stand: { rig: 0, torso: -89, head: HEAD_Y, headX: HEAD_X },
  sit: { rig: 6, torso: -80, head: HEAD_Y - 16, headX: HEAD_X + 14 },
  lie: { rig: 40, torso: -60, head: HEAD_Y + 62, headX: HEAD_X - 14 }
};

/**
 * Ratón. Rig por capas: cola, patas, torso (con cuello) y cabeza (orejas +
 * ojos + boca). Mira a la IZQUIERDA por defecto, de modo que el flanco visible
 * es el izquierdo y la pata delantera **izquierda** queda en primer plano: ese
 * es el chiste del primer nivel.
 */
export class Raton extends Phaser.GameObjects.Container {
  /** Desplazamientos de salto/retroceso; los animan los tweens. */
  hopX = 0;
  hopY = 0;

  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  private readonly torso: Part;
  private readonly tailPart: Part;
  private readonly legFN: Part; // delantera IZQUIERDA (cercana) — la protagonista
  private readonly legFF: Part;
  private readonly legBN: Part;
  private readonly legBF: Part;

  private readonly headNode: Phaser.GameObjects.Container;
  private readonly earNear: Part;
  private readonly earFar: Part;
  private readonly eyeNear: Eye;
  private readonly eyeFar: Eye;
  private readonly mouthShape: Phaser.GameObjects.Ellipse;
  private readonly tonguePart: Part;
  private readonly nutPart: Part;

  private expression: RatonExpression = 'normal';
  private look: Look = LOOKS.normal;
  private pose: RatonPose = 'stand';

  private facing: -1 | 1 = -1;
  private walkPhase = 0;
  private motion = 0;
  private clock = 0;
  private blinkAt = 1.6;
  private trembling = false;
  private frozen = false;
  private licking = false;
  private lickPhase = 0;
  private barkTimer = 0;
  private pawHold = 0;
  private carrying = false;
  private cameraStare = 0;
  private gaze = { x: -0.2, y: 0 };
  private stepTimer = 0;
  private perkTimer = 0;

  private earNow = { near: LOOKS.normal.earNear, far: LOOKS.normal.earFar };
  private crouchNow = 0;
  private rigNow = 0;
  private torsoNow = POSE_OFFSETS.stand.torso;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const earScale = Save.data.ratonMode ? 1.2 : 1;

    this.shadow = scene.add.ellipse(0, 6, 210, 42, 0x000000, 0.26);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(RIG_SCALE);
    this.add(this.rig);

    // ---- capas traseras
    this.tailPart = new Part(scene, 'raton-tail', 100, -96, 0.2, 0.94);
    this.legBF = new Part(scene, 'raton-leg-back', 52, -110, 0.7, 0.06).tint(FAR_TINT);
    this.legFF = new Part(scene, 'raton-leg-front', -58, -113, 0.5, 0.05).tint(FAR_TINT);

    // ---- torso con cuello
    this.torso = new Part(scene, 'raton-body', 0, POSE_OFFSETS.stand.torso, 0.5, 0.5);

    // ---- cabeza
    this.headNode = scene.add.container(HEAD_X, HEAD_Y);
    this.earFar = new Part(scene, 'raton-ear', 44, -50, 0.5, 0.94).tint(FAR_TINT);
    this.earFar.setScale(0.9 * earScale);
    const skull = new Part(scene, 'raton-head', 0, 0, 0.5, 0.5);
    this.earNear = new Part(scene, 'raton-ear', 0, -46, 0.5, 0.94);
    this.earNear.setScale(earScale);

    this.mouthShape = scene.add.ellipse(-40, 28, 34, 19, 0x2b1216).setVisible(false);
    this.mouthShape.setStrokeStyle(3, PAL.furDark, 1);
    this.tonguePart = new Part(scene, 'raton-tongue', -42, 30, 0.5, 0.1);
    this.tonguePart.setVisible(false);
    this.nutPart = new Part(scene, 'nut', -58, 26, 0.5, 0.5);
    this.nutPart.setVisible(false);

    this.eyeFar = new Eye(scene, 38, -22, 15);
    this.eyeFar.setScale(0.86);
    this.eyeNear = new Eye(scene, 8, -16, 18);

    this.headNode.add([
      this.earFar,
      skull,
      this.mouthShape,
      this.tonguePart,
      this.earNear,
      this.eyeFar,
      this.eyeNear,
      this.nutPart
    ]);

    // ---- capas delanteras
    this.legBN = new Part(scene, 'raton-leg-back', 72, -112, 0.7, 0.06);
    this.legFN = new Part(scene, 'raton-leg-front', -38, -116, 0.5, 0.05);

    this.rig.add([
      this.tailPart,
      this.legBF,
      this.legFF,
      this.torso,
      this.headNode,
      this.legBN,
      this.legFN
    ]);

    scene.add.existing(this);
  }

  // ------------------------------------------------------------------ estado

  get isLicking(): boolean {
    return this.licking;
  }

  get isFrozen(): boolean {
    return this.frozen;
  }

  get currentExpression(): RatonExpression {
    return this.expression;
  }

  get facingDir(): -1 | 1 {
    return this.facing;
  }

  get isCarrying(): boolean {
    return this.carrying;
  }

  /** -1 = mira a la izquierda (por defecto), 1 = mira a la derecha. */
  setFacing(dir: -1 | 1): this {
    if (this.facing === dir) return this;
    this.facing = dir;
    this.rig.scaleX = dir === -1 ? RIG_SCALE : -RIG_SCALE;
    return this;
  }

  setExpression(next: RatonExpression, instant = false): this {
    if (this.expression === next) return this;
    this.expression = next;
    this.look = LOOKS[next];
    if (instant) {
      this.earNow.near = this.look.earNear;
      this.earNow.far = this.look.earFar;
      this.crouchNow = this.look.crouch;
    }
    this.eyeNear.setDilation(this.look.dilation);
    this.eyeFar.setDilation(this.look.dilation);
    return this;
  }

  setPose(pose: RatonPose): this {
    if (this.pose === pose) return this;
    this.pose = pose;
    const t = this.scene.tweens;
    if (pose === 'sit') {
      t.add({ targets: [this.legBN, this.legBF], rotation: -0.72, scaleY: 0.7, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legFN, this.legFF], rotation: 0, scaleY: 1, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: this.torso, rotation: -0.14, duration: 280, ease: 'Quad.easeOut' });
    } else if (pose === 'lie') {
      t.add({ targets: [this.legBN, this.legBF], rotation: -1.24, scaleY: 0.56, duration: 340 });
      t.add({ targets: [this.legFN, this.legFF], rotation: -1.4, scaleY: 0.68, duration: 340 });
      t.add({ targets: this.torso, rotation: 0.05, duration: 340 });
    } else {
      t.add({
        targets: [this.legBN, this.legBF, this.legFN, this.legFF],
        rotation: 0,
        scaleY: 1,
        duration: 260
      });
      t.add({ targets: this.torso, rotation: 0, duration: 260 });
    }
    return this;
  }

  /** Velocidad normalizada 0..1 que alimenta el ciclo de caminar/correr. */
  setMotion(speed01: number): this {
    this.motion = clamp(speed01, 0, 1);
    return this;
  }

  tremble(on: boolean): this {
    this.trembling = on;
    return this;
  }

  /** Congela al perro en la pose actual (pillado in fraganti). */
  freeze(on: boolean): this {
    this.frozen = on;
    return this;
  }

  setCarryingNut(on: boolean): this {
    this.carrying = on;
    this.nutPart.setVisible(on);
    if (on) {
      this.nutPart.setScale(0);
      this.scene.tweens.add({ targets: this.nutPart, scale: 1, duration: 240, ease: 'Back.easeOut' });
    }
    return this;
  }

  /** Mirada hacia un punto del mundo. */
  lookAt(worldX: number, worldY: number): this {
    const dx = (worldX - this.x) * (this.facing === -1 ? -1 : 1);
    const dy = worldY - (this.y - 80);
    this.gaze.x = clamp(dx / 260, -1, 1);
    this.gaze.y = clamp(dy / 220, -0.8, 0.8);
    return this;
  }

  lookForward(): this {
    this.gaze.x = -0.35;
    this.gaze.y = 0;
    return this;
  }

  /** Easter egg: rompe la cuarta pared. */
  lookAtCamera(seconds = 2.6): this {
    this.cameraStare = seconds;
    return this;
  }

  /**
   * Orejas tiesas de golpe: Ratón ha oído algo. Se usa como aviso anticipado
   * para que el jugador aprenda a leer al perro, no al HUD.
   */
  perkEars(seconds = 0.7): this {
    this.perkTimer = Math.max(this.perkTimer, seconds);
    return this;
  }

  // --------------------------------------------------------------- acciones

  startLick(): this {
    if (this.licking || this.frozen) return this;
    this.licking = true;
    this.pawHold = 0;
    this.lickPhase = 0;
    const t = this.scene.tweens;
    t.killTweensOf(this.legFN);
    t.add({
      targets: this.legFN,
      rotation: LICK.leg,
      scaleY: LICK.legScale,
      duration: 220,
      ease: 'Back.easeOut'
    });
    this.tonguePart.setVisible(true).setScale(1, 0.2);
    this.mouthShape.setVisible(true).setScale(0.8, 0.5);
    return this;
  }

  stopLick(): this {
    if (!this.licking) return this;
    this.licking = false;
    this.pawHold = 0;
    const t = this.scene.tweens;
    t.killTweensOf(this.legFN);
    t.add({ targets: this.legFN, rotation: 0, scaleY: 1, duration: 200, ease: 'Quad.easeInOut' });
    this.tonguePart.setVisible(false);
    this.mouthShape.setVisible(false);
    return this;
  }

  /** Interrumpe el lamido de golpe: la pata se queda un instante en el aire. */
  abortLick(): this {
    if (!this.licking) return this;
    this.licking = false;
    this.pawHold = 0.95;
    this.tonguePart.setVisible(false);
    this.mouthShape.setVisible(false);
    const t = this.scene.tweens;
    t.killTweensOf(this.legFN);
    this.legFN.rotation = LICK.leg;
    t.add({
      targets: this.legFN,
      rotation: 0,
      scaleY: 1,
      duration: 280,
      delay: 620,
      ease: 'Back.easeIn'
    });
    return this;
  }

  bark(opts: { fx?: boolean; power?: number; depth?: number } = {}): this {
    if (this.frozen) return this;
    const power = opts.power ?? (Save.data.ratonMode ? 1.45 : 1);
    this.barkTimer = 0.36;
    const t = this.scene.tweens;
    t.add({
      targets: this.headNode,
      x: POSE_OFFSETS[this.pose].headX - 16,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut'
    });
    t.add({ targets: this, hopX: 10, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this.torso, scaleX: 1.08, scaleY: 0.93, duration: 90, yoyo: true });
    this.mouthShape.setVisible(true).setScale(1.15, 1.25);
    this.tonguePart.setVisible(true).setScale(1, 0.9);
    this.earNow.near = -0.2;
    this.earNow.far = 0.18;

    Audio.bark(power);
    if (opts.fx !== false) {
      const m = this.muzzleWorld();
      barkWave(this.scene, m.x, m.y, { scale: power, depth: opts.depth });
      floatText(this.scene, m.x - 10 * this.facing, m.y - 44, '¡GUAU!', {
        color: PAL.cream,
        size: 30 * power,
        title: true,
        depth: opts.depth
      });
    }
    return this;
  }

  celebrate(): this {
    this.setExpression('happy');
    this.tonguePart.setVisible(true).setScale(1, 1);
    this.mouthShape.setVisible(true).setScale(0.9, 0.8);
    this.scene.tweens.add({
      targets: this,
      hopY: -38,
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut'
    });
    this.scene.tweens.add({
      targets: this.torso,
      scaleY: 1.12,
      scaleX: 0.92,
      duration: 260,
      yoyo: true,
      repeat: 2
    });
    return this;
  }

  /** Salto exagerado hacia atrás (choque con bici). */
  recoilJump(dir: -1 | 1 = 1): this {
    this.setExpression('caught');
    const t = this.scene.tweens;
    t.add({ targets: this, hopY: -84, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this, hopX: dir * 44, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: [this.legFN, this.legFF], rotation: -0.95, duration: 200, yoyo: true });
    t.add({ targets: [this.legBN, this.legBF], rotation: 0.75, duration: 200, yoyo: true });
    puff(this.scene, this.x, this.y, { count: 8, spread: 70 });
    return this;
  }

  // ------------------------------------------------------------- posiciones

  /** Convierte un punto del espacio del rig a coordenadas de mundo. */
  private rigToWorld(lx: number, ly: number): { x: number; y: number } {
    return {
      x: this.x + (this.rig.x + lx) * this.rig.scaleX * this.scaleX,
      y: this.y + (this.rig.y + ly) * this.rig.scaleY * this.scaleY
    };
  }

  /** Punto del hocico en coordenadas de mundo. */
  muzzleWorld(): { x: number; y: number } {
    const r = this.headNode.rotation;
    return this.rigToWorld(
      this.headNode.x + MUZZLE.x * Math.cos(r) - MUZZLE.y * Math.sin(r),
      this.headNode.y + MUZZLE.x * Math.sin(r) + MUZZLE.y * Math.cos(r)
    );
  }

  /** Punto sobre la cabeza (para bocadillos y marcas de alerta). */
  headWorld(): { x: number; y: number } {
    return this.rigToWorld(this.headNode.x, this.headNode.y - 190);
  }

  /** Punto de la pata delantera izquierda. */
  leftPawWorld(): { x: number; y: number } {
    return this.rigToWorld(this.legFN.x, this.legFN.y + 110);
  }

  // ------------------------------------------------------------------- loop

  /** Llamar desde el update de la escena. `delta` en ms. */
  tick(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    const offsets = POSE_OFFSETS[this.pose];

    if (this.barkTimer > 0) {
      this.barkTimer -= dt;
      if (this.barkTimer <= 0 && !this.licking) {
        this.mouthShape.setVisible(false);
        this.tonguePart.setVisible(this.expression === 'happy');
      }
    }
    if (this.pawHold > 0) this.pawHold -= dt;
    if (this.cameraStare > 0) this.cameraStare -= dt;

    // Objetivos de expresión, suavizados.
    const look = this.look;
    if (this.perkTimer > 0) this.perkTimer -= dt;
    const perked = this.perkTimer > 0;
    const earTargetNear = perked ? LOOKS.alert.earNear : look.earNear;
    const earTargetFar = perked ? LOOKS.alert.earFar : look.earFar;
    if (!this.frozen) {
      this.earNow.near = damp(this.earNow.near, earTargetNear, perked ? 22 : 9, dt);
      this.earNow.far = damp(this.earNow.far, earTargetFar, perked ? 22 : 9, dt);
      this.crouchNow = damp(this.crouchNow, look.crouch, 7, dt);
    }

    this.earNear.rotation = this.earNow.near + Math.sin(this.clock * 1.7) * 0.03;
    this.earFar.rotation = this.earNow.far + Math.sin(this.clock * 1.31 + 1.2) * 0.036;

    // Respiración, peso y rebote al caminar.
    const breathe = this.frozen ? 0 : Math.sin(this.clock * 2.2);
    const bounce = this.motion > 0.02 ? Math.abs(Math.sin(this.walkPhase * 2)) * -5 * this.motion : 0;
    this.torso.scaleY = 1 + breathe * 0.022;
    this.torso.scaleX = 1 - breathe * 0.014;
    this.torsoNow = damp(this.torsoNow, offsets.torso, 10, dt);
    this.torso.y = this.torsoNow + this.crouchNow * 0.5 + bounce;

    this.rigNow = damp(this.rigNow, offsets.rig + this.crouchNow * 0.5, 10, dt);
    this.rig.y = this.rigNow + this.hopY;
    this.rig.x = this.hopX + (this.trembling ? Math.sin(this.clock * 46) * 2.2 : 0);

    // Cabeza.
    if (!this.licking && this.barkTimer <= 0) {
      this.headNode.rotation = damp(this.headNode.rotation, look.headTilt, 8, dt);
      this.headNode.y = damp(this.headNode.y, offsets.head + breathe * 2 + bounce, 10, dt);
      this.headNode.x = damp(this.headNode.x, offsets.headX, 10, dt);
    }

    // Cola.
    const wag = this.frozen ? 0.1 : look.wagSpeed;
    this.tailPart.rotation = Math.sin(this.clock * wag * 3) * look.wagAmp;

    // Ojos.
    this.eyeNear.setOpen(damp(this.eyeNear.openScale, look.eyeOpen, 10, dt));
    this.eyeFar.setOpen(damp(this.eyeFar.openScale, look.eyeOpen * 0.86, 10, dt));
    this.eyeNear.setLid(look.lid);
    this.eyeFar.setLid(look.lid);

    if (this.cameraStare > 0) {
      this.eyeNear.look(0.6, 0.32);
      this.eyeFar.look(0.9, 0.32);
    } else {
      this.eyeNear.look(this.gaze.x, this.gaze.y);
      this.eyeFar.look(this.gaze.x * 0.85, this.gaze.y);
    }

    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && !this.frozen && this.expression !== 'caught') {
      this.blinkAt = rand(2.2, 5.4);
      this.eyeNear.blink();
      this.eyeFar.blink();
    }

    this.updateLegs(dt);
    this.updateLick(dt);

    // La sombra encoge cuando está en el aire.
    const lift = clamp(-(this.rigNow + this.hopY) / 90, 0, 1);
    this.shadow.setScale(1 - lift * 0.35);
    this.shadow.setAlpha(0.26 * (1 - lift * 0.55));
  }

  private updateLegs(dt: number): void {
    if (this.pose !== 'stand' || this.frozen) return;

    if (this.motion > 0.02) {
      this.walkPhase += dt * (7 + this.motion * 9);
      const amp = 0.34 + this.motion * 0.32;
      if (!this.licking && this.pawHold <= 0) {
        this.legFN.rotation = Math.sin(this.walkPhase) * amp;
        this.legFF.rotation = Math.sin(this.walkPhase + Math.PI) * amp * 0.85;
      }
      this.legBN.rotation = Math.sin(this.walkPhase + Math.PI) * amp * 0.9;
      this.legBF.rotation = Math.sin(this.walkPhase) * amp * 0.8;

      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.28 / (0.6 + this.motion);
        Audio.footstep();
        if (this.motion > 0.55) {
          puff(this.scene, this.x + rand(-14, 14), this.y - 2, { count: 2, spread: 18, scale: 0.6 });
        }
      }
      return;
    }

    if (!this.licking && this.pawHold <= 0) {
      this.legFN.rotation = damp(this.legFN.rotation, 0, 9, dt);
      this.legFF.rotation = damp(this.legFF.rotation, 0, 9, dt);
    }
    this.legBN.rotation = damp(this.legBN.rotation, 0, 9, dt);
    this.legBF.rotation = damp(this.legBF.rotation, 0, 9, dt);
  }

  /** La cabeza baja a buscar la pata levantada, con el ritmo del lametón. */
  private updateLick(dt: number): void {
    if (!this.licking) return;
    this.lickPhase += dt * 13;
    const l = Math.sin(this.lickPhase);
    const offsets = POSE_OFFSETS[this.pose];
    this.headNode.rotation = LICK.headRot + l * 0.07;
    this.headNode.x = offsets.headX + LICK.headDX;
    this.headNode.y = offsets.head + LICK.headDY + l * 3;
    this.tonguePart.scaleY = 0.35 + (l * 0.5 + 0.5) * 0.85;
    this.tonguePart.y = 30 + l * 3;
  }
}
