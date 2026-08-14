export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Los SVG se rasterizan al doble de tamaño; las Part los dibujan a 0.5. */
export const SVG_LOAD_SCALE = 2;
export const SVG_DISPLAY_SCALE = 1 / SVG_LOAD_SCALE;

export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MENU: 'MainMenuScene',
  INTRO: 'IntroScene',
  HOW_TO: 'HowToPlayScene',
  LEVEL_SELECT: 'LevelSelectScene',
  LEVEL_INTRO: 'LevelIntroScene',
  LEVEL1: 'Level1Scene',
  LEVEL2: 'Level2Scene',
  LEVEL3: 'Level3Scene',
  RESULT: 'ResultScene',
  FINAL: 'FinalScene',
  CREDITS: 'CreditsScene',
  PAUSE: 'PauseScene'
} as const;

export const FONT_TITLE = '"Baloo 2", "Trebuchet MS", "Segoe UI", sans-serif';
export const FONT_UI = 'Nunito, "Segoe UI", system-ui, sans-serif';

export const SAVE_KEY = 'raton-misiones-secretas.v1';

/** Puntuación de CAOS. Ajustado tras probar los tres niveles. */
export const CHAOS = {
  SUSPICIOUS_BEHAVIOUR: 100,
  CLANDESTINE_LICK: 120,
  GOOD_BARK: 200,
  BIKE_DODGED: 60,
  PANIC_SURVIVED: 150,
  CHECKPOINT: 150,
  DISTRACTION: 120,
  NUT_STOLEN: 400,
  MISSION_COMPLETE: 500,
  CAUGHT: -100,
  SPEED_BONUS_MAX: 500
} as const;

export const RANKS: ReadonlyArray<{ min: number; title: string; blurb: string }> = [
  {
    min: 4000,
    title: 'RATÓN DEFINITIVO',
    blurb: 'No queda nada que enseñarle. Y eso da bastante miedo.'
  },
  {
    min: 2500,
    title: 'AGENTE DEL CAOS',
    blurb: 'Opera de noche. Y de día. Y a la hora de la siesta.'
  },
  {
    min: 1000,
    title: 'PEQUEÑO DELINCUENTE',
    blurb: 'Reincidente. Adorable. Sin remordimientos.'
  },
  {
    min: 0,
    title: 'PERRO SOSPECHOSAMENTE NORMAL',
    blurb: 'Nadie se lo cree, pero técnicamente no hay pruebas.'
  }
];

export function rankFor(chaos: number): { title: string; blurb: string } {
  const found = RANKS.find((r) => chaos >= r.min);
  return found ?? RANKS[RANKS.length - 1];
}

export const LOADING_MESSAGES: readonly string[] = [
  'Ratón está tomando malas decisiones…',
  'Localizando bicicletas…',
  'Calculando probabilidad de conseguir una nuez…',
  'Preparando comportamiento sospechoso…',
  'Negando todas las acusaciones…',
  'Midiendo el tamaño real de las orejas…',
  'Fingiendo que no ha pasado nada…',
  'Repasando la lista de enemigos con ruedas…',
  'Buscando una pata que lamer…',
  'Comprobando si alguien está mirando…'
];

/** Frases del monólogo interior de Ratón. */
export const THOUGHTS = {
  bikeSpotted: ['AMENAZA DETECTADA', 'ESO TIENE RUEDAS', 'NO ME GUSTA'],
  nutSpotted: ['OBJETO PROBABLEMENTE COMESTIBLE', 'ESO ES MÍO AHORA'],
  caught: ['ABORTAR. ABORTAR.', 'YO NO HE SIDO', 'ESTO NO ES LO QUE PARECE'],
  idle: ['Nadie sospecha de un perro quieto.', 'Estoy completamente normal.'],
  nutStolen: ['La operación ha sido un éxito.'],
  failed: ['Ratón niega todas las acusaciones.']
} as const;

export const LEVELS = [
  {
    index: 1,
    scene: SCENES.LEVEL1,
    code: 'MISIÓN 01',
    title: 'OPERACIÓN PATA IZQUIERDA',
    subtitle: 'Objetivo: lamerte la pata sin levantar sospechas.'
  },
  {
    index: 2,
    scene: SCENES.LEVEL2,
    code: 'MISIÓN 02',
    title: 'LA GRAN TRAVESÍA',
    subtitle: 'El enemigo tiene dos ruedas.'
  },
  {
    index: 3,
    scene: SCENES.LEVEL3,
    code: 'MISIÓN 03',
    title: 'EL GRAN ROBO DE NUECES',
    subtitle: 'No son tuyas. Eso nunca ha sido un problema.'
  }
] as const;

export type LevelIndex = 1 | 2 | 3;
