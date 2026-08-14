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
  earNear: number;
  earFar: number;
  crouch: number;
  wagSpeed: number;
  wagAmp: number;
  headTilt: number;
}

/** Cada expresión mueve orejas, ojos, cola y altura del cuerpo a la vez. */
const LOOKS: Record<RatonExpression, Look> = {
  normal:   { eyeOpen: 1,    lid: 1,    dilation: 1,    earNear: -0.12, earFar: 0.20, crouch:  0, wagSpeed: 1.6, wagAmp: 0.16, headTilt:  0 },
  alert:    { eyeOpen: 1.1,  lid: 1,    dilation: 1.12, earNear:  0.02, earFar: 0.07, crouch: -3, wagSpeed: 2.6, wagAmp: 0.10, headTilt: -0.05 },
  fear:     { eyeOpen: 1.32, lid: 1,    dilation: 1.5,  earNear:  0.50, earFar: 0.72, crouch:  9, wagSpeed: 0.6, wagAmp: 0.05, headTilt:  0.10 },
  obsessed: { eyeOpen: 1.14, lid: 1,    dilation: 0.62, earNear: -0.20, earFar: 0.10, crouch:  2, wagSpeed: 8.5, wagAmp: 0.34, headTilt: -0.12 },
  caught:   { eyeOpen: 1.42, lid: 1,    dilation: 0.5,  earNear:  0.34, earFar: 0.56, crouch:  4, wagSpeed: 0.2, wagAmp: 0.02, headTilt:  0.06 },
  happy:    { eyeOpen: 1.06, lid: 0.36, dilation: 1,    earNear: -0.24, earFar: 0.30, crouch: -2, wagSpeed: 9.5, wagAmp: 0.40, headTilt: -0.08 },
  sleepy:   { eyeOpen: 0.95, lid: 0.3,  dilation: 0.9,  earNear:  0.28, earFar: 0.42, crouch:  5, wagSpeed: 0.8, wagAmp: 0.07, headTilt:  0.12 }
};

const HEAD_X = -104;
const HEAD_Y = -186;
/** Proporciones: cabeza grande y cuerpo compacto, como un perro pequeño alerta. */
const TORSO_W = 0.84;
const TORSO_H = 0.96;
const HEAD_SCALE = 1.15;
/** Ángulo y escala de la pata delantera izquierda al lamerla. */
const LICK_LEG_ROTATION = 1.95;
const LICK_HEAD_ROTATION = -0.34;
const FAR_TINT = 0x8f8480;

const POSE_OFFSETS: Record<RatonPose, { rig: number; torso: number; head: number; headX: number }> = {
  stand: { rig: 0, torso: -92, head: HEAD_Y, headX: HEAD_X },
  sit: { rig: 10, torso: -80, head: HEAD_Y - 18, headX: HEAD_X + 10 },
  lie: { rig: 40, torso: -64, head: HEAD_Y + 58, headX: HEAD_X - 16 }
};

/**
 * Ratón. Rig por capas: cola, patas, torso y cabeza (orejas + ojos + boca).
 * Mira a la IZQUIERDA por defecto, de modo que el flanco visible es el izquierdo
 * y la pata delantera **izquierda** queda en primer plano: ese es el chiste.
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

  private earNow = { near: -0.12, far: 0.2 };
  private crouchNow = 0;
  private rigNow = 0;
  private torsoNow = -92;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    const earScale = Save.data.ratonMode ? 1.2 : 1;

    this.shadow = scene.add.ellipse(0, 6, 224, 44, 0x000000, 0.26);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(0.5);
    this.add(this.rig);

    this.tailPart = new Part(scene, 'raton-tail', 74, -112, 0.2, 0.94);
    this.tailPart.setScale(1.12);
    this.legBF = new Part(scene, 'raton-leg-back', 44, -108, 0.7, 0.06).tint(FAR_TINT);
    this.legFF = new Part(scene, 'raton-leg-front', -64, -112, 0.5, 0.05).tint(FAR_TINT);
    this.torso = new Part(scene, 'raton-body', 0, -92, 0.5, 0.5);
    this.torso.setScale(TORSO_W, TORSO_H);

    this.headNode = scene.add.container(HEAD_X, HEAD_Y);
    this.headNode.setScale(HEAD_SCALE);
    this.earFar = new Part(scene, 'raton-ear', 22, -44, 0.5, 0.93).tint(FAR_TINT);
    this.earFar.setScale(0.86 * earScale);
    const skull = new Part(scene, 'raton-head', 0, 0, 0.5, 0.5);
    this.earNear = new Part(scene, 'raton-ear', -10, -46, 0.5, 0.93);
    this.earNear.setScale(earScale);

    this.mouthShape = scene.add.ellipse(-48, 27, 36, 20, 0x2b1216).setVisible(false);
    this.mouthShape.setStrokeStyle(3, PAL.furDark, 1);
    this.tonguePart = new Part(scene, 'raton-tongue', -50, 28, 0.5, 0.1);
    this.tonguePart.setVisible(false);
    this.nutPart = new Part(scene, 'nut', -62, 26, 0.5, 0.5);
    this.nutPart.setVisible(false);

    this.eyeFar = new Eye(scene, 4, -20, 15);
    this.eyeFar.setScale(0.84);
    this.eyeNear = new Eye(scene, -28, -15, 19);

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

    this.legBN = new Part(scene, 'raton-leg-back', 60, -110, 0.7, 0.06);
    this.legFN = new Part(scene, 'raton-leg-front', -48, -114, 0.5, 0.05);

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
    this.rig.scaleX = dir === -1 ? 0.5 : -0.5;
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
      t.add({ targets: [this.legBN, this.legBF], rotation: -0.66, scaleY: 0.72, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legFN, this.legFF], rotation: 0, scaleY: 1, duration: 280, ease: 'Quad.easeOut' });
      t.add({ targets: this.torso, rotation: -0.2, duration: 280, ease: 'Quad.easeOut' });
    } else if (pose === 'lie') {
      t.add({ targets: [this.legBN, this.legBF], rotation: -1.2, scaleY: 0.58, duration: 340 });
      t.add({ targets: [this.legFN, this.legFF], rotation: -1.38, scaleY: 0.7, duration: 340 });
      t.add({ targets: this.torso, rotation: 0.04, duration: 340 });
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

  // --------------------------------------------------------------- acciones

  startLick(): this {
    if (this.licking || this.frozen) return this;
    this.licking = true;
    this.pawHold = 0;
    this.lickPhase = 0;
    const t = this.scene.tweens;
    t.killTweensOf(this.legFN);
    t.add({ targets: this.legFN, rotation: LICK_LEG_ROTATION, scaleY: 0.95, duration: 220, ease: 'Back.easeOut' });
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
    this.legFN.rotation = LICK_LEG_ROTATION;
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
    t.add({ targets: this.headNode, x: this.headX() - 14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this, hopX: 10, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
    t.add({
      targets: this.torso,
      scaleX: TORSO_W * 1.09,
      scaleY: TORSO_H * 0.92,
      duration: 90,
      yoyo: true
    });
    this.mouthShape.setVisible(true).setScale(1.15, 1.25);
    this.tonguePart.setVisible(true).setScale(1, 0.9);
    this.earNow.near = 0.02;
    this.earNow.far = 0.06;

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
      scaleY: TORSO_H * 1.13,
      scaleX: TORSO_W * 0.91,
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

  private headX(): number {
    return POSE_OFFSETS[this.pose].headX;
  }

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
    const mx = -54;
    const my = 6;
    const s = HEAD_SCALE;
    return this.rigToWorld(
      this.headNode.x + (mx * Math.cos(r) - my * Math.sin(r)) * s,
      this.headNode.y + (mx * Math.sin(r) + my * Math.cos(r)) * s
    );
  }

  /** Punto sobre la cabeza (para bocadillos y marcas de alerta). */
  headWorld(): { x: number; y: number } {
    return this.rigToWorld(this.headNode.x, this.headNode.y - 150 * HEAD_SCALE);
  }

  /** Punto de la pata delantera izquierda. */
  leftPawWorld(): { x: number; y: number } {
    return this.rigToWorld(this.legFN.x, this.legFN.y + 100);
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
    if (!this.frozen) {
      this.earNow.near = damp(this.earNow.near, look.earNear, 9, dt);
      this.earNow.far = damp(this.earNow.far, look.earFar, 9, dt);
      this.crouchNow = damp(this.crouchNow, look.crouch, 7, dt);
    }

    this.earNear.rotation = this.earNow.near + Math.sin(this.clock * 1.7) * 0.028;
    this.earFar.rotation = this.earNow.far + Math.sin(this.clock * 1.31 + 1.2) * 0.034;

    // Respiración, peso y rebote al caminar.
    const breathe = this.frozen ? 0 : Math.sin(this.clock * 2.2);
    const bounce = this.motion > 0.02 ? Math.abs(Math.sin(this.walkPhase * 2)) * -5 * this.motion : 0;
    this.torso.scaleY = TORSO_H * (1 + breathe * 0.022);
    this.torso.scaleX = TORSO_W * (1 - breathe * 0.014);
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
    this.eyeFar.setOpen(damp(this.eyeFar.openScale, look.eyeOpen * 0.84, 10, dt));
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

  private updateLick(dt: number): void {
    if (!this.licking) return;
    this.lickPhase += dt * 13;
    const l = Math.sin(this.lickPhase);
    // Cabeza hacia abajo para encontrarse con la pata levantada.
    this.headNode.rotation = LICK_HEAD_ROTATION + l * 0.07;
    this.headNode.y = POSE_OFFSETS[this.pose].head + l * 3;
    this.headNode.x = POSE_OFFSETS[this.pose].headX;
    this.tonguePart.scaleY = 0.35 + (l * 0.5 + 0.5) * 0.85;
    this.tonguePart.y = 28 + l * 3;
  }
}
