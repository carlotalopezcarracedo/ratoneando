import Phaser from 'phaser';
import { SCENES, type LevelIndex } from '../utils/constants';
import { Save } from '../systems/SaveManager';
import { Audio } from '../systems/AudioManager';
import { Run } from '../systems/RunState';

/** `?nivel=2` abre directamente esa misión (útil para probar y para compartir). */
function requestedLevel(): LevelIndex | null {
  try {
    const raw = new URLSearchParams(window.location.search).get('nivel');
    const n = Number(raw);
    return n === 1 || n === 2 || n === 3 ? (n as LevelIndex) : null;
  } catch {
    return null;
  }
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.BOOT);
  }

  create(): void {
    Save.load();
    Audio.init();
    Run.reset();
    const characterTest = new URLSearchParams(window.location.search).has('personajes');
    this.scene.start(SCENES.PRELOAD, { jumpTo: requestedLevel(), characterTest });
  }
}
