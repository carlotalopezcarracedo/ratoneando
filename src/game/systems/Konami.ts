import Phaser from 'phaser';

const SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA'
];

/**
 * Escucha el código Konami en una escena. Se limpia solo al apagarse la escena.
 */
export function listenKonami(scene: Phaser.Scene, onComplete: () => void): void {
  let index = 0;
  const handler = (event: KeyboardEvent): void => {
    if (event.code === SEQUENCE[index]) {
      index++;
      if (index === SEQUENCE.length) {
        index = 0;
        onComplete();
      }
    } else {
      index = event.code === SEQUENCE[0] ? 1 : 0;
    }
  };

  const keyboard = scene.input.keyboard;
  if (!keyboard) return;
  keyboard.on('keydown', handler);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', handler));
}
