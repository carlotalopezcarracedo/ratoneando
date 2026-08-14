import Phaser from 'phaser';
import { Part } from '../art/Part';
import { PAL } from '../utils/palette';
import { clamp, damp } from '../utils/helpers';

export type HumanActivity = 'idle' | 'typing' | 'phone' | 'walking' | 'searching' | 'startled';
export type HumanPose = 'stand' | 'sit';

const FAR_TINT = 0x9b918c;
const HEAD_X = -6;
const HEAD_Y = -244;

interface HumanOptions {
  shirt?: number;
  scale?: number;
  beanie?: boolean;
}

/**
 * El dueño de Ratón (y el NPC secundario del nivel 3): rig por capas con cabeza
 * que gira de forma independiente, que es lo que el jugador tiene que leer.
 */
export class Human extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  private readonly legNear: Part;
  private readonly legFar: Part;
  private readonly torso: Part;
  private readonly armNear: Part;
  private readonly armFar: Part;
  private readonly phone: Part;

  private readonly headNode: Phaser.GameObjects.Container;
  private readonly headTurn: Phaser.GameObjects.Container;
  private readonly skull: Part;
  private readonly eyes: Phaser.GameObjects.Container;
  private readonly pupilA: Phaser.GameObjects.Ellipse;
  private readonly pupilB: Phaser.GameObjects.Ellipse;
  private readonly browA: Phaser.GameObjects.Rectangle;
  private readonly browB: Phaser.GameObjects.Rectangle;

  private facing: -1 | 1 = -1;
  private gazeDir: -1 | 1 = -1;
  private activity: HumanActivity = 'idle';
  private pose: HumanPose = 'stand';
  private clock = 0;
  private walkPhase = 0;
  private motion = 0;
  private blinkAt = 2;
  private pupilTarget = { x: 0, y: 0 };
  private browTarget = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: HumanOptions = {}) {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 6, 170, 36, 0x000000, 0.24);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(opts.scale ?? 0.9);
    this.add(this.rig);

    this.legFar = new Part(scene, 'owner-leg', -16, -100, 0.5, 0.04).tint(FAR_TINT);
    this.legNear = new Part(scene, 'owner-leg', 16, -100, 0.5, 0.04);
    this.armFar = new Part(scene, 'owner-arm', -22, -226, 0.5, 0.06).tint(FAR_TINT);
    this.torso = new Part(scene, 'owner-body', 0, -96, 0.5, 0.94);
    if (opts.shirt) this.torso.tint(opts.shirt);
    this.armNear = new Part(scene, 'owner-arm', 20, -222, 0.5, 0.06);
    if (opts.shirt) this.armNear.tint(opts.shirt);
    if (opts.shirt) this.armFar.tint(Phaser.Display.Color.IntegerToColor(opts.shirt).darken(20).color);

    this.phone = new Part(scene, 'owner-phone', 0, 86, 0.5, 0.5);
    this.phone.setVisible(false);
    this.armNear.add(this.phone);

    // ---- cabeza
    this.headNode = scene.add.container(HEAD_X, HEAD_Y);
    this.headTurn = scene.add.container(0, 0);
    this.skull = new Part(scene, 'owner-head', 0, 0, 0.5, 0.86);

    this.eyes = scene.add.container(0, 0);
    const whiteA = scene.add.ellipse(-17, -62, 15, 12, PAL.white);
    const whiteB = scene.add.ellipse(15, -66, 13, 11, PAL.white);
    whiteA.setStrokeStyle(2, 0x6d452c, 1);
    whiteB.setStrokeStyle(2, 0x6d452c, 1);
    this.pupilA = scene.add.ellipse(-17, -62, 7, 7, 0x1d1512);
    this.pupilB = scene.add.ellipse(15, -66, 6.4, 6.4, 0x1d1512);
    this.browA = scene.add.rectangle(-18, -77, 22, 6, 0x241d1a).setOrigin(0.5);
    this.browB = scene.add.rectangle(16, -81, 20, 6, 0x241d1a).setOrigin(0.5);
    this.browA.setAngle(-6);
    this.browB.setAngle(6);
    this.eyes.add([whiteA, whiteB, this.pupilA, this.pupilB, this.browA, this.browB]);

    this.headTurn.add([this.skull, this.eyes]);

    if (opts.beanie) {
      const beanie = scene.add.container(0, 0);
      const cap = scene.add.ellipse(0, -96, 108, 66, PAL.green);
      const brim = scene.add.rectangle(0, -70, 112, 20, PAL.greenDark).setOrigin(0.5);
      const bobble = scene.add.circle(0, -126, 14, PAL.creamDim);
      beanie.add([cap, brim, bobble]);
      this.headTurn.add(beanie);
    }

    this.headNode.add(this.headTurn);

    this.rig.add([this.legFar, this.armFar, this.legNear, this.torso, this.headNode, this.armNear]);

    scene.add.existing(this);
  }

  // ------------------------------------------------------------------ estado

  setFacing(dir: -1 | 1): this {
    this.facing = dir;
    this.rig.scaleX = Math.abs(this.rig.scaleX) * (dir === -1 ? 1 : -1);
    return this;
  }

  get facingDir(): -1 | 1 {
    return this.facing;
  }

  /** Hacia dónde mira la CABEZA (independiente del cuerpo): esa es la amenaza. */
  setGaze(dir: -1 | 1, tilt = 0): this {
    const wanted = dir === this.facing ? 1 : -1;
    if (this.gazeDir === dir && this.headTurn.scaleX === wanted && this.headNode.rotation === tilt) {
      return this;
    }
    this.gazeDir = dir;
    this.scene.tweens.add({
      targets: this.headTurn,
      scaleX: dir === this.facing ? 1 : -1,
      duration: 170,
      ease: 'Quad.easeInOut'
    });
    this.scene.tweens.add({
      targets: this.headNode,
      rotation: tilt,
      duration: 200,
      ease: 'Quad.easeInOut'
    });
    return this;
  }

  get gaze(): -1 | 1 {
    return this.gazeDir;
  }

  /** Dirección de mirada en el mundo, en radianes (0 = derecha). */
  get gazeAngle(): number {
    return this.gazeDir === 1 ? 0 : Math.PI;
  }

  setPose(pose: HumanPose): this {
    if (this.pose === pose) return this;
    this.pose = pose;
    const t = this.scene.tweens;
    if (pose === 'sit') {
      t.add({ targets: this.rig, y: 54, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.legNear, rotation: 1.22, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.legFar, rotation: 1.14, duration: 300, ease: 'Quad.easeOut' });
    } else {
      t.add({ targets: this.rig, y: 0, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: [this.legNear, this.legFar], rotation: 0, duration: 300, ease: 'Quad.easeOut' });
    }
    return this;
  }

  setActivity(activity: HumanActivity): this {
    if (this.activity === activity) return this;
    this.activity = activity;
    const t = this.scene.tweens;
    this.phone.setVisible(activity === 'phone');

    switch (activity) {
      case 'typing':
        t.add({ targets: this.armNear, rotation: -1.02, duration: 260, ease: 'Quad.easeOut' });
        t.add({ targets: this.armFar, rotation: -0.92, duration: 260, ease: 'Quad.easeOut' });
        this.browTarget = 0;
        break;
      case 'phone':
        t.add({ targets: this.armNear, rotation: -1.42, duration: 300, ease: 'Quad.easeOut' });
        t.add({ targets: this.armFar, rotation: -0.28, duration: 300, ease: 'Quad.easeOut' });
        this.browTarget = 0.08;
        break;
      case 'searching':
        t.add({ targets: this.armNear, rotation: -0.34, duration: 260 });
        t.add({ targets: this.armFar, rotation: 0.22, duration: 260 });
        this.browTarget = -0.16;
        break;
      case 'startled':
        t.add({ targets: this.armNear, rotation: 0.55, duration: 160, ease: 'Back.easeOut' });
        t.add({ targets: this.armFar, rotation: -0.55, duration: 160, ease: 'Back.easeOut' });
        this.browTarget = -0.3;
        break;
      case 'walking':
        t.add({ targets: [this.armNear, this.armFar], rotation: 0, duration: 200 });
        this.browTarget = 0;
        break;
      default:
        t.add({ targets: this.armNear, rotation: 0.06, duration: 260 });
        t.add({ targets: this.armFar, rotation: -0.05, duration: 260 });
        this.browTarget = 0;
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

  /** Micro-movimiento de las pupilas. */
  lookOffset(dx: number, dy: number): this {
    this.pupilTarget.x = clamp(dx, -1, 1) * 3.4;
    this.pupilTarget.y = clamp(dy, -1, 1) * 2.6;
    return this;
  }

  headWorld(): { x: number; y: number } {
    return {
      x: this.x + (this.rig.x + this.headNode.x) * this.rig.scaleX,
      y: this.y + (this.rig.y + this.headNode.y - 70) * this.rig.scaleY
    };
  }

  /** Origen del cono de visión. */
  eyeWorld(): { x: number; y: number } {
    return {
      x: this.x + (this.rig.x + this.headNode.x) * this.rig.scaleX,
      y: this.y + (this.rig.y + this.headNode.y - 60) * this.rig.scaleY
    };
  }

  tick(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;

    const breathe = Math.sin(this.clock * 1.9);
    this.torso.scaleY = 1 + breathe * 0.013;
    this.headNode.y = HEAD_Y + breathe * 2.2;

    this.pupilA.x = damp(this.pupilA.x, -17 + this.pupilTarget.x, 12, dt);
    this.pupilB.x = damp(this.pupilB.x, 15 + this.pupilTarget.x, 12, dt);
    this.pupilA.y = damp(this.pupilA.y, -62 + this.pupilTarget.y, 12, dt);
    this.pupilB.y = damp(this.pupilB.y, -66 + this.pupilTarget.y, 12, dt);

    this.browA.y = damp(this.browA.y, -77 + this.browTarget * 26, 10, dt);
    this.browB.y = damp(this.browB.y, -81 + this.browTarget * 26, 10, dt);

    this.blinkAt -= dt;
    if (this.blinkAt <= 0) {
      this.blinkAt = 2.4 + Math.random() * 3.2;
      this.scene.tweens.add({
        targets: this.eyes,
        scaleY: 0.08,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeInOut'
      });
    }

    if (this.activity === 'typing') {
      this.armNear.rotation = -1.02 + Math.sin(this.clock * 15) * 0.05;
      this.armFar.rotation = -0.92 + Math.sin(this.clock * 15 + 1.7) * 0.05;
    }

    if (this.motion > 0.02) {
      this.walkPhase += dt * (7 + this.motion * 6);
      const amp = 0.42 + this.motion * 0.2;
      this.legNear.rotation = Math.sin(this.walkPhase) * amp;
      this.legFar.rotation = Math.sin(this.walkPhase + Math.PI) * amp;
      if (this.activity === 'walking') {
        this.armNear.rotation = Math.sin(this.walkPhase + Math.PI) * 0.32;
        this.armFar.rotation = Math.sin(this.walkPhase) * 0.32;
      }
      this.rig.y = Math.abs(Math.sin(this.walkPhase)) * -5;
    } else if (this.pose === 'stand') {
      this.legNear.rotation = damp(this.legNear.rotation, 0, 9, dt);
      this.legFar.rotation = damp(this.legFar.rotation, 0, 9, dt);
      this.rig.y = damp(this.rig.y, 0, 9, dt);
    }
  }
}
