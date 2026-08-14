# RATÓN: MISIONES SECRETAS — Plan técnico

## 0. Estado del repositorio al empezar

El repositorio estaba **vacío**. En particular **no existe** el archivo
`public/reference/raton-y-hermano.jpg` (se ha buscado también en Descargas,
Imágenes, Documentos y Escritorio del usuario). El diseño de los personajes se
basa por tanto en la descripción escrita del brief, que es suficientemente
detallada:

- **Ratón**: perro pequeño de pelo corto, cuerpo y hocico negros, manchas
  blancas en pecho y patas, ojos marrones enormes, orejas gigantes triangulares
  y erguidas, aspecto alerta y ligeramente caótico.
- **Dueño**: hombre joven, pelo oscuro corto, barba oscura, cejas marcadas,
  ropa negra, estilo sencillo.

Si más adelante se añade la foto en `public/reference/raton-y-hermano.jpg`, el
juego no cambia (no la carga en runtime): sirve sólo como referencia de arte.

## 1. Stack

- **Phaser 3** (`^3.80`), **TypeScript** estricto, **Vite 5**.
- Sin backend, sin base de datos, sin servicios externos obligatorios.
- Sin motor de físicas: colisiones AABB / distancias a mano (más ligero y
  totalmente controlable para el tipo de juego que es).
- `base: './'` en Vite → funciona en `https://usuario.github.io/repo/`.

## 2. Arte

Dos técnicas combinadas, sin assets de terceros:

1. **SVG originales** en `public/assets/` para todo lo orgánico: cada parte del
   cuerpo de Ratón y del dueño, bicicletas, ciclistas y props. Se cargan con
   `this.load.svg()` al doble de la resolución de pantalla y se dibujan a 0.5
   para quedar nítidos en pantallas grandes.
2. **Graphics procedurales** (`src/game/art/props.ts`) para el mobiliario y los
   escenarios: son formas rectas, se benefician de gradientes y sombras
   generados y permiten reutilizar un mismo constructor con parámetros.

**Rig de Ratón**: contenedor con capas independientes (cola, patas traseras,
cuerpo, cabeza con oreja lejana / cráneo / oreja cercana / ojos / boca / lengua,
patas delanteras). Todo se anima con tweens + osciladores en `update`, lo que
permite mover orejas, ojos, cola y cabeza por separado. **El rig mira a la
izquierda por defecto**: así el flanco visible es el izquierdo y la pata
delantera **izquierda** queda en primer plano, que es el chiste central del
nivel 1.

**Ojos**: elipses de Phaser (esclerótica, iris marrón, pupila, brillo) en vez de
SVG, para poder exagerarlos, dilatarlos y parpadear con tweens.

## 3. Escenas

`Boot → Preload → MainMenu → Intro → (LevelIntro → LevelN → Result)×3 → Final`
más `HowToPlay`, `LevelSelect`, `Credits` y `Pause` (superpuesta).

Se unifican `Level1ResultScene`/`Level2ResultScene` en una única `ResultScene`
parametrizada (mismo contenido, cero duplicación) y se añade `LevelIntroScene`
para las tarjetas de misión y los mensajes de carga humorísticos.

## 4. Sistemas comunes

- `AudioManager`: **Web Audio API 100% procedural** (ladrido, click, alerta,
  éxito, fallo, nuez, pasos, latido) + secuenciador propio para tres temas
  (menú, tensión, atraco). Mute persistente.
- `SaveManager`: `localStorage` (niveles desbloqueados, récords, mute, MODO
  RATÓN, borrar progreso).
- `RunState` (score manager): CAOS acumulado, veces descubierto, ladridos,
  bicis ladradas, nueces, tiempos.
- `Transition`: cortinilla característica con **las dos orejas de Ratón**
  entrando desde los lados.
- `TouchControls`: joystick + botones cuando hay pantalla táctil.

## 5. Niveles

1. **Operación Pata Izquierda** — sigilo estático de timing. Barras de
   *necesidad de lamer*, *progreso de lamido* y *sospecha*; FSM del dueño
   (trabajando / móvil / sospecha / mirando / levantándose) con cono de visión.
2. **La Gran Travesía** — Frogger con bicis. Mundo vertical de 1800 px, 8
   carriles, 2 checkpoints, medidor de pánico, ladrido con cooldown que ralentiza
   ciclistas pero llena el medidor de caos (y por tanto el tráfico).
3. **El Gran Robo de Nueces** — sigilo 2.5D: se mueve en X (lateral) e Y
   (profundidad) con ordenación por profundidad, conos de visión de dos NPCs
   ocluidos por muebles, distracciones interactivas, robo con `E` mantenida y
   huida con la nuez.

## 6. Orden de trabajo

Fases 1→12 tal y como pide el brief, terminando con `npm run build` limpio,
workflow de GitHub Pages y README.
