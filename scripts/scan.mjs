#!/usr/bin/env node
/**
 * Picker Photo CLI — Krok 0: Lokalny pre-filtr (bez AI)
 *
 * Szybko skanuje katalog i odrzuca:
 *  - rozmazane zdjęcia (Laplacian variance)
 *  - niedoświetlone / przepalone
 *  - duplikaty (perceptual hash)
 *
 * Wynik: _scan.json z listą kandydatów → przekaż do: npm run pick
 *
 * Użycie:
 *   npm run scan -- <katalog> [opcje]
 *
 * Opcje:
 *   -o, --out <plik>          Plik wyjściowy (domyślnie: <katalog>/_scan.json)
 *   -w, --workers <n>         Równoległe wątki (domyślnie: 8)
 *   --min-sharpness <n>       Próg ostrości 0-1000 (domyślnie: 40)
 *   --min-brightness <n>      Minimalny poziom jasności 0-255 (domyślnie: 20)
 *   --max-brightness <n>      Maksymalny poziom jasności 0-255 (domyślnie: 240)
 *   --max-dup-distance <n>    Maks. dystans hash do wykrycia duplikatu 0-64 (domyślnie: 6)
 *   --help
 */

import { readdir, writeFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import sharp from 'sharp';

// ─── Laplacian — detekcja ostrości ────────────────────────────────────────
// Kernel Laplaciana 3x3 wzmacnia krawędzie; wariancja wyniku = miara ostrości
const LAPLACIAN = {
  width: 3, height: 3,
  kernel: [-1, -1, -1,
           -1,  8, -1,
           -1, -1, -1],
};

async function sharpnessScore(imagePath) {
  const stats = await sharp(imagePath)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .convolve(LAPLACIAN)
    .stats();
  return Math.round(stats.channels[0].stdev);
}

async function brightnessScore(imagePath) {
  const stats = await sharp(imagePath)
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .stats();
  // Uśrednij mean po kanałach (RGB lub grayscale)
  const means = stats.channels.slice(0, 3).map(c => c.mean);
  return Math.round(means.reduce((a, b) => a + b, 0) / means.length);
}

// ─── Perceptual hash (pHash 8×8) ──────────────────────────────────────────
async function pHash(imagePath) {
  const { data } = await sharp(imagePath)
    .resize(8, 8, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  return Array.from(data).map(v => (v >= mean ? 1 : 0));
}

function hammingDistance(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

// ─── Prosta kolejka z limitem równoległości ────────────────────────────────
async function pLimit(items, fn, concurrency) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Formatowanie postępu ──────────────────────────────────────────────────
function bar(done, total, width = 30) {
  const filled = Math.round((done / total) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function printProgress(done, total, label = '') {
  const pct = Math.round((done / total) * 100);
  process.stdout.write(`\r  [${bar(done, total)}] ${pct}% (${done}/${total}) ${label.slice(0, 30).padEnd(30)}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Picker Photo — Krok 0: Lokalny pre-filtr

Użycie:
  npm run scan -- <katalog> [opcje]

Opcje:
  -o, --out <plik>          Plik wyjściowy (domyślnie: <katalog>/_scan.json)
  -w, --workers <n>         Równoległe wątki (domyślnie: 8)
  --min-sharpness <n>       Próg ostrości 0-1000 (domyślnie: 40)
  --min-brightness <n>      Minimalna jasność 0-255 (domyślnie: 20)
  --max-brightness <n>      Maksymalna jasność 0-255 (domyślnie: 240)
  --max-dup-distance <n>    Próg duplikatu 0-64 (domyślnie: 6)

Workflow:
  npm run scan -- /foto/sesja          → generuje _scan.json
  npm run pick -- /foto/sesja --scan   → AI analizuje tylko kandydatów
`);
    process.exit(0);
  }

  const dirPath = args[0];
  let outFile = null;
  let workers = 8;
  let minSharpness = 40;
  let minBrightness = 20;
  let maxBrightness = 240;
  let maxDupDistance = 6;

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--out' || args[i] === '-o') && args[i + 1])              outFile = args[++i];
    else if ((args[i] === '--workers' || args[i] === '-w') && args[i + 1])     workers = parseInt(args[++i], 10);
    else if (args[i] === '--min-sharpness' && args[i + 1])                     minSharpness = parseInt(args[++i], 10);
    else if (args[i] === '--min-brightness' && args[i + 1])                    minBrightness = parseInt(args[++i], 10);
    else if (args[i] === '--max-brightness' && args[i + 1])                    maxBrightness = parseInt(args[++i], 10);
    else if (args[i] === '--max-dup-distance' && args[i + 1])                  maxDupDistance = parseInt(args[++i], 10);
  }

  if (!outFile) outFile = join(dirPath, '_scan.json');

  // Lista plików
  let files;
  try {
    files = await readdir(dirPath);
  } catch {
    console.error(`Nie można odczytać: ${dirPath}`);
    process.exit(1);
  }

  const VALID = new Set(['.jpg', '.jpeg', '.png', '.webp']);
  const images = files
    .filter(f => VALID.has(extname(f).toLowerCase()))
    .map(f => join(dirPath, f))
    .sort();

  if (images.length === 0) {
    console.error('Brak zdjęć w katalogu.');
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Picker Photo — Krok 0: Pre-filtr lokalny           │
├─────────────────────────────────────────────────────┤
│  Katalog    : ${dirPath.slice(-40).padEnd(40)}│
│  Zdjęcia    : ${String(images.length).padEnd(40)}│
│  Wątki      : ${String(workers).padEnd(40)}│
│  Ostrość ≥  : ${String(minSharpness).padEnd(40)}│
│  Jasność    : ${`${minBrightness}–${maxBrightness}`.padEnd(40)}│
│  Duplikaty ≤ : ${String(maxDupDistance).padEnd(40)}│
└─────────────────────────────────────────────────────┘
`);

  // ── Faza 1: Analiza ostrości i ekspozycji ────────────────────────────────
  console.log('Faza 1/2: Analiza techniczna (ostrość, ekspozycja)...\n');

  let done1 = 0;
  const metrics = await pLimit(images, async (imagePath) => {
    let sharp_ = 0, bright = 0, error = false;
    try {
      [sharp_, bright] = await Promise.all([
        sharpnessScore(imagePath),
        brightnessScore(imagePath),
      ]);
    } catch {
      error = true;
    }
    printProgress(++done1, images.length, basename(imagePath));
    return { path: imagePath, name: basename(imagePath), sharp: sharp_, bright, error };
  }, workers);

  console.log('\n');

  const techPass = metrics.filter(m =>
    !m.error &&
    m.sharp >= minSharpness &&
    m.bright >= minBrightness &&
    m.bright <= maxBrightness
  );

  const blurry    = metrics.filter(m => !m.error && m.sharp < minSharpness);
  const dark      = metrics.filter(m => !m.error && m.bright < minBrightness);
  const blown     = metrics.filter(m => !m.error && m.bright > maxBrightness);
  const errored   = metrics.filter(m => m.error);

  console.log(`  Ostro/dobrze naświetlone : ${techPass.length}`);
  console.log(`  Rozmazane (ostrość < ${minSharpness})  : ${blurry.length}`);
  console.log(`  Niedoświetlone           : ${dark.length}`);
  console.log(`  Przepalone               : ${blown.length}`);
  if (errored.length) console.log(`  Błędy odczytu            : ${errored.length}`);
  console.log('');

  // ── Faza 2: Detekcja duplikatów ──────────────────────────────────────────
  console.log('Faza 2/2: Detekcja duplikatów (pHash)...\n');

  let done2 = 0;
  const hashes = await pLimit(techPass, async (m) => {
    let hash = null;
    try { hash = await pHash(m.path); } catch { /* skip */ }
    printProgress(++done2, techPass.length, m.name);
    return { ...m, hash };
  }, workers);

  console.log('\n');

  // Grupuj duplikaty — dla każdej grupy zachowaj najostrzejsze zdjęcie
  const kept = [];
  const dupGroups = [];
  const used = new Set();

  for (let i = 0; i < hashes.length; i++) {
    if (used.has(i) || !hashes[i].hash) {
      if (!used.has(i)) kept.push(hashes[i]);
      continue;
    }
    const group = [hashes[i]];
    for (let j = i + 1; j < hashes.length; j++) {
      if (used.has(j) || !hashes[j].hash) continue;
      if (hammingDistance(hashes[i].hash, hashes[j].hash) <= maxDupDistance) {
        group.push(hashes[j]);
        used.add(j);
      }
    }
    used.add(i);
    if (group.length > 1) {
      dupGroups.push(group.map(m => m.name));
      // Zachowaj najostrzejsze z grupy
      const best = group.reduce((a, b) => (a.sharp > b.sharp ? a : b));
      kept.push(best);
    } else {
      kept.push(group[0]);
    }
  }

  const dupCount = hashes.length - kept.length;

  // ── Wyniki ────────────────────────────────────────────────────────────────
  const total      = images.length;
  const candidates = kept.length;
  const reduction  = Math.round((1 - candidates / total) * 100);

  console.log(`─────────────────────────────────────────────`);
  console.log(`  Wejście          : ${total}`);
  console.log(`  Odrzucone (tech) : ${total - techPass.length}`);
  console.log(`  Duplikaty        : ${dupCount}`);
  console.log(`  Kandydaci do AI  : ${candidates}  (${100 - reduction}% oryginału)`);
  console.log(`─────────────────────────────────────────────`);

  // ── Zapis raportu ─────────────────────────────────────────────────────────
  const report = {
    directory: dirPath,
    date: new Date().toISOString(),
    settings: { minSharpness, minBrightness, maxBrightness, maxDupDistance },
    summary: {
      total,
      blurry: blurry.length,
      dark: dark.length,
      blown: blown.length,
      duplicates: dupCount,
      candidates,
      reductionPercent: reduction,
    },
    candidates: kept
      .sort((a, b) => b.sharp - a.sharp)
      .map(m => ({ path: m.path, name: m.name, sharpness: m.sharp, brightness: m.bright })),
    duplicateGroups: dupGroups,
  };

  await writeFile(outFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`
✓ Gotowe! Raport zapisany: ${outFile}

Następny krok — AI analizuje tylko ${candidates} kandydatów:
  npm run pick -- "${dirPath}" --scan "${outFile}" -p <fotograf>
`);
}

main().catch(err => {
  console.error('\nBłąd:', err.message);
  process.exit(1);
});
