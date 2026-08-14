# Referencia visual

## `raton-character-reference.png` — ESPECIFICACIÓN DE DISEÑO

Esta ilustración **define** el aspecto de los personajes. No es inspiración: el
arte del juego se extrae literalmente de ella.

```bash
npm run characters
```

recorta a Ratón y a su dueño de la ilustración, los trocea en capas (cuerpo,
orejas, pata, cabeza, torso, piernas), escribe los PNG con transparencia en
`public/assets/characters/` y guarda las posiciones exactas de cada capa en
`src/game/art/characters.json`. El juego recompone esas capas y las anima
moviéndolas; nunca redibuja el personaje.

Por eso los personajes del juego se ven como la ilustración: **son** la
ilustración.

Si cambias la imagen maestra, vuelve a lanzar `npm run characters` y revisa el
resultado en la escena de comparación (`?personajes`, o botón PERSONAJES dentro
de *Seleccionar misión*).

## `raton-y-hermano.jpg` — foto original

La fotografía real de Ratón y su dueño. Está en `.gitignore` **a propósito**:
es material personal y, al vivir dentro de `public/`, Vite la copiaría al build
y acabaría publicada en GitHub Pages. Se queda sólo en local.
