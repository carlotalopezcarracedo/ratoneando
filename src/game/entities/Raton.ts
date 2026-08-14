import Phaser from 'phaser';
import { CHARACTERS, Layer, anchorOf, type LayerSpec } from '../art/CharacterRig';
import { PAL } from '../utils/palette';
import { CHARACTER_SCALE } from '../utils/constants';
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
  /** Apertura de las orejas: 0 = tiesas, positivo = abiertas hacia fuera. */
  earSpread: number;
  /** Cuánto se agacha el cuerpo, en píxeles de la ilustración. */
  crouch: number;
  tailSpeed: number;
  tailAmp: number;
  /** Inclinación de la cabeza y el cuerpo. */
  lean: number;
  blinkRate: number;
}

const LOOKS: Record<RatonExpression, Look> = {
  normal: { earSpread: 0.0, crouch: 0, tailSpeed: 1.6, tailAmp: 0.05, lean: 0, blinkRate: 3.6 },
  alert: { earSpread: -0.07, crouch: -6, tailSpeed: 2.8, tailAmp: 0.03, lean: -0.015, blinkRate: 5 },
  fear: { earSpread: 0.34, crouch: 18, tailSpeed: 0.5, tailAmp: 0.015, lean: 0.03, blinkRate: 6 },
  obsessed: { earSpread: -0.05, crouch: 4, tailSpeed: 7, tailAmp: 0.09, lean: -0.03, blinkRate: 5 },
  caught: { earSpread: 0.24, crouch: 8, tailSpeed: 0.2, tailAmp: 0.01, lean: 0.02, blinkRate: 9 },
  happy: { earSpread: 0.05, crouch: -4, tailSpeed: 9, tailAmp: 0.11, lean: -0.02, blinkRate: 2.6 },
  sleepy: { earSpread: 0.2, crouch: 10, tailSpeed: 0.7, tailAmp: 0.02, lean: 0.03, blinkRate: 1.6 }
};

const R = CHARACTERS.raton;
const ANCHOR = anchorOf(R.size);

/** Pivotes en coordenadas de la ilustración del personaje. */
const PIVOT = {
  earL: { x: 85, y: 170 },
  earR: { x: 226, y: 170 },
  paw: { x: 118, y: 352 }
};

/** Puntos de interés para efectos y bocadillos. */
const POINT = {
  nose: { x: 168, y: 236 },
  headTop: { x: 172, y: 60 },
  paw: { x: 112, y: 470 }
};

/** Ojos, para el parpadeo. */
const EYES = [
  { x: 116, y: 152, r: 19 },
  { x: 176, y: 149, r: 19 }
];

/** Pose de lamido: la pata delantera IZQUIERDA sube hasta el hocico. */
const LICK = { paw: -2.45, lean: 0.06 };

const POSE_DROP: Record<RatonPose, number> = { stand: 0, sit: 54, lie: 92 };

/**
 * Ratón.
 *
 * Es un montaje de capas recortadas de la ilustración maestra: cuerpo, oreja
 * izquierda, oreja derecha y pata delantera izquierda. La animación mueve esas
 * capas —nunca deforma el dibujo—, así que el personaje siempre se ve como en
 * la referencia.
 */
export class Raton extends Phaser.GameObjects.Container {
  /** Desplazamientos de salto/retroceso; los animan los tweens. */
  hopX = 0;
  hopY = 0;

  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly bodyNode: Phaser.GameObjects.Container;
  private readonly core: Layer;
  private readonly earL: Layer;
  private readonly earR: Layer;
  private readonly pawL: Layer;
  private readonly lids: Phaser.GameObjects.Ellipse[] = [];
  private readonly nut: Phaser.GameObjects.Image;

  private expression: RatonExpression = 'normal';
  private look: Look = LOOKS.normal;
  private pose: RatonPose = 'stand';

  private facing: -1 | 1 = -1;
  private motion = 0;
  private clock = 0;
  private walkPhase = 0;
  private blinkAt = 2;
  private trembling = false;
  private frozen = false;
  private licking = false;
  private lickPhase = 0;
  private pawHold = 0;
  private carrying = false;
  private cameraStare = 0;
  private stepTimer = 0;
  private perkTimer = 0;

  private earNow = 0;
  private crouchNow = 0;
  private dropNow = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 4, R.size.w * CHARACTER_SCALE * 0.62, 26, 0x000000, 0.28);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(CHARACTER_SCALE);
    this.add(this.rig);

    this.bodyNode = scene.add.container(0, 0);
    this.rig.add(this.bodyNode);

    // Las orejas van DETRÁS del cuerpo: así su arranque queda oculto bajo el
    // cráneo y no se ve la costura del recorte al moverlas.
    this.earL = new Layer(scene, R['ear-l'] as LayerSpec, ANCHOR, PIVOT.earL);
    this.earR = new Layer(scene, R['ear-r'] as LayerSpec, ANCHOR, PIVOT.earR);
    this.core = new Layer(scene, R.core as LayerSpec, ANCHOR);
    this.pawL = new Layer(scene, R['paw-l'] as LayerSpec, ANCHOR, PIVOT.paw);

    EYES.forEach((e) => {
      const lid = scene.add
        .ellipse(e.x - ANCHOR.x, e.y - ANCHOR.y, e.r * 2.1, e.r * 2.1, 0x241d18)
        .setScale(1, 0);
      this.lids.push(lid);
    });

    this.nut = scene.add
      .image(POINT.nose.x - ANCHOR.x + 6, POINT.nose.y - ANCHOR.y + 16, 'nut')
      .setScale(1.7)
      .setVisible(false);

    this.bodyNode.add([this.earL, this.earR, this.core, this.pawL, ...this.lids, this.nut]);

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
   * Ratón mira a cámara, así que cambiar de dirección sólo inclina el cuerpo
   * hacia donde va: nada de espejos que rompan la ilustración.
   */
  setFacing(dir: -1 | 1): this {
    this.facing = dir;
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
    return this;
  }

  setPose(pose: RatonPose): this {
    this.pose = pose;
    return this;
  }

  setMotion(speed01: number): this {
    this.motion = clamp(speed01, 0, 1);
    return this;
  }

  tremble(on: boolean): this {
    this.trembling = on;
    return this;
  }

  freeze(on: boolean): this {
    this.frozen = on;
    return this;
  }

  setCarryingNut(on: boolean): this {
    this.carrying = on;
    this.nut.setVisible(on);
    if (on) {
      this.nut.setScale(0);
      this.scene.tweens.add({ targets: this.nut, scale: 1.7, duration: 240, ease: 'Back.easeOut' });
    }
    return this;
  }

  /** La mirada la lleva la ilustración; sólo se guarda para inclinar la cabeza. */
  lookAt(worldX: number, _worldY: number): this {
    const dir = Math.sign(worldX - this.x);
    this.bodyNode.rotation = damp(this.bodyNode.rotation, dir * 0.02, 6, 0.016);
    return this;
  }

  lookForward(): this {
    return this;
  }

  lookAtCamera(seconds = 2.6): this {
    this.cameraStare = seconds;
    return this;
  }

  /** Orejas tiesas de golpe: Ratón ha oído algo antes de verlo. */
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
    t.killTweensOf(this.pawL);
    t.add({ targets: this.pawL, rotation: LICK.paw, duration: 260, ease: 'Back.easeOut' });
    t.add({ targets: this.bodyNode, rotation: LICK.lean, duration: 260, ease: 'Quad.easeOut' });
    return this;
  }

  stopLick(): this {
    if (!this.licking) return this;
    this.licking = false;
    this.pawHold = 0;
    const t = this.scene.tweens;
    t.killTweensOf(this.pawL);
    t.add({ targets: this.pawL, rotation: 0, duration: 220, ease: 'Quad.easeInOut' });
    t.add({ targets: this.bodyNode, rotation: 0, duration: 220, ease: 'Quad.easeInOut' });
    return this;
  }

  /** Interrumpe el lamido: la pata se queda un instante en el aire. */
  abortLick(): this {
    if (!this.licking) return this;
    this.licking = false;
    this.pawHold = 1;
    const t = this.scene.tweens;
    t.killTweensOf(this.pawL);
    this.pawL.rotation = LICK.paw;
    t.add({ targets: this.bodyNode, rotation: 0, duration: 180 });
    t.add({ targets: this.pawL, rotation: 0, duration: 300, delay: 640, ease: 'Back.easeIn' });
    return this;
  }

  bark(opts: { fx?: boolean; power?: number; depth?: number } = {}): this {
    if (this.frozen) return this;
    const power = opts.power ?? (Save.data.ratonMode ? 1.45 : 1);
    const t = this.scene.tweens;
    t.add({ targets: this, hopY: -14, duration: 90, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this.bodyNode, rotation: -0.035, duration: 90, yoyo: true });
    this.earNow = -0.09;

    Audio.bark(power);
    if (opts.fx !== false) {
      const m = this.muzzleWorld();
      barkWave(this.scene, m.x, m.y, { scale: power, depth: opts.depth });
      floatText(this.scene, m.x, m.y - 46, '¡GUAU!', {
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
    this.scene.tweens.add({
      targets: this,
      hopY: -42,
      duration: 260,
      yoyo: true,
      repeat: 2,
      ease: 'Quad.easeOut'
    });
    return this;
  }

  recoilJump(dir: -1 | 1 = 1): this {
    this.setExpression('caught');
    const t = this.scene.tweens;
    t.add({ targets: this, hopY: -86, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this, hopX: dir * 46, duration: 200, yoyo: true, ease: 'Quad.easeOut' });
    t.add({ targets: this.bodyNode, rotation: dir * 0.12, duration: 200, yoyo: true });
    puff(this.scene, this.x, this.y, { count: 8, spread: 70 });
    return this;
  }

  // ------------------------------------------------------------- posiciones

  private point(p: { x: number; y: number }): { x: number; y: number } {
    const s = CHARACTER_SCALE * this.scaleX;
    return {
      x: this.x + (p.x - ANCHOR.x) * s + this.hopX * CHARACTER_SCALE,
      y: this.y + (p.y - ANCHOR.y + this.dropNow) * s + this.hopY * CHARACTER_SCALE
    };
  }

  muzzleWorld(): { x: number; y: number } {
    return this.point(POINT.nose);
  }

  headWorld(): { x: number; y: number } {
    return this.point({ x: POINT.headTop.x, y: POINT.headTop.y - 40 });
  }

  leftPawWorld(): { x: number; y: number } {
    return this.point(POINT.paw);
  }

  // ------------------------------------------------------------------- loop

  tick(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;
    const look = this.look;

    if (this.pawHold > 0) this.pawHold -= dt;
    if (this.cameraStare > 0) this.cameraStare -= dt;
    if (this.perkTimer > 0) this.perkTimer -= dt;

    // Orejas en espejo, con el aviso anticipado por encima.
    const earTarget = this.perkTimer > 0 ? LOOKS.alert.earSpread : look.earSpread;
    if (!this.frozen) {
      this.earNow = damp(this.earNow, earTarget, this.perkTimer > 0 ? 20 : 8, dt);
      this.crouchNow = damp(this.crouchNow, look.crouch, 7, dt);
    }
    const sway = Math.sin(this.clock * 1.6) * 0.012;
    this.earL.rotation = -this.earNow + sway;
    this.earR.rotation = this.earNow - sway * 0.8;

    // Respiración: escala uniforme mínima, nunca deforma la ilustración.
    const breathe = this.frozen ? 0 : Math.sin(this.clock * 2.1);
    const bob = this.motion > 0.02 ? Math.abs(Math.sin(this.walkPhase)) * -7 * this.motion : 0;
    this.bodyNode.setScale(1 + breathe * 0.008);

    this.dropNow = damp(this.dropNow, POSE_DROP[this.pose] + this.crouchNow, 8, dt);
    this.bodyNode.y = this.dropNow + bob;
    this.rig.y = this.hopY;
    this.rig.x = this.hopX + (this.trembling ? Math.sin(this.clock * 44) * 3 : 0);

    if (!this.licking && this.pawHold <= 0) {
      this.bodyNode.rotation = damp(this.bodyNode.rotation, look.lean, 6, dt);
    }

    // Parpadeo.
    this.blinkAt -= dt;
    if (this.blinkAt <= 0 && !this.frozen) {
      this.blinkAt = rand(look.blinkRate * 0.6, look.blinkRate * 1.5);
      this.scene.tweens.add({
        targets: this.lids,
        scaleY: 1,
        duration: 75,
        yoyo: true,
        ease: 'Quad.easeInOut'
      });
    }
    if (this.cameraStare > 0) this.lids.forEach((l) => (l.scaleY = 0));

    // Marcha: rebote y polvo. Las patas de la ilustración no se articulan.
    if (this.motion > 0.02 && !this.frozen) {
      this.walkPhase += dt * (7 + this.motion * 8);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.3 / (0.6 + this.motion);
        Audio.footstep();
        if (this.motion > 0.55) {
          puff(this.scene, this.x + rand(-14, 14), this.y - 2, { count: 2, spread: 18, scale: 0.6 });
        }
      }
    }

    if (this.licking) {
      this.lickPhase += dt * 12;
      this.pawL.rotation = LICK.paw + Math.sin(this.lickPhase) * 0.05;
      this.bodyNode.rotation = LICK.lean + Math.sin(this.lickPhase) * 0.012;
    }

    const lift = clamp(-this.hopY / 90, 0, 1);
    this.shadow.setScale(1 - lift * 0.35);
    this.shadow.setAlpha(0.28 * (1 - lift * 0.55));
  }
}
