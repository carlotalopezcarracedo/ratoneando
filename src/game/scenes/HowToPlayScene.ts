import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Transition } from '../systems/Transition';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { floatText } from '../art/FX';

const CONTROLS: Array<[string, string]> = [
  ['WASD  /  FLECHAS', 'Mover a Ratón'],
  ['ESPACIO', 'Acción principal: lamer (M1) · ladrar (M2/M3)'],
  ['E', 'Interactuar: disimular (M1) · robar y empujar (M3)'],
  ['M', 'Silenciar / activar sonido'],
  ['ESC  /  P', 'Pausa'],
  ['MÓVIL', 'Joystick a la izquierda, botones a la derecha']
];

const RULES: string[] = [
  'CAOS es la puntuación. Se gana haciendo cosas muy propias de Ratón.',
  'Que te pillen resta CAOS, pero Ratón lo negará igualmente.',
  'Las tres misiones se pueden reintentar al instante.',
  'El progreso se guarda solo en este navegador.'
];

export class HowToPlayScene extends Phaser.Scene {
  constructor() {
    super(SCENES.HOW_TO);
  }

  create(): void {
    const g = this.add.graphics();
    g.fillGradientStyle(PAL.inkSoft, PAL.inkSoft, PAL.ink, PAL.ink, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawPanel(g, 90, 92, GAME_WIDTH - 180, 500, { radius: 26, fillAlpha: 0.94 });

    this.add
      .text(GAME_WIDTH / 2, 142, 'CÓMO JUGAR', {
        fontFamily: FONT_TITLE,
        fontSize: '52px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5);

    CONTROLS.forEach(([key, desc], i) => {
      const y = 214 + i * 46;
      const chip = this.add.graphics();
      chip.fillStyle(PAL.amber, 0.92);
      chip.fillRoundedRect(140, y - 17, 250, 34, 10);
      this.add
        .text(265, y, key, {
          fontFamily: FONT_UI,
          fontSize: '16px',
          color: css(PAL.ink),
          fontStyle: '900'
        })
        .setOrigin(0.5);
      this.add
        .text(414, y, desc, {
          fontFamily: FONT_UI,
          fontSize: '19px',
          color: css(PAL.cream),
          fontStyle: '700'
        })
        .setOrigin(0, 0.5);
    });

    RULES.forEach((rule, i) => {
      this.add
        .text(148, 500 + i * 24, `·  ${rule}`, {
          fontFamily: FONT_UI,
          fontSize: '16px',
          color: css(PAL.creamDim),
          fontStyle: '600'
        })
        .setOrigin(0, 0.5);
    });

    new Button(this, 240, GAME_HEIGHT - 60, 'VOLVER', () => Transition.to(this, SCENES.MENU), {
      width: 220,
      height: 54,
      fontSize: 22,
      variant: 'secondary'
    });

    new Button(this, GAME_WIDTH - 250, GAME_HEIGHT - 60, 'BORRAR PROGRESO', () => this.wipe(), {
      width: 300,
      height: 54,
      fontSize: 19,
      variant: 'ghost'
    });

    this.input.keyboard?.once('keydown-ESC', () => Transition.to(this, SCENES.MENU));
    Transition.reveal(this);
  }

  private wipe(): void {
    Save.clear();
    Audio.fail();
    floatText(this, GAME_WIDTH - 250, GAME_HEIGHT - 120, 'PROGRESO BORRADO', {
      color: PAL.danger,
      size: 26,
      title: true
    });
    floatText(this, GAME_WIDTH - 250, GAME_HEIGHT - 90, 'Ratón no recuerda nada. Como siempre.', {
      color: PAL.creamDim,
      size: 16,
      rise: 40
    });
  }
}
