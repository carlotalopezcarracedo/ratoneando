/** Paleta común del juego: fondos cálidos, negros de Ratón, crema, marrones, verde apagado. */
export const PAL = {
  ink: 0x171110,
  inkSoft: 0x2a201c,

  fur: 0x241d1a,
  furDark: 0x140f0e,
  furLight: 0x3d3330,
  furSheen: 0x574a45,

  cream: 0xf3e3c8,
  creamDim: 0xd8c7a9,
  white: 0xf7efe1,

  wall: 0xe4c9a6,
  wallDeep: 0xcfa87f,
  wallShade: 0xb98d64,

  wood: 0xa8734a,
  woodDark: 0x74492b,
  woodLight: 0xc9955f,

  floor: 0xc79a6b,
  floorDark: 0x9a6f47,

  green: 0x6f8f5f,
  greenDark: 0x415a38,
  greenLight: 0x9dbb7f,

  danger: 0xe0603f,
  dangerDeep: 0xa8371f,
  amber: 0xe9a13b,
  ok: 0x7bb661,

  sky: 0xf0d3a4,
  skyDeep: 0xd8ae7d,
  asphalt: 0x6d6259,
  asphaltDark: 0x594f48,

  pop: 0x59b0c4,
  popDeep: 0x2f6d80
} as const;

export const css = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
