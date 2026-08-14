import { SAVE_KEY } from '../utils/constants';

export interface SaveData {
  unlocked: number;
  bestChaos: number;
  bestPerLevel: [number, number, number];
  muted: boolean;
  ratonMode: boolean;
  seenIntro: boolean;
  completedRun: boolean;
}

const DEFAULTS: SaveData = {
  unlocked: 1,
  bestChaos: 0,
  bestPerLevel: [0, 0, 0],
  muted: false,
  ratonMode: false,
  seenIntro: false,
  completedRun: false
};

class SaveManager {
  private state: SaveData = { ...DEFAULTS, bestPerLevel: [0, 0, 0] };

  get data(): Readonly<SaveData> {
    return this.state;
  }

  load(): void {
    this.state = { ...DEFAULTS, bestPerLevel: [0, 0, 0] };
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      this.state = {
        unlocked: clampLevel(parsed.unlocked),
        bestChaos: numberOr(parsed.bestChaos, 0),
        bestPerLevel: [
          numberOr(parsed.bestPerLevel?.[0], 0),
          numberOr(parsed.bestPerLevel?.[1], 0),
          numberOr(parsed.bestPerLevel?.[2], 0)
        ],
        muted: parsed.muted === true,
        ratonMode: parsed.ratonMode === true,
        seenIntro: parsed.seenIntro === true,
        completedRun: parsed.completedRun === true
      };
    } catch {
      /* almacenamiento no disponible o corrupto: se juega sin guardado */
    }
  }

  private persist(): void {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      /* modo privado / cuota llena */
    }
  }

  patch(partial: Partial<SaveData>): void {
    this.state = { ...this.state, ...partial };
    this.persist();
  }

  unlockLevel(level: number): void {
    if (level > this.state.unlocked) this.patch({ unlocked: clampLevel(level) });
  }

  recordLevelScore(level: number, chaos: number): void {
    const idx = clampLevel(level) - 1;
    if (chaos > this.state.bestPerLevel[idx]) {
      const next: [number, number, number] = [...this.state.bestPerLevel];
      next[idx] = chaos;
      this.patch({ bestPerLevel: next });
    }
  }

  recordRun(chaos: number): void {
    const patch: Partial<SaveData> = { completedRun: true };
    if (chaos > this.state.bestChaos) patch.bestChaos = chaos;
    this.patch(patch);
  }

  clear(): void {
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignorado */
    }
    const muted = this.state.muted;
    this.state = { ...DEFAULTS, bestPerLevel: [0, 0, 0], muted };
    this.persist();
  }
}

function numberOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clampLevel(v: unknown): number {
  const n = numberOr(v, 1);
  return Math.min(3, Math.max(1, Math.round(n)));
}

export const Save = new SaveManager();
