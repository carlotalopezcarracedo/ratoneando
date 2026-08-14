import Phaser from 'phaser';
import { Part } from '../art/Part';
import { rand, pick, damp } from '../utils/helpers';
import { Audio } from '../systems/AudioManager';

export type BikeKind = 'city' | 'road' | 'mtb' | 'slowpoke' | 'rocket' | 'tiny';

interface BikeSpec {
  frame: string;
  wheel: string;
  scale: number;
  speed: [number, number];
  jersey?: number;
  label?: string;
}

const SPECS: Record<BikeKind, BikeSpec> = {
  city: { frame: 'bike-city', wheel: 'wheel-fat', scale: 0.9, speed: [160, 210] },
  road: { frame: 'bike-road', wheel: 'wheel-slim', scale: 0.92, speed: [300, 380], jersey: 0xf0a24f },
  mtb: { frame: 'bike-mtb', wheel: 'wheel-fat', scale: 0.98, speed: [215, 265], jersey: 0x8fbf63 },
  slowpoke: { frame: 'bike-city', wheel: 'wheel-fat', scale: 0.95, speed: [62, 82], jersey: 0xc7b8d6, label: 'MUY LENTO' },
  rocket: { frame: 'bike-road', wheel: 'wheel-slim', scale: 0.9, speed: [520, 600], jersey: 0xe0603f, label: '¡DEMASIADO RÁPIDO!' },
  tiny: { frame: 'bike-city', wheel: 'wheel-fat', scale: 0.3, speed: [120, 150], label: 'BICI MINÚSCULA' }
};

const JERSEYS = [0xf2f0ea, 0x59b0c4, 0xe9a13b, 0x9dbb7f, 0xd9788f, 0xf0f0f0];

export class Bicycle extends Phaser.GameObjects.Container {
  readonly kind: BikeKind;
  readonly dir: -1 | 1;

  private readonly rig: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly wheelRear: Part;
  private readonly wheelFront: Part;
  private readonly legNear: Part;
  private readonly legFar: Part;
  private readonly rider: Part;

  private baseSpeed: number;
  private speedNow: number;
  private slowUntil = 0;
  private slowFactor = 1;
  private pedalPhase = 0;
  private clock = 0;
  private wobble = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, kind: BikeKind, dir: -1 | 1) {
    super(scene, x, y);
    this.kind = kind;
    this.dir = dir;
    const spec = SPECS[kind];

    this.baseSpeed = rand(spec.speed[0], spec.speed[1]);
    this.speedNow = this.baseSpeed;

    this.shadow = scene.add.ellipse(0, 4, 210 * spec.scale, 30 * spec.scale, 0x000000, 0.22);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.rig.setScale(spec.scale * (dir === 1 ? 1 : -1), spec.scale);
    this.add(this.rig);

    this.wheelRear = new Part(scene, spec.wheel, -57, -30, 0.5, 0.5);
    this.wheelFront = new Part(scene, spec.wheel, 55, -30, 0.5, 0.5);
    const frame = new Part(scene, spec.frame, -91, -92, 0, 0);

    this.legFar = new Part(scene, 'cyclist-leg', -29, -64, 0.5, 0.08);
    this.legFar.setScale(0.62);
    this.legFar.tint(0xa79b94);
    this.legNear = new Part(scene, 'cyclist-leg', -27, -64, 0.5, 0.08);
    this.legNear.setScale(0.62);

    this.rider = new Part(scene, 'cyclist-body', -29, -66, 0.3061, 0.9231);
    this.rider.tint(spec.jersey ?? pick(JERSEYS));

    this.rig.add([this.wheelRear, this.legFar, frame, this.rider, this.legNear, this.wheelFront]);

    scene.add.existing(this);
  }

  get label(): string | undefined {
    return SPECS[this.kind].label;
  }

  get halfWidth(): number {
    return 96 * SPECS[this.kind].scale;
  }

  get currentSpeed(): number {
    return this.speedNow;
  }

  /** Un ladrido oportuno frena al ciclista y le hace zigzaguear. */
  spook(now: number): void {
    this.slowUntil = now + 1400;
    this.slowFactor = 0.34;
    this.wobble = 1;
    if (Math.random() < 0.35) Audio.bell();
  }

  override update(now: number, delta: number): void {
    const dt = Math.min(0.05, delta / 1000);
    this.clock += dt;

    const target = now < this.slowUntil ? this.baseSpeed * this.slowFactor : this.baseSpeed;
    this.speedNow = damp(this.speedNow, target, 4.5, dt);
    this.x += this.speedNow * this.dir * dt;

    const wheelSpin = (this.speedNow / 55) * dt * this.dir;
    this.wheelRear.rotation += wheelSpin;
    this.wheelFront.rotation += wheelSpin;

    this.pedalPhase += dt * (this.speedNow / 26);
    this.legNear.rotation = -0.34 + Math.sin(this.pedalPhase) * 0.52;
    this.legFar.rotation = -0.34 + Math.sin(this.pedalPhase + Math.PI) * 0.52;

    this.wobble = damp(this.wobble, 0, 2.2, dt);
    this.rig.y = Math.sin(this.clock * 9) * 1.6 + Math.sin(this.clock * 21) * this.wobble * 4;
    this.rider.rotation = Math.sin(this.clock * 21) * this.wobble * 0.18;
  }
}
