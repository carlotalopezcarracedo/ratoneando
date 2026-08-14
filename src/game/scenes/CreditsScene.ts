import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { Raton } from '../entities/Raton';
import { Button } from '../ui/Button';
import { Transition } from '../systems/Transition';
import { Audio } from '../systems/AudioManager';

const CREDITS: Array<[string, string]> = [
  ['Protagonista', 'Ratón'],
  ['Especialista en comportamiento sospechoso', 'Ratón'],
  ['Supervisor de bicicletas', 'Ratón'],
  ['Departamento de adquisición de nueces', 'Ratón'],
  ['Todas las decisiones cuestionables', 'Ratón'],
  ['Persona que aparece de repente', 'El dueño'],
  ['Antagonistas con ruedas', 'Las bicicletas'],
  ['Sonido y música', 'Sintetizados en el navegador'],
  ['Arte, animación y código', 'Hechos a mano para este proyecto']
];

export class CreditsScene extends Phaser.Scene {
  private raton!: Raton;
  private roll!: Phaser.GameObjects.Container;

  constructor() {
    super(SCENES.CREDITS);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add
      .text(GAME_WIDTH / 2, 74, 'CRÉDITOS', {
        fontFamily: FONT_TITLE,
        fontSize: '46px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5)
      .setDepth(100);

    this.roll = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT + 40);
    let y = 0;
    CREDITS.forEach(([role, who]) => {
      this.roll.add(
        this.add
          .text(0, y, role, {
            fontFamily: FONT_UI,
            fontSize: '16px',
            color: css(PAL.amber),
            fontStyle: '900'
          })
          .setOrigin(0.5)
      );
      this.roll.add(
        this.add
          .text(0, y + 26, who, {
            fontFamily: FONT_TITLE,
            fontSize: '32px',
            color: css(PAL.cream),
            fontStyle: '800'
          })
          .setOrigin(0.5)
      );
      y += 84;
    });

    this.roll.add(
      this.add
        .text(0, y + 30, 'Basado en hechos lamentablemente reales.', {
          fontFamily: FONT_UI,
          fontSize: '22px',
          color: css(PAL.creamDim),
          fontStyle: '800'
        })
        .setOrigin(0.5)
    );

    const total = y + 220;
    this.tweens.add({
      targets: this.roll,
      y: -total,
      duration: 26000,
      ease: 'Linear',
      repeat: -1
    });

    // Franjas para que el texto no invada la cabecera ni el pie.
    const mask = this.add.graphics().setDepth(90);
    mask.fillStyle(PAL.ink, 1);
    mask.fillRect(0, 0, GAME_WIDTH, 108);
    mask.fillRect(0, GAME_HEIGHT - 110, GAME_WIDTH, 110);

    this.raton = new Raton(this, 190, GAME_HEIGHT - 26);
    this.raton.setDepth(120).setScale(0.8);
    this.raton.setPose('sit').setExpression('happy');

    new Button(this, GAME_WIDTH - 180, GAME_HEIGHT - 56, 'VOLVER', () => Transition.to(this, SCENES.MENU), {
      width: 220,
      height: 52,
      fontSize: 21,
      variant: 'secondary'
    }).setDepth(120);

    this.input.keyboard?.once('keydown-ESC', () => Transition.to(this, SCENES.MENU));
    Audio.playMusic('menu');
    Transition.reveal(this);
  }

  override update(_time: number, delta: number): void {
    this.raton.tick(delta);
  }
}
