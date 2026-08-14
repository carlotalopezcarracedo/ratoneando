import Phaser from 'phaser';
import { Part } from '../art/Part';
import { PAL } from '../utils/palette';
import { clamp, damp } from '../utils/helpers';

export type HumanActivity = 'idle' | 'typing' | 'phone' | 'walking' | 'searching' | 'startled';
export type HumanPose = 'stand' | 'sit';

const FAR_TINT = 0x9b918c;
const HEAD_X = -2;
const HEAD_Y = -390;
const HIP_Y = -224;
const SHOULDER_Y = -392;
const HEAD_SCALE = 0.92;

/** Centros de los ojos del SVG de la cabeza, en coordenadas locales. */
const EYE_A = { x: -15, y: -82 };
const EYE_B = { x: 21, y: -86 };

interface HumanOptions {
  shirt?: number;
  scale?: number;
  beanie?: boolean;
}

/**
 * El dueño de Ratón (y el NPC secundario del nivel 3): alto y delgado, con
 * sudadera negra. La cabeza gira de forma independiente del cuerpo, que es lo
 * que el jugador tiene que leer para saber si le están viendo.
 */
export class Human extends Phaser.GameObjects.Container {
  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;

  private readonly thighNear: Part;
  private readonly thighFar: Part;
  private readonly shinNear: Part;
  private readonly shinFar: Part;
  private readonly torso: Part;
  private readonly armNear: Part;
  private readonly armFar: Part;
  private readonly phone: Part;

  private readonly headNode: Phaser.GameObjects.Container;
  private readonly headTurn: Phaser.GameObjects.Container;
  private readonly pupilA: Phaser.GameObjects.Ellipse;
  private readonly pupilB: Phaser.GameObjects.Ellipse;
  private readonly irisA: Phaser.GameObjects.Ellipse;
  private readonly irisB: Phaser.GameObjects.Ellipse;
  private readonly lids: Phaser.GameObjects.Container;

  private facing: -1 | 1 = -1;
  private gazeDir: -1 | 1 = -1;
  private activity: HumanActivity = 'idle';
  private pose: HumanPose = 'stand';
  private clock = 0;
  private walkPhase = 0;
  private motion = 0;
  private blinkAt = 2;
  private pupilTarget = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene, x: number, y: number, opts: HumanOptions = {}) {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 6, 150, 32, 0x000000, 0.24);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(opts.scale ?? 0.75);
    this.add(this.rig);

    // Piernas con rodilla: muslo + pantorrilla encadenada, para poder sentarse.
    this.thighFar = new Part(scene, 'owner-thigh', -12, HIP_Y - 16, 0.5, 0.04).tint(FAR_TINT);
    this.shinFar = new Part(scene, 'owner-shin', 0, 114, 0.5, 0.05).tint(FAR_TINT);
    this.thighFar.add(this.shinFar);

    this.thighNear = new Part(scene, 'owner-thigh', 12, HIP_Y - 14, 0.5, 0.04);
    this.shinNear = new Part(scene, 'owner-shin', 0, 114, 0.5, 0.05);
    this.thighNear.add(this.shinNear);
    this.armFar = new Part(scene, 'owner-arm', -24, SHOULDER_Y - 4, 0.5, 0.05).tint(FAR_TINT);
    this.torso = new Part(scene, 'owner-body', 0, HIP_Y, 0.5, 0.95);
    if (opts.shirt) this.torso.tint(opts.shirt);
    this.armNear = new Part(scene, 'owner-arm', 24, SHOULDER_Y, 0.5, 0.05);
    if (opts.shirt) {
      this.armNear.tint(opts.shirt);
      this.armFar.tint(Phaser.Display.Color.IntegerToColor(opts.shirt).darken(20).color);
    }

    this.phone = new Part(scene, 'owner-phone', 0, 156, 0.5, 0.5);
    this.phone.setVisible(false);
    this.armNear.add(this.phone);

    // ---- cabeza
    this.headNode = scene.add.container(HEAD_X, HEAD_Y);
    this.headTurn = scene.add.container(0, 0);
    this.headTurn.setScale(HEAD_SCALE);
    const skull = new Part(scene, 'owner-head', 0, 0, 0.5, 0.88);

    // Los ojos van pintados en el SVG; aquí sólo la pupila (mirada) y el
    // párpado (parpadeo), colocados justo encima de cada ojo.
    const irisA = scene.add.ellipse(EYE_A.x, EYE_A.y, 11, 11, 0x6b4423);
    const irisB = scene.add.ellipse(EYE_B.x, EYE_B.y, 10, 10, 0x6b4423);
    this.pupilA = scene.add.ellipse(EYE_A.x, EYE_A.y, 6, 6, 0x140f0c);
    this.pupilB = scene.add.ellipse(EYE_B.x, EYE_B.y, 5.5, 5.5, 0x140f0c);
    this.irisA = irisA;
    this.irisB = irisB;

    this.lids = scene.add.container(0, 0);
    const lidA = scene.add.ellipse(EYE_A.x, EYE_A.y, 22, 17, 0xe0a97d);
    const lidB = scene.add.ellipse(EYE_B.x, EYE_B.y, 20, 16, 0xe0a97d);
    this.lids.add([lidA, lidB]);
    this.lids.scaleY = 0;

    this.headTurn.add([skull, irisA, irisB, this.pupilA, this.pupilB, this.lids]);

    if (opts.beanie) {
      const beanie = scene.add.container(0, 0);
      const cap = scene.add.ellipse(0, -122, 116, 72, PAL.green);
      const brim = scene.add.rectangle(0, -98, 120, 22, PAL.greenDark).setOrigin(0.5);
      const bobble = scene.add.circle(0, -154, 15, PAL.creamDim);
      beanie.add([cap, brim, bobble]);
      this.headTurn.add(beanie);
    }

    this.headNode.add(this.headTurn);

    this.rig.add([
      this.thighFar,
      this.armFar,
      this.thighNear,
      this.torso,
      this.headNode,
      this.armNear
    ]);

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
    if (this.gazeDir === dir && this.headTurn.scaleX === wanted * HEAD_SCALE) return this;
    this.gazeDir = dir;
    this.scene.tweens.add({
      targets: this.headTurn,
      scaleX: wanted * HEAD_SCALE,
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
      // Muslo hacia delante y pantorrilla vertical: rodilla en ángulo recto.
      t.add({ targets: this.rig, y: 86, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.thighNear, rotation: 1.32, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.thighFar, rotation: 1.2, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.shinNear, rotation: -1.3, duration: 300, ease: 'Quad.easeOut' });
      t.add({ targets: this.shinFar, rotation: -1.16, duration: 300, ease: 'Quad.easeOut' });
    } else {
      t.add({ targets: this.rig, y: 0, duration: 300, ease: 'Quad.easeOut' });
      t.add({
        targets: [this.thighNear, this.thighFar, this.shinNear, this.shinFar],
        rotation: 0,
        duration: 300,
        ease: 'Quad.easeOut'
      });
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
        break;
      case 'phone':
        t.add({ targets: this.armNear, rotation: -1.42, duration: 300, ease: 'Quad.easeOut' });
        t.add({ targets: this.armFar, rotation: -0.28, duration: 300, ease: 'Quad.easeOut' });
        break;
      case 'searching':
        t.add({ targets: this.armNear, rotation: -0.34, duration: 260 });
        t.add({ targets: this.armFar, rotation: 0.22, duration: 260 });
        break;
      case 'startled':
        t.add({ targets: this.armNear, rotation: 0.55, duration: 160, ease: 'Back.easeOut' });
        t.add({ targets: this.armFar, rotation: -0.55, duration: 160, ease: 'Back.easeOut' });
        break;
      case 'walking':
        t.add({ targets: [this.armNear, this.armFar], rotation: 0, duration: 200 });
        break;
      default:
        t.add({ targets: this.armNear, rotation: 0.06, duration: 260 });
        t.add({ targets: this.armFar, rotation: -0.05, duration: 260 });
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
      y: this.y + (this.rig.y + this.headNode.y - 80) * this.rig.scaleY
    };
  }

  /** Origen del cono de visión: a la altura de los ojos. */
  eyeWorld(): { x: number; y: number } {
    return {
      x: this.x + (this.rig.x + this.headNode.x) * this.rig.scaleX,
      y: this.y + (this.rig.y + this.headNode.y - 70) * this.rig.scaleY
    };
  }

  tick(delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;

    const breathe = Math.sin(this.clock * 1.9);
    this.torso.scaleY = 1 + breathe * 0.011;
    this.headNode.y = HEAD_Y + breathe * 2.4;

    this.pupilA.x = damp(this.pupilA.x, EYE_A.x + this.pupilTarget.x, 12, dt);
    this.pupilB.x = damp(this.pupilB.x, EYE_B.x + this.pupilTarget.x, 12, dt);
    this.pupilA.y = damp(this.pupilA.y, EYE_A.y + this.pupilTarget.y, 12, dt);
    this.pupilB.y = damp(this.pupilB.y, EYE_B.y + this.pupilTarget.y, 12, dt);
    this.irisA.setPosition(this.pupilA.x, this.pupilA.y);
    this.irisB.setPosition(this.pupilB.x, this.pupilB.y);

    this.blinkAt -= dt;
    if (this.blinkAt <= 0) {
      this.blinkAt = 2.4 + Math.random() * 3.2;
      this.scene.tweens.add({
        targets: this.lids,
        scaleY: 1,
        duration: 90,
        yoyo: true,
        ease: 'Quad.easeInOut'
      });
    }

    if (this.activity === 'typing') {
      this.armNear.rotation = -1.02 + Math.sin(this.clock * 15) * 0.05;
      this.armFar.rotation = -0.92 + Math.sin(this.clock * 15 + 1.7) * 0.05;
    }

    if (this.motion > 0.02) {
      this.walkPhase += dt * (6 + this.motion * 5);
      const amp = 0.38 + this.motion * 0.18;
      this.thighNear.rotation = Math.sin(this.walkPhase) * amp;
      this.thighFar.rotation = Math.sin(this.walkPhase + Math.PI) * amp;
      // La pantorrilla va un poco retrasada: así la rodilla se dobla al andar.
      this.shinNear.rotation = Math.min(0, Math.sin(this.walkPhase - 0.9)) * amp * 1.5;
      this.shinFar.rotation = Math.min(0, Math.sin(this.walkPhase + Math.PI - 0.9)) * amp * 1.5;
      if (this.activity === 'walking') {
        this.armNear.rotation = Math.sin(this.walkPhase + Math.PI) * 0.3;
        this.armFar.rotation = Math.sin(this.walkPhase) * 0.3;
      }
      this.rig.y = Math.abs(Math.sin(this.walkPhase)) * -6;
    } else if (this.pose === 'stand') {
      this.thighNear.rotation = damp(this.thighNear.rotation, 0, 9, dt);
      this.thighFar.rotation = damp(this.thighFar.rotation, 0, 9, dt);
      this.shinNear.rotation = damp(this.shinNear.rotation, 0, 9, dt);
      this.shinFar.rotation = damp(this.shinFar.rotation, 0, 9, dt);
      this.rig.y = damp(this.rig.y, 0, 9, dt);
    }
  }
}
