/*
 * Extrae a Ratón y a su dueño de la ilustración maestra y los trocea en las
 * capas que el juego anima. El arte del juego ES el arte de la referencia.
 *
 *   node extract.js
 *
 * Escribe los PNG en public/assets/characters/ y un manifiesto con la posición
 * exacta de cada capa dentro del personaje, para poder recomponerlo sin
 * desajustes.
 */
const L = require('./extract-lib.cjs');
const { PNG } = require('pngjs');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, '..', 'public', 'assets', 'characters');
const MANIFEST = path.join(__dirname, '..', 'src', 'game', 'art', 'characters.json');

const png = L.load();
const W = png.width;
const H = png.height;

// ------------------------------------------------------------------ máscara
const seeds = [];
for (let x = 0; x < W; x += 2) seeds.push([x, 0], [x, H - 1]);
for (let y = 0; y < H; y += 2) seeds.push([0, y], [W - 1, y]);
[
  [500, 1120], [900, 1160], [350, 1160], [640, 1090], [1100, 1180], [80, 1210],
  [560, 300], [520, 700], [980, 700],
  [778, 800], [782, 860], [786, 960], [788, 1040], [790, 1090]
].forEach((s) => seeds.push(s));

const bg = L.backgroundMask(png, seeds, 30, 62);

// El rodapié y el suelo son marrones muy saturados y en sombra bajan del umbral
// de luminancia, así que el relleno los tomaba por personaje. Se marcan por
// color: ningún tono de los personajes cumple esta regla.
for (let y = 878; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const p = y * W + x;
    if (bg[p]) continue;
    const [r, g, b] = L.rgb(png, x, y);
    if (r > 45 && r > g * 1.6 && r > b * 2.2) bg[p] = 1;
  }
}

// ------------------------------------------------- componente del personaje
function isolate(region) {
  const seen = new Uint8Array(W * H);
  let best = null;
  for (let y = region.y0; y <= region.y1; y++) {
    for (let x = region.x0; x <= region.x1; x++) {
      const p = y * W + x;
      if (bg[p] || seen[p]) continue;
      const pixels = [];
      const stack = [p];
      seen[p] = 1;
      while (stack.length) {
        const q = stack.pop();
        const qx = q % W;
        const qy = (q - qx) / W;
        pixels.push(q);
        const go = (nx, ny) => {
          if (nx < region.x0 || ny < region.y0 || nx > region.x1 || ny > region.y1) return;
          const r = ny * W + nx;
          if (bg[r] || seen[r]) return;
          seen[r] = 1;
          stack.push(r);
        };
        go(qx + 1, qy);
        go(qx - 1, qy);
        go(qx, qy + 1);
        go(qx, qy - 1);
      }
      if (!best || pixels.length > best.length) best = pixels;
    }
  }
  const mask = new Uint8Array(W * H);
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  best.forEach((p) => {
    mask[p] = 1;
    const x = p % W;
    const y = (p - x) / W;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  });
  pruneThin(mask, x0, y0, x1, y1);
  return { mask, box: { x0, y0, x1, y1 } };
}

/** Borra líneas finas pegadas a la silueta (restos del rodapié y del suelo). */
function pruneThin(mask, x0, y0, x1, y1, minRun = 7) {
  const kill = [];
  for (let x = x0; x <= x1; x++) {
    let run = 0;
    for (let y = y0; y <= y1 + 1; y++) {
      const on = y <= y1 && mask[y * W + x];
      if (on) run++;
      else {
        if (run > 0 && run < minRun) {
          for (let k = 1; k <= run; k++) kill.push((y - k) * W + x);
        }
        run = 0;
      }
    }
  }
  kill.forEach((p) => (mask[p] = 0));
}

// ------------------------------------------------------------------ recorte
function layer(mask, box, keep) {
  let minX = box.x1;
  let maxX = box.x0;
  let minY = box.y1;
  let maxY = box.y0;
  for (let y = box.y0; y <= box.y1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (!mask[y * W + x]) continue;
      if (keep && !keep(x - box.x0, y - box.y0)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = minX + x;
      const sy = minY + y;
      const src = L.idx(png, sx, sy);
      const dst = (w * y + x) << 2;
      const inside = mask[sy * W + sx] && (!keep || keep(sx - box.x0, sy - box.y0));
      out.data[dst] = png.data[src];
      out.data[dst + 1] = png.data[src + 1];
      out.data[dst + 2] = png.data[src + 2];
      out.data[dst + 3] = inside ? 255 : 0;
    }
  }
  softenAlpha(out);
  return { png: out, offset: { x: minX - box.x0, y: minY - box.y0 }, w, h };
}

function softenAlpha(img) {
  const { width: w, height: h } = img;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = img.data[(i << 2) + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          sum += a[ny * w + nx];
          n++;
        }
      }
      const p = (y * w + x) << 2;
      const v = Math.round(sum / n);
      img.data[p + 3] = a[y * w + x] ? Math.max(150, v) : Math.min(v, 80);
    }
  }
}

/** Centros de los dos ojos: se buscan los iris (marrón cálido saturado). */
function findEyes(mask, box, bandY0, bandY1, test) {
  const pts = [];
  for (let y = box.y0 + bandY0; y <= box.y0 + bandY1; y++) {
    for (let x = box.x0; x <= box.x1; x++) {
      if (!mask[y * W + x]) continue;
      if (test(L.rgb(png, x, y))) pts.push([x - box.x0, y - box.y0]);
    }
  }
  if (pts.length < 20) return null;
  const midX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const side = (f) => {
    const g = pts.filter(f);
    if (!g.length) return null;
    return {
      x: Math.round(g.reduce((s, p) => s + p[0], 0) / g.length),
      y: Math.round(g.reduce((s, p) => s + p[1], 0) / g.length),
      r: Math.round(Math.sqrt(g.length / Math.PI))
    };
  };
  return { left: side((p) => p[0] < midX), right: side((p) => p[0] >= midX), samples: pts.length };
}

const manifest = { source: 'raton-character-reference.png', raton: {}, owner: {} };
const report = [];
const emit = (group, name, res) => {
  const info = L.save(res.png, path.join(OUT, `${name}.png`));
  manifest[group][name.replace(/^(raton|owner)-/, '')] = {
    key: name,
    x: res.offset.x,
    y: res.offset.y,
    w: res.w,
    h: res.h
  };
  report.push({ capa: name, w: info.w, h: info.h, KB: (info.bytes / 1024).toFixed(0) });
};

// ============================================================ RATÓN
const dog = isolate({ x0: 250, y0: 640, x1: 620, y1: 1240 });
const D = dog.box;
manifest.raton.size = { w: D.x1 - D.x0 + 1, h: D.y1 - D.y0 + 1 };

// Cortes en coordenadas locales (medidos sobre la silueta real).
const EAR_Y = 175;
const EAR_L_X = 118;
const EAR_R_X = 196;
const PAW_Y = 350;
const PAW_X = 155;

/*
 * Las capas se solapan unos píxeles en cada corte. La que queda DEBAJO es la
 * que se alarga, de modo que la de encima tapa la junta y no aparece la línea
 * clara del borde recortado.
 */
const OVERLAP = 10;
// El límite derecho evita llevarse la punta de la cola, que sube hasta esta altura.
const earL = (x, y, grow = 0) => y < EAR_Y + grow && x < EAR_L_X;
const earR = (x, y, grow = 0) => y < EAR_Y + grow && x > EAR_R_X && x < 278;
const paw = (x, y, grow = 0) => y >= PAW_Y + grow && x <= PAW_X;

// Orejas: van detrás del cuerpo, así que se alargan hacia abajo.
emit('raton', 'raton-ear-l', layer(dog.mask, D, (x, y) => earL(x, y, OVERLAP)));
emit('raton', 'raton-ear-r', layer(dog.mask, D, (x, y) => earR(x, y, OVERLAP)));
// La pata va delante, así que la que se alarga es el cuerpo.
emit('raton', 'raton-paw-l', layer(dog.mask, D, (x, y) => paw(x, y)));
emit(
  'raton',
  'raton-core',
  layer(dog.mask, D, (x, y) => !earL(x, y) && !earR(x, y) && !paw(x, y, OVERLAP))
);
emit('raton', 'raton-full', layer(dog.mask, D));

manifest.raton.eyes = findEyes(dog.mask, D, 110, 210, ([r, g, b]) => r > 110 && r > b * 1.7 && g > b);

// ============================================================ HERMANO
const man = isolate({ x0: 590, y0: 10, x1: 1000, y1: 1240 });
const M = man.box;
manifest.owner.size = { w: M.x1 - M.x0 + 1, h: M.y1 - M.y0 + 1 };

const HEAD_Y = 250; // por debajo de la barbilla, dentro del cuello de la sudadera
const LEG_Y = 600; // por debajo del bajo de la sudadera
const LEG_X = Math.round((M.x1 - M.x0) / 2);

// Orden de pintado: piernas, torso, cabeza. Cada capa inferior se alarga.
const OVERLAP_H = 12;
emit('owner', 'owner-head', layer(man.mask, M, (_x, y) => y <= HEAD_Y));
emit('owner', 'owner-torso', layer(man.mask, M, (_x, y) => y > HEAD_Y - OVERLAP_H && y <= LEG_Y));
emit('owner', 'owner-leg-l', layer(man.mask, M, (x, y) => y > LEG_Y - OVERLAP_H && x >= LEG_X));
emit('owner', 'owner-leg-r', layer(man.mask, M, (x, y) => y > LEG_Y - OVERLAP_H && x < LEG_X));
emit('owner', 'owner-full', layer(man.mask, M));

manifest.owner.eyes = findEyes(man.mask, M, 60, 180, ([r, g, b]) => r > 90 && r < 190 && r > b * 1.8 && g > b * 1.2);

fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.table(report);
console.log(JSON.stringify(manifest, null, 1));
