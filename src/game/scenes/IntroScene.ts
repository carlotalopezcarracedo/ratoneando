import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { Raton } from '../entities/Raton';
import { Transition } from '../systems/Transition';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { Button } from '../ui/Button';
import { alertMark } from '../art/FX';

interface Beat {
  text: string;
  sub?: string;
  at: number;
  action?: () => void;
}

export class IntroScene extends Phaser.Scene {
  private raton!: Raton;
  private line!: Phaser.GameObjects.Text;
  private subline!: Phaser.GameObjects.Text;
  private done = false;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor() {
    super(SCENES.INTRO);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(PAL.wallShade, 0.25);
    g.fillEllipse(GAME_WIDTH / 2, 640, 900, 220);

    this.raton = new Raton(this, GAME_WIDTH / 2, 560);
    this.raton.setPose('sit');

    this.line = this.add
      .text(GAME_WIDTH / 2, 190, '', {
        fontFamily: FONT_TITLE,
        fontSize: '48px',
        color: css(PAL.cream),
        fontStyle: '800',
        align: 'center',
        wordWrap: { width: 980 }
      })
      .setOrigin(0.5);

    this.subline = this.add
      .text(GAME_WIDTH / 2, 262, '', {
        fontFamily: FONT_UI,
        fontSize: '22px',
        color: css(PAL.amber),
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: 900 }
      })
      .setOrigin(0.5);

    const skip = new Button(this, GAME_WIDTH - 110, GAME_HEIGHT - 52, 'SALTAR', () => this.finish(), {
      width: 150,
      height: 44,
      fontSize: 17,
      variant: 'ghost'
    });
    skip.setAlpha(0.8);

    const beats: Beat[] = [
      {
        at: 300,
        text: 'Este es Ratón.',
        sub: 'Perro pequeño. Orejas enormes. Vida interior intensísima.',
        action: () => this.raton.setExpression('normal')
      },
      {
        at: 3200,
        text: 'Ratón tiene tres obsesiones.',
        sub: 'Ninguna de ellas es razonable.',
        action: () => this.raton.setExpression('alert')
      },
      {
        at: 6200,
        text: 'Lamerse la pata izquierda en secreto.',
        sub: 'La izquierda. Siempre la izquierda.',
        action: () => {
          this.raton.setExpression('obsessed');
          this.raton.startLick();
        }
      },
      {
        at: 9200,
        text: 'Cruzar delante de las bicicletas.',
        sub: 'Enemigos con ruedas. Sin excepciones.',
        action: () => {
          this.raton.stopLick();
          this.raton.setExpression('fear').tremble(true);
          this.cameras.main.shake(220, 0.004);
        }
      },
      {
        at: 12200,
        text: 'Y robar nueces que no son suyas.',
        sub: 'Eso nunca ha sido un problema.',
        action: () => {
          this.raton.tremble(false);
          this.raton.setExpression('obsessed');
          Audio.nut();
        }
      },
      {
        at: 15400,
        text: 'Hoy hará las tres.',
        sub: 'Nadie sospecha de un perro quieto.',
        action: () => {
          this.raton.setExpression('caught');
          const h = this.raton.headWorld();
          alertMark(this, h.x + 46, h.y, '!', PAL.amber);
          this.raton.lookAtCamera(3);
        }
      }
    ];

    beats.forEach((b) => {
      this.timers.push(
        this.time.delayedCall(b.at, () => {
          this.showBeat(b.text, b.sub ?? '');
          b.action?.();
        })
      );
    });
    this.timers.push(this.time.delayedCall(18600, () => this.finish()));

    this.input.keyboard?.once('keydown-SPACE', () => this.finish());
    this.input.keyboard?.once('keydown-ESC', () => this.finish());

    Audio.playMusic('menu');
    Transition.reveal(this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.timers.forEach((t) => t.remove());
      this.timers = [];
    });
  }

  private showBeat(text: string, sub: string): void {
    this.line.setText(text).setAlpha(0).setScale(0.94);
    this.subline.setText(sub).setAlpha(0);
    this.tweens.add({ targets: this.line, alpha: 1, scale: 1, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.subline, alpha: 1, duration: 420, delay: 160 });
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    Save.patch({ seenIntro: true });
    Transition.to(this, SCENES.LEVEL_INTRO, { level: 1 });
  }

  override update(_time: number, delta: number): void {
    this.raton.tick(delta);
  }
}
