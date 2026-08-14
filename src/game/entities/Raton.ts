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
  /** Apertura de las orejas: 0 = tiesas, valores altos = caídas hacia fuera. */
  earSpread: number;
  crouch: number;
  wagSpeed: number;
  wagAmp: number;
}

/**
 * Las orejas de Ratón son enormes y sólo se enderezan del todo cuando está
 * alerta; en reposo se abren hacia los lados y con miedo se echan hacia atrás.
 */
const LOOKS: Record<RatonExpression, Look> = {
  normal:   { eyeOpen: 1,    lid: 1,    dilation: 1,    earSpread: 0.24, crouch:  0, wagSpeed: 1.6, wagAmp: 0.16 },
  alert:    { eyeOpen: 1.12, lid: 1,    dilation: 1.14, earSpread: 0.04, crouch: -4, wagSpeed: 2.6, wagAmp: 0.10 },
  fear:     { eyeOpen: 1.34, lid: 1,    dilation: 1.5,  earSpread: 0.82, crouch: 12, wagSpeed: 0.6, wagAmp: 0.05 },
  obsessed: { eyeOpen: 1.16, lid: 1,    dilation: 0.6,  earSpread: 0.12, crouch:  2, wagSpeed: 8.5, wagAmp: 0.34 },
  caught:   { eyeOpen: 1.45, lid: 1,    dilation: 0.48, earSpread: 0.62, crouch:  6, wagSpeed: 0.2, wagAmp: 0.02 },
  happy:    { eyeOpen: 1.06, lid: 0.34, dilation: 1,    earSpread: 0.30, crouch: -3, wagSpeed: 9.5, wagAmp: 0.42 },
  sleepy:   { eyeOpen: 0.95, lid: 0.30, dilation: 0.9,  earSpread: 0.60, crouch:  6, wagSpeed: 0.8, wagAmp: 0.07 }
};

const RIG_SCALE = 0.42;
/** El cuerpo (cabeza incluida) es una sola pieza centrada aquí. */
const BODY_Y = -180;

/** Puntos de referencia dentro del cuerpo, en coordenadas locales al mismo. */
const ANCHOR = {
  nose: { x: 0, y: -36 },
  mouth: { x: 0, y: -17 },
  earLeft: { x: -42, y: -98 },
  earRight: { x: 42, y: -98 },
  eyeLeft: { x: -21, y: -68 },
  eyeRight: { x: 21, y: -68 },
  tail: { x: 42, y: 34 }
};

/** Patas, en coordenadas del rig (el suelo es y = 0). */
const LEG = {
  frontLeft: { x: 23, y: -104 }, // la pata IZQUIERDA del perro: a nuestra derecha
  frontRight: { x: -23, y: -104 },
  backLeft: { x: 50, y: -96 },
  backRight: { x: -50, y: -96 }
};

/**
 * Pose de lamido: la pata delantera IZQUIERDA se pliega hasta el hocico y el
 * cuerpo se ladea hacia ella.
 */
const LICK = { leg: 2.62, legScale: 0.68, bodyTilt: 0.13 };

const POSE_TILT: Record<RatonPose, number> = { stand: 0, sit: 0, lie: 0 };

const POSE_OFFSETS: Record<RatonPose, { body: number }> = {
  stand: { body: BODY_Y },
  sit: { body: BODY_Y + 46 },
  lie: { body: BODY_Y + 78 }
};

/**
 * Ratón, de frente.
 *
 * El cuerpo, el cuello y la cabeza son **un único SVG**: así no puede aparecer
 * una junta entre cabeza y tronco. Las orejas y las patas traseras van detrás
 * de esa silueta, de modo que sus arranques quedan escondidos; encima sólo se
 * pintan ojos, boca y lengua.
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
  private readonly legFN: Part; // delantera IZQUIERDA — la protagonista
  private readonly legFF: Part;
  private readonly legBN: Part;
  private readonly legBF: Part;

  private readonly earLeft: Part;
  private readonly earRight: Part;
  private readonly eyeLeft: Eye;
  private readonly eyeRight: Eye;
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
  private gaze = { x: 0, y: 0 };
  private stepTimer = 0;
  private perkTimer = 0;

  private earNow = LOOKS.normal.earSpread;
  private crouchNow = 0;
  private bodyNow = BODY_Y;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const earScale = Save.data.ratonMode ? 1.2 : 1;

    this.shadow = scene.add.ellipse(0, 6, 170, 38, 0x000000, 0.26);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(RIG_SCALE);
    this.add(this.rig);

    // ---- capas traseras
    this.tailPart = new Part(scene, 'raton-tail', ANCHOR.tail.x, ANCHOR.tail.y + BODY_Y, 0.2, 0.94);
    this.legBF = new Part(scene, 'raton-leg-back', LEG.backRight.x, LEG.backRight.y, 0.5, 0.05);
    this.legBN = new Part(scene, 'raton-leg-back', LEG.backLeft.x, LEG.backLeft.y, 0.5, 0.05);

    // ---- cuerpo entero (cabeza incluida) + lo que va pegado a él
    this.bodyNode = scene.add.container(0, BODY_Y);

    this.earRight = new Part(scene, 'raton-ear', ANCHOR.earRight.x, ANCHOR.earRight.y, 0.5, 0.95);
    this.earRight.setScale(earScale);
    this.earLeft = new Part(scene, 'raton-ear', ANCHOR.earLeft.x, ANCHOR.earLeft.y, 0.5, 0.95);
    this.earLeft.setScale(earScale);
    this.earLeft.img.setFlipX(true); // la misma oreja, reflejada

    this.bodyPart = new Part(scene, 'raton-body', 0, 0, 0.5, 0.5);

    this.eyeLeft = new Eye(scene, ANCHOR.eyeLeft.x, ANCHOR.eyeLeft.y, 15);
    this.eyeRight = new Eye(scene, ANCHOR.eyeRight.x, ANCHOR.eyeRight.y, 15);

    this.mouthShape = scene.add
      .ellipse(ANCHOR.mouth.x, ANCHOR.mouth.y + 6, 30, 17, 0x2b1216)
      .setVisible(false);
    this.mouthShape.setStrokeStyle(3, PAL.furDark, 1);
    this.tonguePart = new Part(scene, 'raton-tongue', ANCHOR.mouth.x, ANCHOR.mouth.y + 8, 0.5, 0.1);
    this.tonguePart.setVisible(false);
    this.nutPart = new Part(scene, 'nut', ANCHOR.mouth.x, ANCHOR.mouth.y + 10, 0.5, 0.5);
    this.nutPart.setVisible(false);

    this.bodyNode.add([
      this.earLeft,
      this.earRight,
      this.bodyPart,
      this.mouthShape,
      this.tonguePart,
      this.eyeLeft,
      this.eyeRight,
      this.nutPart
    ]);

    // ---- patas delanteras, por delante del cuerpo
    this.legFF = new Part(scene, 'raton-leg-front', LEG.frontRight.x, LEG.frontRight.y, 0.5, 0.06);
    this.legFN = new Part(scene, 'raton-leg-front', LEG.frontLeft.x, LEG.frontLeft.y, 0.5, 0.06);

    this.rig.add([this.tailPart, this.legBF, this.legBN, this.bodyNode, this.legFF, this.legFN]);

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

  /**
   * Ratón siempre mira a cámara, así que cambiar de dirección sólo inclina
   * levemente el cuerpo hacia donde va. Basta para dar sensación de marcha.
   */
  setFacing(dir: -1 | 1): this {
    if (this.facing === dir) return this;
    this.facing = dir;
    this.scene.tweens.add({
      targets: this.bodyNode,
      rotation: POSE_TILT[this.pose] + dir * 0.05,
      duration: 180,
      ease: 'Quad.easeOut'
    });
    return this;
  }

  setExpression(next: RatonExpression, instant = false): this {
    if (this.expression === next) return this;
    this.expression = next;
    this.look = LOOKS[next];
    if (instant) {
      this.earNow = this.look.earSpread;
      this.crouchNow = this.look.crouch;
    }
    this.eyeLeft.setDilation(this.look.dilation);
    this.eyeRight.setDilation(this.look.dilation);
    return this;
  }

  setPose(pose: RatonPose): this {
    if (this.pose === pose) return this;
    this.pose = pose;
    const t = this.scene.tweens;
    // De frente, sentarse y tumbarse es sobre todo bajar el cuerpo y acortar
    // las patas: no hay perfil que doblar.
    if (pose === 'sit') {
      t.add({ targets: [this.legBN, this.legBF], scaleY: 0.42, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legFN, this.legFF], scaleY: 0.86, duration: 280, ease: 'Quad.easeOut' });
    } else if (pose === 'lie') {
      t.add({ targets: [this.legBN, this.legBF], scaleY: 0.2, duration: 340 });
      t.add({ targets: [this.legFN, this.legFF], scaleY: 0.32, duration: 340 });
    } else {
      t.add({
        targets: [this.legBN, this.legBF, this.legFN, this.legFF],
        scaleY: 1,
        duration: 260
      });
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

  /** Mirada hacia un punto del mundo (sólo mueve las pupilas). */
  lookAt(worldX: number, worldY: number): this {
    this.gaze.x = clamp((worldX - this.x) / 300, -1, 1);
    this.gaze.y = clamp((worldY - (this.y - 90)) / 240, -0.7, 0.7);
    return this;
  }

  lookForward(): this {
    this.gaze.x = 0;
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
    t.add({ targets: this, hopY: -12, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this.bodyPart, scaleX: 1.07, scaleY: 0.94, duration: 90, yoyo: true });
    this.mouthShape.setVisible(true).setScale(1.15, 1.3);
    this.tonguePart.setVisible(true).setScale(1, 0.9);
    this.earNow = LOOKS.alert.earSpread;

    Audio.bark(power);
    if (opts.fx !== false) {
      const m = this.muzzleWorld();
      barkWave(this.scene, m.x, m.y, { scale: power, depth: opts.depth });
      floatText(this.scene, m.x, m.y - 48, '¡GUAU!', {
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
    t.add({ targets: [this.legFN, this.legFF], scaleY: 0.7, duration: 200, yoyo: true });
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
    return this.rigToWorld(this.bodyNode.x, this.bodyNode.y + ANCHOR.earLeft.y - 130);
  }

  /** Punto de la pata delantera izquierda. */
  leftPawWorld(): { x: number; y: number } {
    return this.rigToWorld(this.legFN.x, this.legFN.y + 96);
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

    // Orejas: se abren en espejo, con el aviso anticipado por encima.
    const look = this.look;
    const perked = this.perkTimer > 0;
    const earTarget = perked ? LOOKS.alert.earSpread : look.earSpread;
    if (!this.frozen) {
      this.earNow = damp(this.earNow, earTarget, perked ? 22 : 9, dt);
      this.crouchNow = damp(this.crouchNow, look.crouch, 7, dt);
    }
    this.earRight.rotation = this.earNow + Math.sin(this.clock * 1.7) * 0.03;
    this.earLeft.rotation = -this.earNow + Math.sin(this.clock * 1.31 + 1.2) * 0.03;

    // Respiración y rebote: los aplica el contenedor, así que cabeza y orejas
    // se mueven solidarias con el cuerpo.
    const breathe = this.frozen ? 0 : Math.sin(this.clock * 2.2);
    const bounce = this.motion > 0.02 ? Math.abs(Math.sin(this.walkPhase)) * -4 * this.motion : 0;
    this.bodyPart.scaleY = 1 + breathe * 0.02;
    this.bodyPart.scaleX = 1 - breathe * 0.012;
    this.bodyNow = damp(this.bodyNow, offsets.body, 10, dt);
    this.bodyNode.y = this.bodyNow + this.crouchNow * 0.6 + bounce;

    this.rig.y = this.hopY;
    this.rig.x = this.hopX + (this.trembling ? Math.sin(this.clock * 46) * 2.2 : 0);

    // Cola.
    const wag = this.frozen ? 0.1 : look.wagSpeed;
    this.tailPart.rotation = Math.sin(this.clock * wag * 3) * look.wagAmp;
    this.tailPart.y = this.bodyNode.y + ANCHOR.tail.y;

    // Ojos.
    this.eyeLeft.setOpen(damp(this.eyeLeft.openScale, look.eyeOpen, 10, dt));
    this.eyeRight.setOpen(damp(this.eyeRight.openScale, look.eyeOpen, 10, dt));
    this.eyeLeft.setLid(look.lid);
    this.eyeRight.setLid(look.lid);

    if (this.cameraStare > 0) {
      this.eyeLeft.look(0, 0.08);
      this.eyeRight.look(0, 0.08);
    } else {
      this.eyeLeft.look(this.gaze.x, this.gaze.y);
      this.eyeRight.look(this.gaze.x, this.gaze.y);
    }

    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && !this.frozen && this.expression !== 'caught') {
      this.blinkAt = rand(2.2, 5.4);
      this.eyeLeft.blink();
      this.eyeRight.blink();
    }

    this.updateLegs(dt);
    if (this.licking) this.updateLick(dt);

    // La sombra encoge cuando está en el aire.
    const lift = clamp(-this.hopY / 90, 0, 1);
    this.shadow.setScale(1 - lift * 0.35);
    this.shadow.setAlpha(0.26 * (1 - lift * 0.55));
  }

  private updateLegs(dt: number): void {
    if (this.pose !== 'stand' || this.frozen) return;

    if (this.motion > 0.02) {
      this.walkPhase += dt * (7 + this.motion * 9);
      // De frente las patas no barren de lado: se alternan levantándose.
      const amp = 0.09 + this.motion * 0.09;
      const lift = 8 + this.motion * 7;
      const a = Math.sin(this.walkPhase);
      const b = Math.sin(this.walkPhase + Math.PI);
      if (!this.licking && this.pawHold <= 0) {
        this.legFN.rotation = a * amp;
        this.legFN.y = LEG.frontLeft.y - Math.max(0, a) * lift;
        this.legFF.rotation = b * amp;
        this.legFF.y = LEG.frontRight.y - Math.max(0, b) * lift;
      }
      this.legBN.rotation = b * amp * 0.8;
      this.legBN.y = LEG.backLeft.y - Math.max(0, b) * lift * 0.7;
      this.legBF.rotation = a * amp * 0.8;
      this.legBF.y = LEG.backRight.y - Math.max(0, a) * lift * 0.7;

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
      this.legFN.y = damp(this.legFN.y, LEG.frontLeft.y, 9, dt);
      this.legFF.rotation = damp(this.legFF.rotation, 0, 9, dt);
      this.legFF.y = damp(this.legFF.y, LEG.frontRight.y, 9, dt);
    }
    this.legBN.rotation = damp(this.legBN.rotation, 0, 9, dt);
    this.legBN.y = damp(this.legBN.y, LEG.backLeft.y, 9, dt);
    this.legBF.rotation = damp(this.legBF.rotation, 0, 9, dt);
    this.legBF.y = damp(this.legBF.y, LEG.backRight.y, 9, dt);
  }

  /** Ritmo del lametón: la lengua asoma y la pata vibra contra el hocico. */
  private updateLick(dt: number): void {
    this.lickPhase += dt * 13;
    const l = Math.sin(this.lickPhase);
    this.legFN.rotation = LICK.leg + l * 0.05;
    this.tonguePart.scaleY = 0.35 + (l * 0.5 + 0.5) * 0.85;
    this.tonguePart.y = ANCHOR.mouth.y + 8 + l * 2;
  }
}
