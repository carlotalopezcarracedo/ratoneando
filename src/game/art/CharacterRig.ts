import Phaser from 'phaser';
import manifest from './characters.json';

/**
 * Los personajes NO se dibujan por código: son recortes de la ilustración
 * maestra (`public/reference/raton-character-reference.png`), troceados en
 * capas por `tools/extract-characters.cjs`. Este módulo los recompone.
 *
 * Cada capa guarda su posición original dentro del personaje, así que basta
 * con colocarlas en esas coordenadas para que el personaje quede idéntico a la
 * referencia. La animación mueve capas; nunca redibuja nada.
 */

export interface LayerSpec {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EyeSpec {
  x: number;
  y: number;
  r: number;
}

export const CHARACTERS = manifest;

/** Todas las claves de textura que hay que precargar. */
export const CHARACTER_TEXTURES: string[] = [
  ...Object.values(manifest.raton),
  ...Object.values(manifest.owner)
]
  .filter((v): v is LayerSpec => typeof v === 'object' && v !== null && 'key' in v)
  .map((v) => v.key);

/**
 * Una capa del personaje. El contenedor se sitúa en el pivote, de modo que
 * rotarlo o escalarlo gira alrededor de ese punto y la ilustración no se
 * deforma nunca (siempre `setScale` uniforme).
 */
export class Layer extends Phaser.GameObjects.Container {
  readonly img: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    spec: LayerSpec,
    anchor: { x: number; y: number },
    pivot?: { x: number; y: number }
  ) {
    const px = pivot?.x ?? spec.x + spec.w / 2;
    const py = pivot?.y ?? spec.y + spec.h / 2;
    super(scene, px - anchor.x, py - anchor.y);
    this.img = scene.add.image(spec.x - px, spec.y - py, spec.key).setOrigin(0, 0);
    this.add(this.img);
  }
}

/** Punto de anclaje de un personaje: centro de los pies. */
export const anchorOf = (size: { w: number; h: number }): { x: number; y: number } => ({
  x: size.w / 2,
  y: size.h
});
