#!/usr/bin/env node
/**
 * Picker Photo CLI — Krok 2: Obróbka stylistyczna
 *
 * Aplikuje korektę kolorystyczną w stylu wybranego fotografa
 * na zdjęcia z folderu edycja/ i zapisuje wyniki do gotowe/.
 * Fotograf jest odczytywany automatycznie z _raport.json.
 *
 * Użycie:
 *   npm run edit -- <katalog/edycja> [opcje]
 *
 * Opcje:
 *   -p, --photographer <id>   Nadpisuje fotografa z raportu
 *   -o, --out <nazwa>         Nazwa folderu wyjściowego (domyślnie: gotowe)
 *   -q, --quality <1-100>     Jakość JPEG wyjściowego (domyślnie: 95)
 *   --help
 */

import { readdir, mkdir, readFile, writeFile } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import sharp from 'sharp';

// ─── Style obróbki ─────────────────────────────────────────────────────────
// Odpowiedniki CSS filterów z aplikacji web, zastosowane przez Sharp.
// Formuła kontrastu: output = input * c + 127.5 * (1 - c)

const PHOTOGRAPHERS = [
  { id: 'cartier-bresson', name: 'Henri Cartier-Bresson' },
  { id: 'avedon',          name: 'Richard Avedon' },
  { id: 'meyerowitz',      name: 'Joel Meyerowitz' },
  { id: 'arbus',           name: 'Diane Arbus' },
  { id: 'newton',          name: 'Helmut Newton' },
  { id: 'mccurry',         name: 'Steve McCurry' },
];

const EDITING_NOTES = {
  'cartier-bresson': 'B&W, kontrast +20%, jasność -10%',
  'avedon':          'B&W, kontrast +50%, jasność +10%',
  'meyerowitz':      'Nasycenie +30%, kontrast +10%, jasność +5%',
  'arbus':           'Desaturacja 60%, kontrast +30%',
  'newton':          'Kontrast +40%, jasność -5%, nasycenie -20%',
  'mccurry':         'Nasycenie +50%, kontrast +20%, jasność -5%',
};

function applyPhotographerStyle(pipeline, photographerId) {
  switch (photographerId) {
    case 'cartier-bresson':
      // grayscale(100%) contrast(1.2) brightness(0.9)
      return pipeline
        .grayscale()
        .modulate({ brightness: 0.9 })
        .linear(1.2, Math.round(127.5 * (1 - 1.2)));

    case 'avedon':
      // grayscale(100%) contrast(1.5) brightness(1.1)
      return pipeline
        .grayscale()
        .modulate({ brightness: 1.1 })
        .linear(1.5, Math.round(127.5 * (1 - 1.5)));

    case 'meyerowitz':
      // saturate(1.3) contrast(1.1) brightness(1.05)
      return pipeline
        .modulate({ brightness: 1.05, saturation: 1.3 })
        .linear(1.1, Math.round(127.5 * (1 - 1.1)));

    case 'arbus':
      // grayscale(60%) contrast(1.3) — desaturacja + kontrast
      return pipeline
        .modulate({ saturation: 0.4 })
        .linear(1.3, Math.round(127.5 * (1 - 1.3)));

    case 'newton':
      // contrast(1.4) brightness(0.95) saturate(0.8)
      return pipeline
        .modulate({ brightness: 0.95, saturation: 0.8 })
        .linear(1.4, Math.round(127.5 * (1 - 1.4)));

    case 'mccurry':
      // saturate(1.5) contrast(1.2) brightness(0.95)
      return pipeline
        .modulate({ brightness: 0.95, saturation: 1.5 })
        .linear(1.2, Math.round(127.5 * (1 - 1.2)));

    default:
      return pipeline;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

async function loadPhotographerFromReport(dirPath) {
  try {
    const reportPath = join(dirPath, '_raport.json');
    const data = JSON.parse(await readFile(reportPath, 'utf-8'));
    return data.photographerId || null;
  } catch {
    return null;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Picker Photo — Krok 2: Obróbka stylistyczna

Użycie:
  npm run edit -- <katalog> [opcje]

Opcje:
  -p, --photographer <id>   Nadpisuje fotografa z _raport.json
  -o, --out <nazwa>         Nazwa folderu wyjściowego (domyślnie: gotowe)
  -q, --quality <1-100>     Jakość JPEG (domyślnie: 95)

Fotografowie:
${PHOTOGRAPHERS.map(p => `  ${p.id.padEnd(22)} ${p.name}`).join('\n')}

Style obróbki:
${Object.entries(EDITING_NOTES).map(([id, note]) => `  ${id.padEnd(22)} ${note}`).join('\n')}
`);
    process.exit(0);
  }

  const dirPath = args[0];
  let photographerId = null;
  let outDirName = 'gotowe';
  let quality = 95;

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--photographer' || args[i] === '-p') && args[i + 1]) {
      photographerId = args[++i];
    } else if ((args[i] === '--out' || args[i] === '-o') && args[i + 1]) {
      outDirName = args[++i];
    } else if ((args[i] === '--quality' || args[i] === '-q') && args[i + 1]) {
      quality = parseInt(args[++i], 10);
    }
  }

  // Auto-wykryj fotografa z raportu
  if (!photographerId) {
    photographerId = await loadPhotographerFromReport(dirPath);
    if (photographerId) {
      const p = PHOTOGRAPHERS.find(x => x.id === photographerId);
      console.log(`\nFotograf z raportu: ${p?.name || photographerId}`);
    }
  }

  if (!photographerId) {
    console.error('Nie można określić fotografa. Podaj -p <id> lub uruchom w folderze z _raport.json.');
    console.error(`Dostępne: ${PHOTOGRAPHERS.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  if (!PHOTOGRAPHERS.find(p => p.id === photographerId)) {
    console.error(`Nieznany fotograf: "${photographerId}"`);
    process.exit(1);
  }

  const photographer = PHOTOGRAPHERS.find(p => p.id === photographerId);

  // Lista zdjęć
  let files;
  try {
    files = await readdir(dirPath);
  } catch {
    console.error(`Nie można odczytać katalogu: ${dirPath}`);
    process.exit(1);
  }

  const images = files
    .filter(f => VALID_EXTS.has(extname(f).toLowerCase()))
    .map(f => join(dirPath, f))
    .sort();

  if (images.length === 0) {
    console.error('Brak zdjęć w katalogu.');
    process.exit(1);
  }

  // Folder wyjściowy w tym samym miejscu co katalog wejściowy
  const outDir = join(dirname(dirPath), outDirName);
  await mkdir(outDir, { recursive: true });

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Picker Photo — Krok 2: Obróbka stylistyczna        │
├─────────────────────────────────────────────────────┤
│  Fotograf : ${photographer.name.padEnd(40)}│
│  Styl     : ${(EDITING_NOTES[photographerId] || '').padEnd(40)}│
│  Wejście  : ${dirPath.slice(-40).padEnd(40)}│
│  Wyjście  : ${outDir.slice(-40).padEnd(40)}│
│  Zdjęcia  : ${String(images.length).padEnd(40)}│
│  Jakość   : ${String(quality).padEnd(40)}│
└─────────────────────────────────────────────────────┘
`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < images.length; i++) {
    const inputPath = images[i];
    const name = basename(inputPath);
    const ext = extname(name).toLowerCase();

    // Zapisz jako JPEG (nawet jeśli wejście to PNG/WebP) dla spójności edycji
    const outName = ext === '.jpg' || ext === '.jpeg' ? name : name.replace(ext, '.jpg');
    const outputPath = join(outDir, outName);

    const prefix = `[${String(i + 1).padStart(String(images.length).length)}/${images.length}]`;
    process.stdout.write(`${prefix} ${name.slice(0, 40).padEnd(40)} `);

    try {
      const pipeline = sharp(inputPath).rotate(); // zachowaj orientację EXIF
      await applyPhotographerStyle(pipeline, photographerId)
        .jpeg({ quality })
        .toFile(outputPath);
      console.log('✓');
      ok++;
    } catch (err) {
      console.log(`✗  ${err.message.slice(0, 40)}`);
      fail++;
    }
  }

  // Zapisz log edycji
  const log = {
    photographer: photographer.name,
    photographerId,
    editingNotes: EDITING_NOTES[photographerId],
    inputDirectory: dirPath,
    outputDirectory: outDir,
    date: new Date().toISOString(),
    quality,
    processed: ok,
    failed: fail,
  };

  await writeFile(join(outDir, '_edycja.json'), JSON.stringify(log, null, 2), 'utf-8');

  console.log(`
✓ Krok 2 gotowy!
  ${ok} zdjęć po obróbce w: ${outDir}${fail > 0 ? `\n  ${fail} błędów` : ''}
`);
}

main().catch(err => {
  console.error('\nBłąd:', err.message);
  process.exit(1);
});
