import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './utils/constants';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { IntroScene } from './scenes/IntroScene';
import { HowToPlayScene } from './scenes/HowToPlayScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { LevelIntroScene } from './scenes/LevelIntroScene';
import { Level1Scene } from './scenes/Level1Scene';
import { Level2Scene } from './scenes/Level2Scene';
import { Level3Scene } from './scenes/Level3Scene';
import { ResultScene } from './scenes/ResultScene';
import { FinalScene } from './scenes/FinalScene';
import { CreditsScene } from './scenes/CreditsScene';
import { PauseScene } from './scenes/PauseScene';

export function createGameConfig(): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#1b1412',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      expandParent: true
    },
    render: {
      antialias: true,
      roundPixels: false,
      powerPreference: 'high-performance'
    },
    dom: { createContainer: false },
    disableContextMenu: true,
    scene: [
      BootScene,
      PreloadScene,
      MainMenuScene,
      IntroScene,
      HowToPlayScene,
      LevelSelectScene,
      LevelIntroScene,
      Level1Scene,
      Level2Scene,
      Level3Scene,
      ResultScene,
      FinalScene,
      CreditsScene,
      PauseScene
    ]
  };
}
