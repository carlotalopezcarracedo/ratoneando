import Phaser from 'phaser';
import { FONT_TITLE, FONT_UI, GAME_HEIGHT, GAME_WIDTH, SCENES } from '../utils/constants';
import { PAL, css } from '../utils/palette';
import { drawPanel } from '../ui/Panel';
import { Button } from '../ui/Button';
import { Audio } from '../systems/AudioManager';

export interface PauseData {
  from: string;
}

export class PauseScene extends Phaser.Scene {
  private from = SCENES.MENU as string;
  private soundBtn!: Button;

  constructor() {
    super(SCENES.PAUSE);
  }

  init(data: PauseData): void {
    this.from = data.from;
  }

  create(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, PAL.ink, 0.72);

    const g = this.add.graphics();
    drawPanel(g, GAME_WIDTH / 2 - 250, 150, 500, 420, { radius: 26 });
    this.add
      .text(GAME_WIDTH / 2, 214, 'PAUSA', {
        fontFamily: FONT_TITLE,
        fontSize: '58px',
        color: css(PAL.cream),
        fontStyle: '800'
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 264, 'Ratón está fingiendo que no pasa nada.', {
        fontFamily: FONT_UI,
        fontSize: '17px',
        color: css(PAL.creamDim),
        fontStyle: '700'
      })
      .setOrigin(0.5);

    new Button(this, GAME_WIDTH / 2, 330, 'CONTINUAR', () => this.resume(), {
      width: 320,
      height: 60,
      fontSize: 26
    });
    new Button(this, GAME_WIDTH / 2, 402, 'REINTENTAR', () => this.restart(), {
      width: 320,
      height: 54,
      fontSize: 22,
      variant: 'secondary'
    });
    this.soundBtn = new Button(this, GAME_WIDTH / 2, 468, this.label(), () => this.toggle(), {
      width: 320,
      height: 50,
      fontSize: 20,
      variant: 'ghost'
    });
    new Button(this, GAME_WIDTH / 2, 528, 'SALIR AL MENÚ', () => this.quit(), {
      width: 320,
      height: 50,
      fontSize: 20,
      variant: 'ghost'
    });

    this.input.keyboard?.on('keydown-ESC', () => this.resume());
    this.input.keyboard?.on('keydown-P', () => this.resume());
  }

  private label(): string {
    return Audio.isMuted ? 'SONIDO: OFF' : 'SONIDO: ON';
  }

  private toggle(): void {
    Audio.toggleMute();
    this.soundBtn.setText(this.label());
  }

  private resume(): void {
    this.scene.stop();
    this.scene.resume(this.from);
  }

  private restart(): void {
    this.scene.stop();
    this.scene.stop(this.from);
    this.scene.start(this.from);
  }

  private quit(): void {
    this.scene.stop();
    this.scene.stop(this.from);
    Audio.stopMusic();
    this.scene.start(SCENES.MENU);
  }
}
