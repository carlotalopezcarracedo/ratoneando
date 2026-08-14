import Phaser from 'phaser';
import {
  CHARACTER_SCALE,
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
import { CHARACTERS } from '../art/CharacterRig';

/**
 * Banco de pruebas de los personajes: los pone uno al lado del otro sobre fondo
 * neutro, a escala de juego, al doble y en primer plano, para poder comparar
 * con `public/reference/raton-character-reference.png`.
 *
 * Se abre con `?personajes` o desde el menú de misiones.
 */
export class CharacterReferenceScene extends Phaser.Scene {
  private cast: Array<Raton | Human> = [];

  constructor() {
    super(SCENES.CHARACTER_TEST);
  }

  create(): void {
    this.cast = [];

    const g = this.add.graphics();
    g.fillStyle(0xe8d3b4, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Rejilla de referencia para juzgar alturas de un vistazo.
    g.lineStyle(1, 0x000000, 0.09);
    for (let y = 0; y < GAME_HEIGHT; y += 40) g.lineBetween(0, y, GAME_WIDTH, y);
    for (let x = 0; x < GAME_WIDTH; x += 40) g.lineBetween(x, 0, x, GAME_HEIGHT);

    const groundY = GAME_HEIGHT - 96;
    g.fillStyle(0xc79a6b, 1);
    g.fillRect(0, groundY, GAME_WIDTH, GAME_HEIGHT - groundY);
    g.lineStyle(3, 0x8a6642, 0.5);
    g.lineBetween(0, groundY, GAME_WIDTH, groundY);

    this.title();
    this.group(200, groundY, CHARACTER_SCALE, 'ESCALA DE JUEGO');
    this.group(560, groundY, CHARACTER_SCALE * 1.5, '×1,5');
    this.closeUp(1010, groundY);

    new Button(this, 110, 44, 'VOLVER', () => this.scene.start(SCENES.MENU), {
      width: 160,
      height: 44,
      fontSize: 17,
      variant: 'secondary'
    });

    this.input.keyboard?.once('keydown-ESC', () => this.scene.start(SCENES.MENU));
  }

  private title(): void {
    this.add
      .text(GAME_WIDTH / 2, 34, 'COMPARATIVA CON LA REFERENCIA', {
        fontFamily: FONT_TITLE,
        fontSize: '28px',
        color: css(PAL.ink),
        fontStyle: '800'
      })
      .setOrigin(0.5);

    const r = CHARACTERS.raton.size;
    const o = CHARACTERS.owner.size;
    const ratio = (o.h / r.h).toFixed(2);
    this.add
      .text(
        GAME_WIDTH / 2,
        64,
        `Ratón ${Math.round(r.h * CHARACTER_SCALE)} px · dueño ${Math.round(
          o.h * CHARACTER_SCALE
        )} px · proporción ${ratio} (la de la ilustración)`,
        { fontFamily: FONT_UI, fontSize: '15px', color: css(PAL.woodDark), fontStyle: '700' }
      )
      .setOrigin(0.5);
  }

  private group(x: number, groundY: number, scale: number, label: string): void {
    const dog = new Raton(this, x - 90, groundY);
    dog.setScale(scale / CHARACTER_SCALE);
    const man = new Human(this, x + 90, groundY, { scale });
    man.setActivity('idle');
    this.cast.push(dog, man);

    this.add
      .text(x, groundY + 28, label, {
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: css(PAL.ink),
        fontStyle: '900'
      })
      .setOrigin(0.5);
  }

  /** Primer plano: sólo las cabezas, para revisar caras y orejas. */
  private closeUp(x: number, groundY: number): void {
    const zoom = CHARACTER_SCALE * 3.4;
    // Se colocan muy por debajo del suelo para que sólo asomen las cabezas.
    const dog = new Raton(this, x - 100, groundY + 300);
    dog.setScale(zoom / CHARACTER_SCALE);
    const man = new Human(this, x + 120, groundY + 770, { scale: zoom });
    this.cast.push(dog, man);

    const mask = this.add.graphics().setDepth(500);
    mask.fillStyle(0xe8d3b4, 1);
    mask.fillRect(x - 250, groundY, GAME_WIDTH - (x - 250), GAME_HEIGHT - groundY);
    mask.lineStyle(3, 0x8a6642, 0.5);
    mask.lineBetween(x - 250, groundY, GAME_WIDTH, groundY);

    this.add
      .text(x, groundY + 28, 'PRIMER PLANO', {
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: css(PAL.ink),
        fontStyle: '900'
      })
      .setOrigin(0.5)
      .setDepth(600);
  }

  override update(_time: number, delta: number): void {
    this.cast.forEach((c) => c.tick(delta));
  }
}
