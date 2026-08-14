# RATÓN: MISIONES SECRETAS

> **Un perro. Tres obsesiones. Cero autocontrol.**

Un pequeño videojuego 2D de navegador protagonizado por **Ratón**, un perro negro
de orejas descomunales con una vida interior mucho más intensa de lo razonable.
Tres misiones, tres mecánicas distintas y una única puntuación: el **CAOS**.

```
MISIÓN 01 · OPERACIÓN PATA IZQUIERDA   sigilo y timing
MISIÓN 02 · LA GRAN TRAVESÍA           cruzar entre bicicletas
MISIÓN 03 · EL GRAN ROBO DE NUECES     sigilo, conos de visión y hurto
```

Hecho con **Phaser 3 + TypeScript + Vite**. Sin backend, sin base de datos, sin
cuentas y sin servicios externos obligatorios: se sirve como sitio estático.

---

## Empezar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # comprueba tipos y compila a dist/
npm run preview   # sirve dist/ para verlo como en producción
```

`npm run typecheck` ejecuta sólo `tsc --noEmit`.

Requiere Node 18 o superior.

### Atajo útil

`?nivel=1`, `?nivel=2` o `?nivel=3` abren directamente esa misión:
`http://localhost:5173/?nivel=2`

---

## Controles

| Acción | Teclado | Móvil |
| --- | --- | --- |
| Mover | `WASD` o flechas | joystick (mitad izquierda) |
| Acción principal | `ESPACIO` — lamer (M1) · ladrar (M2 y M3) | botón grande derecho |
| Interactuar | `E` — disimular (M1) · robar y empujar objetos (M3) | botón `E` |
| Silenciar | `M` | botón *Sonido* del menú |
| Pausa | `ESC` o `P` | — |

En **Operación Pata Izquierda** hay que **mantener** `ESPACIO`; en las otras dos
misiones basta con pulsarlo.

<details>
<summary>Y algo más…</summary>

El código Konami (`↑ ↑ ↓ ↓ ← → ← → B A`) en el menú principal desbloquea el
**MODO RATÓN**: orejas un 20 % más grandes, ladridos más fuertes y CAOS ×2.
Hay cuatro secretos más repartidos por el juego.

</details>

---

## Cómo funciona cada misión

**Operación Pata Izquierda.** Ratón necesita lamerse la pata delantera
*izquierda* —siempre la izquierda— sin que su dueño lo vea. El dueño alterna
entre teclear, mirar el móvil, levantarse y girarse de golpe hacia Ratón; el
indicador sobre su cabeza pasa de `AHORA` a `· · ·` y a `¡QUIETO!`. Si te pilla
con la pata en el aire, sube el **medidor de sospecha**. `E` sirve para
disimular: bostezar, mirar una mosca o quedarse muy quieto.

**La Gran Travesía.** Diez carriles de bicicletas urbanas, de carretera y de
montaña, con dos zonas seguras que hacen de checkpoint y tres vidas. Cerca de
una bici sube el **medidor de pánico** (orejas verticales, ojos enormes,
temblor). `ESPACIO` ladra: asusta a los ciclistas cercanos y da CAOS, pero
también llena el **medidor de caos**, que a su vez aumenta el tráfico.

**El Gran Robo de Nueces.** Un salón-cocina en 2.5D con dos personas
patrullando y conos de visión que los muebles bloquean. Se puede pasar por
debajo de la mesa, esconderse tras el sofá y empujar objetos para hacer ruido y
desviar la atención. Mantén `E` junto al bote para robar la nuez; después Ratón
va más lento, no puede ladrar y es más fácil de detectar hasta llegar a su cama.

---

## Estructura

```text
public/
  assets/
    characters/   SVG originales de Ratón y su dueño, una capa por parte
    props/        bicicletas, ciclistas, nuez, bote, pelota, zapatilla…
    audio/        vacío a propósito: el sonido es procedural (ver README)
  reference/      material de referencia de arte (no se carga en runtime)
  favicon.svg

src/
  main.ts
  style.css
  game/
    config.ts
    scenes/       Boot · Preload · MainMenu · Intro · HowToPlay · LevelSelect
                  LevelIntro · Level1 · Level2 · Level3 · Result · Final
                  Credits · Pause
    entities/     Raton · Human · Bicycle · Eye
    systems/      AudioManager · SaveManager · RunState · Transition · Konami
    ui/           Button · Panel · ProgressBar · MissionHUD · Hint · TouchControls
    art/          Part · FX · props (mobiliario y escenarios procedurales)
    utils/        constants · palette · helpers
```

Dos apuntes sobre la arquitectura, por si sorprenden:

- `Level1ResultScene` y `Level2ResultScene` se unifican en una sola
  **`ResultScene`** parametrizada, y se añade **`LevelIntroScene`** para las
  tarjetas de misión y los mensajes de carga.
- No se usa motor de físicas. Las colisiones son AABB y distancias a mano, que
  es todo lo que necesitan estas tres mecánicas y pesa bastante menos.

---

## Arte y sonido

Todo es original y se genera de dos formas complementarias:

- **SVG propios** (`public/assets/`) para lo orgánico: cada parte del cuerpo de
  Ratón y del dueño es una capa independiente, de modo que orejas, ojos, cola,
  cabeza y patas se animan por separado con tweens de Phaser. Se rasterizan al
  doble de resolución para que se vean nítidos en pantallas grandes.
- **Graphics procedurales** (`src/game/art/props.ts`) para el mobiliario y los
  escenarios, que son formas rectas y se benefician de generar gradientes,
  sombras y variaciones por código.

Los ojos no son SVG sino formas de Phaser, para poder exagerarlos, dilatar las
pupilas y parpadear.

El audio se sintetiza **entero con la Web Audio API**: ladridos, alertas,
latidos, el golpe dramático del robo y tres temas musicales con un secuenciador
propio. No hay ni un archivo de audio, ni por tanto ninguna licencia de terceros.
Si prefieres usar audio grabado, `public/assets/audio/README.md` explica dónde
enchufarlo sin tocar las escenas.

---

## Guardado

En `localStorage`, bajo la clave `raton-misiones-secretas.v1`: misiones
desbloqueadas, mejor CAOS total, mejor CAOS por misión, sonido activado y MODO
RATÓN. Hay un botón **BORRAR PROGRESO** en *Cómo jugar*.

---

## Desplegar en GitHub Pages

El repositorio incluye `.github/workflows/deploy.yml`, que en cada push a `main`
instala, compila y publica `dist/` con las acciones oficiales de Pages.

1. Sube el repositorio a GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Haz push a `main`. El workflow deja la URL en la pestaña *Actions* y en
   *Settings → Pages*.

Vite está configurado con `base: './'`, así que las rutas son relativas y el
juego funciona igual en `https://usuario.github.io/nombre-repositorio/` que en
la raíz de un dominio propio. Todos los assets se cargan con `assetUrl()`, que
respeta `import.meta.env.BASE_URL`.

Para desplegar a mano en cualquier hosting estático basta con subir `dist/`.

---

## Compatibilidad

Resolución lógica **1280 × 720 (16:9)** escalada con `Phaser.Scale.FIT`, así que
se adapta a ordenador, portátil, tablet y móvil en horizontal. En dispositivos
táctiles aparecen un joystick virtual y los botones de acción de cada misión.

---

**Basado en hechos lamentablemente reales.**
