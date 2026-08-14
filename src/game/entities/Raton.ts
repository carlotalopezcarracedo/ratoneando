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
}

/**
 * Las orejas de Ratón se abren mucho hacia los lados (es su rasgo más
 * reconocible) y sólo se enderezan cuando está alerta.
 */
const LOOKS: Record<RatonExpression, Look> = {
  normal:   { eyeOpen: 1,    lid: 1,    dilation: 1,    earNear: -0.46, earFar: 0.44, crouch:  0, wagSpeed: 1.6, wagAmp: 0.16 },
  alert:    { eyeOpen: 1.12, lid: 1,    dilation: 1.14, earNear: -0.20, earFar: 0.18, crouch: -4, wagSpeed: 2.6, wagAmp: 0.10 },
  fear:     { eyeOpen: 1.34, lid: 1,    dilation: 1.5,  earNear:  0.30, earFar: 0.95, crouch: 10, wagSpeed: 0.6, wagAmp: 0.05 },
  obsessed: { eyeOpen: 1.16, lid: 1,    dilation: 0.6,  earNear: -0.54, earFar: 0.34, crouch:  2, wagSpeed: 8.5, wagAmp: 0.34 },
  caught:   { eyeOpen: 1.45, lid: 1,    dilation: 0.48, earNear:  0.02, earFar: 0.78, crouch:  5, wagSpeed: 0.2, wagAmp: 0.02 },
  happy:    { eyeOpen: 1.06, lid: 0.34, dilation: 1,    earNear: -0.58, earFar: 0.52, crouch: -3, wagSpeed: 9.5, wagAmp: 0.42 },
  sleepy:   { eyeOpen: 0.95, lid: 0.3,  dilation: 0.9,  earNear: -0.10, earFar: 0.74, crouch:  6, wagSpeed: 0.8, wagAmp: 0.07 }
};

const RIG_SCALE = 0.46;
const FAR_TINT = 0x8a7f7a;

/**
 * El cuerpo (cabeza incluida) es una sola pieza centrada aquí. Todo lo demás se
 * sitúa en coordenadas locales a este punto.
 */
const BODY_Y = -140;

/** Puntos de referencia dentro del cuerpo, en coordenadas locales al mismo. */
const ANCHOR = {
  nose: { x: -132, y: -20 },
  mouth: { x: -108, y: -4 },
  earNear: { x: -38, y: -70 },
  earFar: { x: -10, y: -68 },
  eyeNear: { x: -48, y: -44 },
  eyeFar: { x: -14, y: -52 },
  shoulder: { x: -10, y: 28 },
  hip: { x: 94, y: 20 },
  tail: { x: 128, y: -4 }
};

/**
 * Pose de lamido: la pata delantera IZQUIERDA sube por delante del pecho y el
 * cuerpo entero se inclina para que el hocico BAJE a buscarla, que es como lo
 * hace un perro de verdad. Si sólo subiera la pata, le cruzaría la cara.
 */
const LICK = { leg: 1.23, legScale: 0.84, bodyTilt: -0.26 };

/** Inclinación del cuerpo en cada postura, para poder restaurarla. */
const POSE_TILT: Record<RatonPose, number> = { stand: 0, sit: -0.1, lie: 0.04 };

const POSE_OFFSETS: Record<RatonPose, { rig: number; body: number }> = {
  stand: { rig: 0, body: BODY_Y },
  sit: { rig: 12, body: BODY_Y + 26 },
  lie: { rig: 38, body: BODY_Y + 46 }
};

/**
 * Ratón.
 *
 * El cuerpo, el cuello y la cabeza son **un único SVG**: así no puede aparecer
 * una junta entre cabeza y tronco, que es el fallo clásico de los rigs por
 * capas. Las orejas y las patas van detrás de esa silueta, de modo que sus
 * arranques quedan escondidos, y encima sólo se pintan ojos, boca y lengua.
 *
 * Mira a la IZQUIERDA por defecto: así el flanco visible es el izquierdo y la
 * pata delantera **izquierda** queda en primer plano, que es el chiste del
 * primer nivel.
 */
export class Raton extends Phaser.GameObjects.Container {
  /** Desplazamientos de salto/retroceso; los animan los tweens. */
  hopX = 0;
  hopY = 0;

  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  /** Contiene cuerpo, orejas, ojos y boca: todo lo que respira a la vez. */
  private readonly bodyNode: Phaser.GameObjects.Container;
  private readonly bodyPart: Part;
  private readonly tailPart: Part;
  private readonly legFN: Part; // delantera IZQUIERDA (cercana) — la protagonista
  private readonly legFF: Part;
  private readonly legBN: Part;
  private readonly legBF: Part;

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
  private bodyNow = BODY_Y;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const earScale = (Save.data.ratonMode ? 1.2 : 1) * 0.92;

    this.shadow = scene.add.ellipse(0, 6, 214, 42, 0x000000, 0.26);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(RIG_SCALE);
    this.add(this.rig);

    this.tailPart = new Part(scene, 'raton-tail', ANCHOR.tail.x, ANCHOR.tail.y + BODY_Y, 0.2, 0.94);
    this.legBF = new Part(scene, 'raton-leg-back', 76, -112, 0.7, 0.06).tint(FAR_TINT);
    this.legFF = new Part(scene, 'raton-leg-front', -32, -108, 0.5, 0.05).tint(FAR_TINT);

    // ---- cuerpo entero (cabeza incluida) + lo que va pegado a él
    this.bodyNode = scene.add.container(0, BODY_Y);

    this.earFar = new Part(scene, 'raton-ear', ANCHOR.earFar.x, ANCHOR.earFar.y, 0.5, 0.95).tint(FAR_TINT);
    this.earFar.setScale(0.9 * earScale);
    this.earNear = new Part(scene, 'raton-ear', ANCHOR.earNear.x, ANCHOR.earNear.y, 0.5, 0.95);
    this.earNear.setScale(earScale);

    this.bodyPart = new Part(scene, 'raton-body', 0, 0, 0.5, 0.5);

    this.eyeFar = new Eye(scene, ANCHOR.eyeFar.x, ANCHOR.eyeFar.y, 13);
    this.eyeFar.setScale(0.8);
    this.eyeNear = new Eye(scene, ANCHOR.eyeNear.x, ANCHOR.eyeNear.y, 17);

    this.mouthShape = scene.add
      .ellipse(ANCHOR.mouth.x, ANCHOR.mouth.y, 32, 18, 0x2b1216)
      .setVisible(false);
    this.mouthShape.setStrokeStyle(3, PAL.furDark, 1);
    this.tonguePart = new Part(scene, 'raton-tongue', ANCHOR.mouth.x - 2, ANCHOR.mouth.y + 2, 0.5, 0.1);
    this.tonguePart.setVisible(false);
    this.nutPart = new Part(scene, 'nut', ANCHOR.mouth.x - 18, ANCHOR.mouth.y - 2, 0.5, 0.5);
    this.nutPart.setVisible(false);

    this.bodyNode.add([
      this.earFar,
      this.earNear,
      this.bodyPart,
      this.mouthShape,
      this.tonguePart,
      this.eyeFar,
      this.eyeNear,
      this.nutPart
    ]);

    this.legBN = new Part(scene, 'raton-leg-back', 96, -116, 0.7, 0.06);
    this.legFN = new Part(scene, 'raton-leg-front', -10, -112, 0.5, 0.05);

    // Sólo la pata delantera IZQUIERDA va por delante del cuerpo (la necesita
    // para el lamido). Las traseras van detrás: si no, al sentarse la pezuña
    // recogida asoma sobre el costado.
    this.rig.add([this.tailPart, this.legBF, this.legBN, this.legFF, this.bodyNode, this.legFN]);

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
      t.add({ targets: [this.legBN, this.legBF], rotation: 0.5, scaleY: 0.58, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legFN, this.legFF], rotation: 0, scaleY: 1, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: this.bodyNode, rotation: POSE_TILT.sit, duration: 280, ease: 'Quad.easeOut' });
    } else if (pose === 'lie') {
      t.add({ targets: [this.legBN, this.legBF], rotation: -1.24, scaleY: 0.54, duration: 340 });
      t.add({ targets: [this.legFN, this.legFF], rotation: -1.4, scaleY: 0.66, duration: 340 });
      t.add({ targets: this.bodyNode, rotation: POSE_TILT.lie, duration: 340 });
    } else {
      t.add({
        targets: [this.legBN, this.legBF, this.legFN, this.legFF],
        rotation: 0,
        scaleY: 1,
        duration: 260
      });
      t.add({ targets: this.bodyNode, rotation: POSE_TILT.stand, duration: 260 });
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
    t.add({
      targets: this.bodyNode,
      rotation: POSE_TILT[this.pose] + LICK.bodyTilt,
      duration: 240,
      ease: 'Quad.easeOut'
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
    t.add({ targets: this.bodyNode, rotation: POSE_TILT[this.pose], duration: 220, ease: 'Quad.easeInOut' });
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
    t.add({ targets: this.bodyNode, rotation: POSE_TILT[this.pose], duration: 180, ease: 'Quad.easeOut' });
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
    // Estirón hacia delante y retroceso del cuerpo entero.
    t.add({ targets: this.bodyNode, x: -14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this, hopX: 10, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this.bodyPart, scaleX: 1.06, scaleY: 0.94, duration: 90, yoyo: true });
    this.mouthShape.setVisible(true).setScale(1.15, 1.3);
    this.tonguePart.setVisible(true).setScale(1, 0.9);
    this.earNow.near = -0.12;
    this.earNow.far = 0.12;

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
      targets: this.bodyPart,
      scaleY: 1.1,
      scaleX: 0.94,
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
    return this.rigToWorld(this.bodyNode.x + ANCHOR.nose.x, this.bodyNode.y + ANCHOR.nose.y);
  }

  /** Punto sobre la cabeza (para bocadillos y marcas de alerta). */
  headWorld(): { x: number; y: number } {
    return this.rigToWorld(this.bodyNode.x + ANCHOR.earNear.x, this.bodyNode.y + ANCHOR.earNear.y - 130);
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
    if (this.perkTimer > 0) this.perkTimer -= dt;

    // Orejas: objetivo suavizado, con el aviso anticipado por encima.
    const look = this.look;
    const perked = this.perkTimer > 0;
    const earNearTarget = perked ? LOOKS.alert.earNear : look.earNear;
    const earFarTarget = perked ? LOOKS.alert.earFar : look.earFar;
    if (!this.frozen) {
      this.earNow.near = damp(this.earNow.near, earNearTarget, perked ? 22 : 9, dt);
      this.earNow.far = damp(this.earNow.far, earFarTarget, perked ? 22 : 9, dt);
      this.crouchNow = damp(this.crouchNow, look.crouch, 7, dt);
    }
    this.earNear.rotation = this.earNow.near + Math.sin(this.clock * 1.7) * 0.03;
    this.earFar.rotation = this.earNow.far + Math.sin(this.clock * 1.31 + 1.2) * 0.036;

    // Respiración y rebote: los aplica el contenedor, así que la cabeza y las
    // orejas se mueven solidarias con el cuerpo.
    const breathe = this.frozen ? 0 : Math.sin(this.clock * 2.2);
    const bounce = this.motion > 0.02 ? Math.abs(Math.sin(this.walkPhase * 2)) * -5 * this.motion : 0;
    this.bodyPart.scaleY = 1 + breathe * 0.02;
    this.bodyPart.scaleX = 1 - breathe * 0.012;
    this.bodyNow = damp(this.bodyNow, offsets.body, 10, dt);
    this.bodyNode.y = this.bodyNow + this.crouchNow * 0.5 + bounce + (this.licking ? Math.sin(this.lickPhase) * 2 : 0);
    if (this.barkTimer <= 0) this.bodyNode.x = damp(this.bodyNode.x, 0, 12, dt);

    this.rigNow = damp(this.rigNow, offsets.rig + this.crouchNow * 0.4, 10, dt);
    this.rig.y = this.rigNow + this.hopY;
    this.rig.x = this.hopX + (this.trembling ? Math.sin(this.clock * 46) * 2.2 : 0);

    // Cola.
    const wag = this.frozen ? 0.1 : look.wagSpeed;
    this.tailPart.rotation = Math.sin(this.clock * wag * 3) * look.wagAmp;
    this.tailPart.y = this.bodyNode.y + ANCHOR.tail.y;

    // Ojos.
    this.eyeNear.setOpen(damp(this.eyeNear.openScale, look.eyeOpen, 10, dt));
    this.eyeFar.setOpen(damp(this.eyeFar.openScale, look.eyeOpen * 0.88, 10, dt));
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
    if (this.licking) this.updateLick(dt);

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

  /** Ritmo del lametón: la lengua asoma y la pata vibra contra el hocico. */
  private updateLick(dt: number): void {
    this.lickPhase += dt * 13;
    const l = Math.sin(this.lickPhase);
    this.legFN.rotation = LICK.leg + l * 0.05;
    this.tonguePart.scaleY = 0.35 + (l * 0.5 + 0.5) * 0.85;
    this.tonguePart.y = ANCHOR.mouth.y + 2 + l * 2;
  }
}
