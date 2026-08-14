import Phaser from 'phaser';
import { FONT_TITLE, GAME_HEIGHT, GAME_WIDTH } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { clamp } from '../utils/helpers';

export interface TouchButtonSpec {
  key: string;
  label: string;
  color?: number;
}

export interface TouchControlsOptions {
  stick?: boolean;
  buttons?: TouchButtonSpec[];
}

/** ¿Merece la pena mostrar controles táctiles? */
export function needsTouch(scene: Phaser.Scene): boolean {
  const device = scene.sys.game.device;
  return device.input.touch && !device.os.desktop;
}

/** Joystick virtual + botones de acción para móvil/tablet. */
export class TouchControls extends Phaser.GameObjects.Container {
  private readonly vec = new Phaser.Math.Vector2(0, 0);
  private readonly held = new Set<string>();
  private readonly pressedThisFrame = new Set<string>();
  private stickPointerId = -1;
  private stickBase?: Phaser.GameObjects.Arc;
  private stickKnob?: Phaser.GameObjects.Arc;
  private readonly stickHome = new Phaser.Math.Vector2(150, GAME_HEIGHT - 150);

  constructor(scene: Phaser.Scene, opts: TouchControlsOptions = {}) {
    super(scene, 0, 0);
    this.setScrollFactor(0).setDepth(7000);

    scene.input.addPointer(3);

    if (opts.stick !== false) this.buildStick(scene);
    (opts.buttons ?? []).forEach((spec, i) => this.buildButton(scene, spec, i));

    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
      scene.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
      scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    });

    scene.add.existing(this);
  }

  private buildStick(scene: Phaser.Scene): void {
    this.stickBase = scene.add.circle(this.stickHome.x, this.stickHome.y, 76, PAL.ink, 0.28);
    this.stickBase.setStrokeStyle(4, PAL.cream, 0.45);
    this.stickKnob = scene.add.circle(this.stickHome.x, this.stickHome.y, 38, PAL.cream, 0.55);
    this.stickKnob.setStrokeStyle(3, PAL.ink, 0.6);
    this.add([this.stickBase, this.stickKnob]);
  }

  private buildButton(scene: Phaser.Scene, spec: TouchButtonSpec, index: number): void {
    const x = GAME_WIDTH - 120 - (index % 2) * 168;
    const y = GAME_HEIGHT - 130 - Math.floor(index / 2) * 150;
    const circle = scene.add.circle(x, y, 62, spec.color ?? PAL.danger, 0.72);
    circle.setStrokeStyle(4, PAL.cream, 0.75);
    const label = scene.add
      .text(x, y, spec.label, {
        fontFamily: FONT_TITLE,
        fontSize: '22px',
        color: css(PAL.cream),
        fontStyle: '800',
        align: 'center'
      })
      .setOrigin(0.5);

    circle.setInteractive({ useHandCursor: true });
    circle.on('pointerdown', () => {
      this.held.add(spec.key);
      this.pressedThisFrame.add(spec.key);
      circle.setScale(0.9);
    });
    const release = (): void => {
      this.held.delete(spec.key);
      circle.setScale(1);
    };
    circle.on('pointerup', release);
    circle.on('pointerout', release);

    this.add([circle, label]);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.stickBase || this.stickPointerId !== -1) return;
    if (pointer.x > GAME_WIDTH * 0.48) return;
    this.stickPointerId = pointer.id;
    this.stickHome.set(
      clamp(pointer.x, 110, GAME_WIDTH * 0.45),
      clamp(pointer.y, 220, GAME_HEIGHT - 90)
    );
    this.stickBase.setPosition(this.stickHome.x, this.stickHome.y);
    this.onPointerMove(pointer);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.stickPointerId || !this.stickKnob) return;
    const dx = pointer.x - this.stickHome.x;
    const dy = pointer.y - this.stickHome.y;
    const len = Math.hypot(dx, dy);
    const max = 76;
    const k = len > max ? max / len : 1;
    this.stickKnob.setPosition(this.stickHome.x + dx * k, this.stickHome.y + dy * k);
    this.vec.set(clamp(dx / max, -1, 1), clamp(dy / max, -1, 1));
    if (this.vec.length() < 0.16) this.vec.set(0, 0);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.stickPointerId) return;
    this.stickPointerId = -1;
    this.vec.set(0, 0);
    this.stickKnob?.setPosition(this.stickHome.x, this.stickHome.y);
  }

  get vector(): Phaser.Math.Vector2 {
    return this.vec;
  }

  isDown(key: string): boolean {
    return this.held.has(key);
  }

  justPressed(key: string): boolean {
    return this.pressedThisFrame.has(key);
  }

  /** Llamar al final del update de la escena. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
