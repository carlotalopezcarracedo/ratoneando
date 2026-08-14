import './style.css';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { Audio } from './game/systems/AudioManager';

function hideSplash(): void {
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  window.setTimeout(() => splash.remove(), 500);
}

const timeout = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * Intenta tener las fuentes listas antes de que Phaser mida texto, pero nunca
 * bloquea más de lo razonable: sin conexión el juego arranca igual.
 */
async function waitForFonts(): Promise<void> {
  if (!('fonts' in document)) return;
  const load = (async () => {
    try {
      await Promise.all([
        document.fonts.load('800 40px "Baloo 2"'),
        document.fonts.load('900 20px "Nunito"'),
        document.fonts.load('700 18px "Nunito"')
      ]);
      await document.fonts.ready;
    } catch {
      /* se usan las fuentes de sistema del fallback */
    }
  })();
  await Promise.race([load, timeout(2500)]);
}

async function boot(): Promise<void> {
  // Red de seguridad: pase lo que pase, el splash desaparece.
  const splashFallback = window.setTimeout(hideSplash, 6000);
  await waitForFonts();

  const game = new Phaser.Game(createGameConfig());

  game.events.once(Phaser.Core.Events.READY, () => {
    window.clearTimeout(splashFallback);
    window.setTimeout(hideSplash, 120);
  });

  // El audio sólo puede arrancar tras un gesto del usuario.
  const unlock = (): void => Audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: false, passive: true });
  window.addEventListener('keydown', unlock, { once: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) Audio.suspend();
    else Audio.resume();
  });
}

void boot();
