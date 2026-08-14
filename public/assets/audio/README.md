# Audio

**Este juego no necesita ningún archivo de audio.** Todo el sonido —ladridos,
clics, alertas, latidos, el golpe dramático del robo y los tres temas
musicales— se sintetiza en tiempo real con la Web Audio API desde
`src/game/systems/AudioManager.ts`. Así no hay descargas, ni licencias, ni
dependencias externas.

## Si quieres añadir audio propio

1. Deja aquí tus archivos (`.ogg` recomendado, con `.m4a` de respaldo para iOS).
   No uses material con copyright.
2. Cárgalos en `PreloadScene`:

   ```ts
   this.load.audio('bark', [assetUrl('assets/audio/bark.ogg'), assetUrl('assets/audio/bark.m4a')]);
   ```

3. En `AudioManager`, sustituye el cuerpo del método correspondiente
   (`bark()`, `nut()`, `success()`…) por la reproducción del sample. La interfaz
   pública del manager no cambia, así que ninguna escena necesita tocarse.

El botón de silencio y la preferencia guardada en `localStorage` seguirán
funcionando igual.
