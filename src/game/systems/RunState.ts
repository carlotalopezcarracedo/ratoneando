import { Save } from './SaveManager';
import type { LevelIndex } from '../utils/constants';

export interface RunStats {
  chaos: number;
  caught: number;
  barks: number;
  bikesBarked: number;
  bikeHits: number;
  clandestineLicks: number;
  distractions: number;
  nuts: number;
  timeMs: number;
  levelChaos: [number, number, number];
  levelDone: [boolean, boolean, boolean];
}

const empty = (): RunStats => ({
  chaos: 0,
  caught: 0,
  barks: 0,
  bikesBarked: 0,
  bikeHits: 0,
  clandestineLicks: 0,
  distractions: 0,
  nuts: 0,
  timeMs: 0,
  levelChaos: [0, 0, 0],
  levelDone: [false, false, false]
});

/** Estado de la partida actual (los tres niveles seguidos). */
class RunStateManager {
  private stats: RunStats = empty();

  get s(): Readonly<RunStats> {
    return this.stats;
  }

  get chaosMultiplier(): number {
    return Save.data.ratonMode ? 2 : 1;
  }

  reset(): void {
    this.stats = empty();
  }

  /** Añade CAOS al total de la partida. Devuelve lo realmente sumado. */
  addChaos(amount: number, level?: LevelIndex): number {
    const value = amount > 0 ? Math.round(amount * this.chaosMultiplier) : amount;
    this.stats.chaos = Math.max(0, this.stats.chaos + value);
    if (level) this.stats.levelChaos[level - 1] = Math.max(0, this.stats.levelChaos[level - 1] + value);
    return value;
  }

  bump<K extends 'caught' | 'barks' | 'bikesBarked' | 'bikeHits' | 'clandestineLicks' | 'distractions' | 'nuts'>(
    key: K,
    by = 1
  ): void {
    this.stats[key] += by;
  }

  addTime(ms: number): void {
    this.stats.timeMs += ms;
  }

  completeLevel(level: LevelIndex): void {
    this.stats.levelDone[level - 1] = true;
    Save.unlockLevel(Math.min(3, level + 1));
    Save.recordLevelScore(level, this.stats.levelChaos[level - 1]);
  }

  finishRun(): void {
    Save.recordRun(this.stats.chaos);
  }

  /** Estadísticas absurdas para la pantalla final. */
  get absurdStats(): Array<[string, string]> {
    const s = this.stats;
    return [
      ['Bicicletas consideradas enemigas', `${s.bikesBarked + s.barks + 3}`],
      ['Ladridos emitidos', `${s.barks}`],
      ['Nueces sustraídas', `${s.nuts}`],
      ['Lamidos clandestinos', `${s.clandestineLicks}`],
      ['Veces descubierto', `${s.caught}`],
      ['Objetos tirados "sin querer"', `${s.distractions}`],
      ['Arrepentimiento', '0%'],
      ['Coartadas preparadas', `${Math.max(1, s.caught * 2 + 1)}`]
    ];
  }
}

export const Run = new RunStateManager();
