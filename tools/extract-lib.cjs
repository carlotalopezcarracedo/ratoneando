// Utilidades para recortar los personajes de la ilustración de referencia.
const { PNG } = require('pngjs');
const fs = require('fs');

const REF = require('path').join(__dirname, '..', 'public', 'reference', 'raton-character-reference.png');

function load(file = REF) {
  return PNG.sync.read(fs.readFileSync(file));
}

const idx = (png, x, y) => (png.width * y + x) << 2;

function rgb(png, x, y) {
  const i = idx(png, x, y);
  return [png.data[i], png.data[i + 1], png.data[i + 2]];
}

const dist = (a, b) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/**
 * Marca como fondo todo lo alcanzable desde las semillas creciendo por
 * similitud LOCAL: así atraviesa degradados suaves (pared, suelo, alfombra)
 * pero se detiene en el contorno oscuro de los personajes.
 */
function backgroundMask(png, seeds, step = 34, minLum = 0) {
  const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
  const { width: w, height: h } = png;
  const bg = new Uint8Array(w * h);
  const stack = [];
  for (const [sx, sy] of seeds) {
    const p = sy * w + sx;
    if (!bg[p]) {
      bg[p] = 1;
      stack.push(p);
    }
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    const c = rgb(png, x, y);
    const push = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
      const q = ny * w + nx;
      if (bg[q]) return;
      const nc = rgb(png, nx, ny);
      if (lum(nc) < minLum) return; // el contorno oscuro detiene el relleno
      if (dist(c, nc) > step) return;
      bg[q] = 1;
      stack.push(q);
    };
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return bg;
}

/** Componentes conexas de primer plano (no fondo), con su caja envolvente. */
function components(png, bg, minPixels = 400) {
  const { width: w, height: h } = png;
  const seen = new Uint8Array(w * h);
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p] || seen[p]) continue;
      let count = 0;
      let x0 = x;
      let x1 = x;
      let y0 = y;
      let y1 = y;
      const stack = [p];
      seen[p] = 1;
      while (stack.length) {
        const q = stack.pop();
        const qx = q % w;
        const qy = (q - qx) / w;
        count++;
        if (qx < x0) x0 = qx;
        if (qx > x1) x1 = qx;
        if (qy < y0) y0 = qy;
        if (qy > y1) y1 = qy;
        const tryPush = (nx, ny) => {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) return;
          const r = ny * w + nx;
          if (bg[r] || seen[r]) return;
          seen[r] = 1;
          stack.push(r);
        };
        tryPush(qx + 1, qy);
        tryPush(qx - 1, qy);
        tryPush(qx, qy + 1);
        tryPush(qx, qy - 1);
      }
      if (count >= minPixels) out.push({ x0, y0, x1, y1, count });
    }
  }
  return out.sort((a, b) => b.count - a.count);
}

/** Recorta una región usando la máscara de fondo como alfa. */
function cutout(png, bg, box, opts = {}) {
  const { x0, y0, x1, y1 } = box;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const src = idx(png, x0 + x, y0 + y);
      const dst = (w * y + x) << 2;
      const isBg = bg[(y0 + y) * png.width + (x0 + x)];
      out.data[dst] = png.data[src];
      out.data[dst + 1] = png.data[src + 1];
      out.data[dst + 2] = png.data[src + 2];
      out.data[dst + 3] = isBg ? 0 : 255;
    }
  }
  if (opts.feather !== false) featherEdges(out);
  return out;
}

/** Suaviza el borde del alfa para que no quede aserrado al escalar. */
function featherEdges(png) {
  const { width: w, height: h } = png;
  const alpha = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = png.data[(i << 2) + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (!alpha[p]) continue;
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += alpha[ny * w + nx];
          n++;
        }
      }
      png.data[(p << 2) + 3] = Math.round(sum / n);
    }
  }
}

function save(png, file) {
  fs.mkdirSync(require('path').dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png, { deflateLevel: 9 }));
  return { file, w: png.width, h: png.height, bytes: fs.statSync(file).size };
}

module.exports = { load, rgb, dist, backgroundMask, components, cutout, save, PNG, idx };
