import Phaser from 'phaser';
import { CHARACTERS, Layer, anchorOf, type LayerSpec } from '../art/CharacterRig';
import { CHARACTER_SCALE } from '../utils/constants';
import { clamp, damp } from '../utils/helpers';

export type HumanActivity = 'idle' | 'typing' | 'phone' | 'walking' | 'searching' | 'startled';
export type HumanPose = 'stand' | 'sit';

const O = CHARACTERS.owner;
const ANCHOR = anchorOf(O.size);

/** Pivotes en coordenadas de la ilustración del personaje. */
const PIVOT = {
  head: { x: 190, y: 246 },
  legL: { x: 256, y: 604 },
  legR: { x: 112, y: 604 }
};

/** Ojos, para el parpadeo. */
const EYES = [
  { x: 152, y: 118, r: 13 },
  { x: 202, y: 118, r: 13 }
];

/**
 * El dueño de Ratón (y el NPC secundario del nivel 3).
 *
 * Igual que Ratón: capas recortadas de la ilustración maestra —cabeza, torso y
 * las dos piernas—. La animación sólo las mueve. La cabeza gira ligeramente y
 * las pupilas no se tocan: para indicar hacia dónde mira basta con ladear la
 * cabeza, que es lo que hace una persona.
 */
export class Human extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly head: Layer;
  private readonly torso: Layer;
  private readonly legL: Layer;
  private readonly legR: Layer;
  private readonly lids: Phaser.GameObjects.Ellipse[] = [];

  private facing: -1 | 1 = -1;
  private gazeDir: -1 | 1 = -1;
  private gazeTilt = 0;
  private activity: HumanActivity = 'idle';
  private pose: HumanPose = 'stand';
  private clock = 0;
  private walkPhase = 0;
  private motion = 0;
  private blinkAt = 2;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    opts: { scale?: number; tint?: number } = {}
  ) {
    super(scene, x, y);
    const scale = opts.scale ?? CHARACTER_SCALE;

    this.shadow = scene.add.ellipse(0, 4, O.size.w * scale * 0.52, 24, 0x000000, 0.26);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(scale);
    this.add(this.rig);

    this.legR = new Layer(scene, O['leg-r'] as LayerSpec, ANCHOR, PIVOT.legR);
    this.legL = new Layer(scene, O['leg-l'] as LayerSpec, ANCHOR, PIVOT.legL);
    this.torso = new Layer(scene, O.torso as LayerSpec, ANCHOR);
    this.head = new Layer(scene, O.head as LayerSpec, ANCHOR, PIVOT.head);

    if (opts.tint) {
      [this.legR, this.legL, this.torso].forEach((l) => l.img.setTint(opts.tint as number));
    }

    EYES.forEach((e) => {
      const lid = scene.add
        .ellipse(e.x - PIVOT.head.x, e.y - PIVOT.head.y, e.r * 2.2, e.r * 2.2, 0xdda179)
        .setScale(1, 0);
      this.lids.push(lid);
      this.head.add(lid);
    });

    this.rig.add([this.legR, this.legL, this.torso, this.head]);

    scene.add.existing(this);
  }

  // ------------------------------------------------------------------ estado

  setFacing(dir: -1 | 1): this {
    this.facing = dir;
    return this;
  }

  get facingDir(): -1 | 1 {
    return this.facing;
  }

  /** Hacia dónde mira: se ladea la cabeza, sin voltear la ilustración. */
  setGaze(dir: -1 | 1, tilt = 0): this {
    if (this.gazeDir === dir && this.gazeTilt === tilt) return this;
    this.gazeDir = dir;
    this.gazeTilt = tilt;
    this.scene.tweens.add({
      targets: this.head,
      rotation: tilt + dir * 0.13,
      x: PIVOT.head.x - ANCHOR.x + dir * 9,
      duration: 220,
      ease: 'Quad.easeInOut'
    });
    return this;
  }

  get gaze(): -1 | 1 {
    return this.gazeDir;
  }

  get gazeAngle(): number {
    return this.gazeDir === 1 ? 0 : Math.PI;
  }

  setPose(pose: HumanPose): this {
    if (this.pose === pose) return this;
    this.pose = pose;
    const t = this.scene.tweens;
    if (pose === 'sit') {
      // Sentarse: baja el cuerpo y adelanta los muslos. Las piernas siguen
      // siendo la ilustración original, sólo rotadas desde la cadera.
      t.add({ targets: this.rig, y: 150, duration: 320, ease: 'Quad.easeOut' });
      t.add({ targets: this.legL, rotation: 0.5, duration: 320, ease: 'Quad.easeOut' });
      t.add({ targets: this.legR, rotation: -0.42, duration: 320, ease: 'Quad.easeOut' });
    } else {
      t.add({ targets: this.rig, y: 0, duration: 320, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legL, this.legR], rotation: 0, duration: 320, ease: 'Quad.easeOut' });
    }
    return this;
  }

  setActivity(activity: HumanActivity): this {
    if (this.activity === activity) return this;
    this.activity = activity;
    const t = this.scene.tweens;
    // Las manos van en el bolsillo canguro en la ilustración, así que la
    // actividad se lee sobre todo por la cabeza y por micro-movimiento.
    const tilt: Record<HumanActivity, number> = {
      idle: 0,
      typing: 0.1,
      phone: 0.16,
      walking: 0,
      searching: -0.08,
      startled: -0.14
    };
    t.add({ targets: this.head, rotation: tilt[activity] + this.gazeDir * 0.13, duration: 240 });
    if (activity === 'startled') {
      t.add({ targets: this.rig, y: this.rig.y - 14, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    }
    return this;
  }

  get currentActivity(): HumanActivity {
    return this.activity;
  }

  setMotion(speed01: number): this {
    this.motion = clamp(speed01, 0, 1);
    return this;
  }

  lookOffset(_dx: number, _dy: number): this {
    return this;
  }

  headWorld(): { x: number; y: number } {
    return {
      x: this.x + (PIVOT.head.x - ANCHOR.x) * this.rig.scaleX,
      y: this.y + (this.rig.y + PIVOT.head.y - ANCHOR.y - 140) * this.rig.scaleY
    };
  }

  /** Origen del cono de visión: a la altura de los ojos. */
  eyeWorld(): { x: number; y: number } {
    return {
      x: this.x + (PIVOT.head.x - ANCHOR.x) * this.rig.scaleX,
      y: this.y + (this.rig.y + EYES[0].y - ANCHOR.y) * this.rig.scaleY
    };
  }

  tick(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;

    // Respiración: escala uniforme mínima sobre el torso.
    const breathe = Math.sin(this.clock * 1.9);
    this.torso.setScale(1 + breathe * 0.005);
    this.head.y = PIVOT.head.y - ANCHOR.y + breathe * 2.5;

    this.blinkAt -= dt;
    if (this.blinkAt <= 0) {
      this.blinkAt = 2.6 + Math.random() * 3.4;
      this.scene.tweens.add({
        targets: this.lids,
        scaleY: 1,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeInOut'
      });
    }

    if (this.motion > 0.02) {
      this.walkPhase += dt * (5.5 + this.motion * 4);
      const amp = 0.22 + this.motion * 0.12;
      this.legL.rotation = Math.sin(this.walkPhase) * amp;
      this.legR.rotation = Math.sin(this.walkPhase + Math.PI) * amp;
      this.rig.y = Math.abs(Math.sin(this.walkPhase)) * -8;
      this.rig.rotation = Math.sin(this.walkPhase) * 0.01;
    } else if (this.pose === 'stand') {
      this.legL.rotation = damp(this.legL.rotation, 0, 8, dt);
      this.legR.rotation = damp(this.legR.rotation, 0, 8, dt);
      this.rig.y = damp(this.rig.y, 0, 8, dt);
      this.rig.rotation = damp(this.rig.rotation, 0, 8, dt);
    }
  }
}
