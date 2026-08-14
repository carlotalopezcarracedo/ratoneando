import Phaser from 'phaser';
import {
  FONT_TITLE,
  FONT_UI,
  GAME_HEIGHT,
  GAME_WIDTH,
  SCENES
} from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { Raton } from '../entities/Raton';
import { Human } from '../entities/Human';
import { Button } from '../ui/Button';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';
import { Transition } from '../systems/Transition';
import { listenKonami } from '../systems/Konami';
import { alertMark, confetti, floatText, sparkles } from '../art/FX';
import { makeRug, makeLamp, makePoster } from '../art/props';
import { rand } from '../utils/helpers';

export class MainMenuScene extends Phaser.Scene {
  private raton!: Raton;
  private owner!: Human;
  private soundBtn!: Button;
  private taps = 0;
  private skitEvents: Phaser.Time.TimerEvent[] = [];
  private ratonModeBadge?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.MENU);
  }

  create(): void {
    Run.reset();
    this.buildBackground();
    this.buildTitle();
    this.buildCast();
    this.buildButtons();
    this.buildFooter();

    listenKonami(this, () => this.unlockRatonMode());

    this.input.keyboard?.on('keydown-M', () => this.toggleSound());
    this.input.keyboard?.on('keydown-ENTER', () => this.startGame());

    Audio.playMusic('menu');
    Transition.reveal(this);
    this.time.delayedCall(700, () => this.runSkit());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.skitEvents.forEach((e) => e.remove());
      this.skitEvents = [];
    });
  }

  // ------------------------------------------------------------------ vista

  private buildBackground(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.wall, PAL.wallDeep, PAL.wallShade, PAL.wallShade, 1);
    g.fillRect(0, 0, GAME_WIDTH, 540);
    g.fillStyle(PAL.floorDark, 1);
    g.fillRect(0, 540, GAME_WIDTH, GAME_HEIGHT - 540);
    g.fillStyle(PAL.floor, 1);
    g.fillRect(0, 548, GAME_WIDTH, GAME_HEIGHT - 548);
    for (let i = 0; i < 7; i++) {
      g.lineStyle(2, PAL.floorDark, 0.45);
      g.lineBetween(0, 560 + i * 26, GAME_WIDTH, 560 + i * 26);
    }
    g.fillStyle(0xfff0cf, 0.14);
    g.fillTriangle(0, 0, 620, 0, 260, 540);

    this.add.existing(makeLamp(this, 1180, 548));
    this.add.existing(makePoster(this, 1060, 170, 'SE BUSCA\n(POR TODO)'));
    this.add.existing(makeRug(this, 880, 636, 520, 116));

    // motas de polvo flotando
    for (let i = 0; i < 26; i++) {
      const dot = this.add.circle(rand(0, GAME_WIDTH), rand(60, GAME_HEIGHT), rand(1.5, 3.4), 0xfff2d6, rand(0.2, 0.5));
      this.tweens.add({
        targets: dot,
        y: dot.y - rand(80, 260),
        x: dot.x + rand(-60, 60),
        alpha: 0,
        duration: rand(5000, 11000),
        repeat: -1,
        delay: rand(0, 4000)
      });
    }

    // viñeta
    const v = this.add.graphics();
    v.fillStyle(0x120c0a, 0.32);
    v.fillRect(0, 0, GAME_WIDTH, 44);
    v.fillRect(0, GAME_HEIGHT - 44, GAME_WIDTH, 44);
  }

  private buildTitle(): void {
    const title = this.add
      .text(360, 156, 'RATÓN', {
        fontFamily: FONT_TITLE,
        fontSize: '132px',
        color: css(PAL.cream),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 14
      })
      .setOrigin(0.5);
    title.setShadow(0, 10, '#00000066', 12, false, true);

    this.tweens.add({
      targets: title,
      scaleX: 1.02,
      scaleY: 0.98,
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const sub = this.add
      .text(360, 232, 'MISIONES SECRETAS', {
        fontFamily: FONT_TITLE,
        fontSize: '34px',
        color: css(PAL.amber),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 7
      })
      .setOrigin(0.5);

    this.add
      .text(360, 276, 'Un perro. Tres obsesiones. Cero autocontrol.', {
        fontFamily: FONT_UI,
        fontSize: '19px',
        color: css(PAL.cream),
        fontStyle: '700',
        stroke: css(PAL.ink),
        strokeThickness: 4
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: sub, y: 234, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private buildCast(): void {
    this.owner = new Human(this, 1480, 616, { scale: 0.86 });
    this.owner.setFacing(-1).setPose('stand').setActivity('idle');

    this.raton = new Raton(this, 900, 618);
    this.raton.setPose('sit').setExpression('normal');
    this.raton.setDepth(10);

    // Easter egg 1: cinco toques sobre Ratón.
    const hit = this.add
      .zone(900, 540, 220, 200)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.tapRaton());
  }

  private buildButtons(): void {
    const play = new Button(this, 360, 372, 'JUGAR', () => this.startGame(), {
      width: 300,
      height: 76,
      fontSize: 34
    });
    this.tweens.add({
      targets: play,
      scaleX: 1.03,
      scaleY: 1.03,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    new Button(this, 268, 460, 'CÓMO JUGAR', () => Transition.to(this, SCENES.HOW_TO), {
      width: 220,
      height: 54,
      fontSize: 20,
      variant: 'secondary'
    });

    this.soundBtn = new Button(this, 466, 460, this.soundLabel(), () => this.toggleSound(), {
      width: 160,
      height: 54,
      fontSize: 20,
      variant: 'secondary'
    });

    new Button(
      this,
      268,
      528,
      'MISIONES',
      () => Transition.to(this, SCENES.LEVEL_SELECT),
      { width: 220, height: 50, fontSize: 18, variant: 'ghost' }
    );

    new Button(this, 466, 528, 'CRÉDITOS', () => Transition.to(this, SCENES.CREDITS), {
      width: 160,
      height: 50,
      fontSize: 18,
      variant: 'ghost'
    });
  }

  private buildFooter(): void {
    const best = Save.data.bestChaos;
    if (best > 0) {
      this.add
        .text(360, 588, `RÉCORD DE CAOS · ${best}`, {
          fontFamily: FONT_UI,
          fontSize: '17px',
          color: css(PAL.amber),
          fontStyle: '900',
          stroke: css(PAL.ink),
          strokeThickness: 4
        })
        .setOrigin(0.5);
    }

    if (Save.data.ratonMode) this.showRatonModeBadge();

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 22, 'ESPACIO / E · acciones   ·   M · sonido   ·   ESC · pausa', {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: css(PAL.creamDim),
        fontStyle: '700'
      })
      .setOrigin(0.5)
      .setAlpha(0.75);
  }

  private showRatonModeBadge(): void {
    if (this.ratonModeBadge) return;
    this.ratonModeBadge = this.add
      .text(360, 620, '★ MODO RATÓN ACTIVO ★', {
        fontFamily: FONT_TITLE,
        fontSize: '22px',
        color: css(PAL.danger),
        fontStyle: '800',
        stroke: css(PAL.ink),
        strokeThickness: 6
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.ratonModeBadge,
      scale: 1.08,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // ---------------------------------------------------------------- acciones

  private soundLabel(): string {
    return Audio.isMuted ? 'SONIDO OFF' : 'SONIDO ON';
  }

  private toggleSound(): void {
    const muted = Audio.toggleMute();
    this.soundBtn.setText(muted ? 'SONIDO OFF' : 'SONIDO ON');
    if (!muted) Audio.playMusic('menu');
  }

  private startGame(): void {
    Run.reset();
    if (!Save.data.seenIntro) {
      Transition.to(this, SCENES.INTRO);
    } else {
      Transition.to(this, SCENES.LEVEL_INTRO, { level: 1 });
    }
  }

  private tapRaton(): void {
    this.taps++;
    this.raton.setExpression('alert');
    this.tweens.add({
      targets: this.raton,
      scaleX: 1.06,
      scaleY: 0.95,
      duration: 110,
      yoyo: true
    });
    if (this.taps >= 5) {
      this.taps = 0;
      this.raton.bark({ power: 1.3 });
      const head = this.raton.headWorld();
      this.time.delayedCall(420, () => {
        floatText(this, head.x, head.y - 40, '¿QUÉ?', {
          color: PAL.amber,
          size: 46,
          title: true,
          rise: 30
        });
        sparkles(this, head.x, head.y - 20, { count: 10 });
      });
    } else {
      Audio.hover();
    }
    this.time.delayedCall(900, () => this.raton.setExpression('normal'));
  }

  private unlockRatonMode(): void {
    if (Save.data.ratonMode) {
      floatText(this, GAME_WIDTH / 2, 340, 'YA ESTABA ACTIVO', { color: PAL.amber, size: 30, title: true });
      return;
    }
    Save.patch({ ratonMode: true });
    Audio.success();
    confetti(this, GAME_WIDTH / 2, 300, 40);
    floatText(this, GAME_WIDTH / 2, 320, 'MODO RATÓN DESBLOQUEADO', {
      color: PAL.danger,
      size: 44,
      title: true,
      rise: 40
    });
    floatText(this, GAME_WIDTH / 2, 380, 'Orejas +20% · ladridos más fuertes · CAOS x2', {
      color: PAL.cream,
      size: 22,
      rise: 30
    });
    this.showRatonModeBadge();
    this.raton.bark({ power: 1.5 });
  }

  // -------------------------------------------------------------------- skit

  /** El chiste de portada: Ratón intenta lamerse la pata sin que le vean. */
  private runSkit(): void {
    this.skitEvents = [];
    const seq: Array<[number, () => void]> = [
      [0, () => this.raton.setExpression('normal').lookAt(400, 560)],
      [1100, () => this.raton.lookAt(1400, 560).setExpression('alert')],
      [1100, () => this.raton.lookAt(300, 560)],
      [900, () => this.raton.setExpression('obsessed').lookAt(760, 700)],
      [700, () => this.raton.startLick()],
      [1600, () => this.enterOwner()],
      [900, () => this.caughtBeat()],
      [1900, () => this.exitOwner()],
      [2200, () => this.raton.setExpression('normal').lookForward()],
      [1200, () => this.runSkit()]
    ];

    let acc = 0;
    seq.forEach(([delay, fn]) => {
      acc += delay;
      this.skitEvents.push(this.time.delayedCall(acc, fn));
    });
  }

  private enterOwner(): void {
    this.owner.setActivity('walking').setMotion(0.7);
    this.tweens.add({
      targets: this.owner,
      x: 1160,
      duration: 1100,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.owner.setMotion(0).setActivity('idle');
        this.owner.setGaze(-1);
      }
    });
  }

  private caughtBeat(): void {
    const head = this.raton.headWorld();
    alertMark(this, head.x + 40, head.y - 20, '!', PAL.danger);
    Audio.alert();
    this.raton.abortLick();
    this.raton.setExpression('caught');
    this.cameras.main.shake(140, 0.003);
    this.time.delayedCall(700, () => {
      this.raton.setExpression('normal');
      this.raton.lookAt(200, 300);
    });
  }

  private exitOwner(): void {
    this.owner.setActivity('walking').setMotion(0.6);
    this.tweens.add({
      targets: this.owner,
      x: 1480,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: () => this.owner.setMotion(0).setActivity('idle')
    });
  }

  override update(_time: number, delta: number): void {
    this.raton.tick(delta);
    this.owner.tick(delta);
  }
}
