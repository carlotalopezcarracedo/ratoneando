# Referencia visual

La fotografía de referencia va aquí:

```
public/reference/raton-y-hermano.jpg
```

## Es privada y no se publica

Las imágenes de esta carpeta están en `.gitignore`. Es a propósito: Vite copia
`public/` tal cual al build, así que si la foto estuviera en el repositorio
acabaría publicada en GitHub Pages. Se queda sólo en local.

El juego **no carga esta carpeta en tiempo de ejecución**: es material de
referencia para dibujar, nada más.

## Qué se sacó de la foto

**Ratón** — perro pequeño de pelo corto y negro, con **hocico largo y estrecho**
tipo podenco. Sus **orejas son enormes y se abren mucho hacia los lados**, casi
horizontales: es su rasgo más reconocible y define la silueta. Ojos redondos y
grandes, iris marrón claro. Babero blanco en el pecho y calcetines blancos en
las patas. Cuerpo delgado con la barriga recogida.

**El dueño** — joven alto y muy delgado (190 cm, 70 kg): hombros estrechos,
piernas largas. Pelo oscuro **rizado y con volumen**, barba completa que enlaza
con las patillas, cejas marcadas y rectas, **sudadera negra con capucha**.

Los assets están en `public/assets/characters/` como SVG originales, una capa
por parte del cuerpo (incluidas rodillas articuladas en el dueño).
