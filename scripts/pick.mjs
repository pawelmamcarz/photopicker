#!/usr/bin/env node
/**
 * Picker Photo CLI
 * Analizuje katalog zdjęć przez Claude Vision, kopiuje PICKS do podkatalogu
 * i aplikuje korektę w stylu wybranego fotografa (przez Sharp).
 *
 * Użycie:
 *   node scripts/pick.mjs <katalog> [opcje]
 *   npm run pick -- <katalog> [opcje]
 *
 * Opcje:
 *   --photographer, -p <id>   ID fotografa (pomija interaktywny wybór)
 *   --threshold, -t <liczba>  Minimalny wynik do skopiowania (domyślnie: 75)
 *   --out, -o <nazwa>         Nazwa folderu wyjściowego (domyślnie: edycja)
 *   --no-edit                 Kopiuj bez edycji obrazu
 *   --help                    Pomoc
 */

import { readdir, mkdir, copyFile, readFile, writeFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { createInterface } from 'readline';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

// ─── Definicje fotografów ──────────────────────────────────────────────────

const PHOTOGRAPHERS = [
  { id: 'cartier-bresson', name: 'Henri Cartier-Bresson', tags: 'B&W · Street · Moment' },
  { id: 'avedon',          name: 'Richard Avedon',        tags: 'Portrait · Drama · B&W' },
  { id: 'meyerowitz',      name: 'Joel Meyerowitz',       tags: 'Color · Light · Street' },
  { id: 'arbus',           name: 'Diane Arbus',           tags: 'Portrait · Raw · Social' },
  { id: 'newton',          name: 'Helmut Newton',         tags: 'Fashion · Bold · Graphic' },
  { id: 'mccurry',         name: 'Steve McCurry',         tags: 'Color · Emotion · Travel' },
];

const SYSTEM_PROMPTS = {
  'cartier-bresson': `You are scoring a photo as Henri Cartier-Bresson would.
Score from 0-100 based on:
- Decisive moment: Is there a peak action, gesture, or expression? (+30)
- Geometric composition: Strong lines, shapes, layering in frame? (+25)
- Street/human element: People, movement, life? (+20)
- Tonal range: Good contrast for B&W conversion? (+15)
- Narrative: Does it tell a story in one frame? (+10)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific Lightroom/Capture One adjustments"}`,

  'avedon': `You are scoring a photo as Richard Avedon would.
Score from 0-100 based on:
- Subject isolation: Clean or white background? Subject prominent? (+35)
- Emotional exposure: Raw, unguarded expression? Psychological presence? (+30)
- Tonal contrast: High contrast suitable for B&W? (+20)
- Composition: Subject fills the frame, direct eye contact? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'meyerowitz': `You are scoring a photo as Joel Meyerowitz would.
Score from 0-100 based on:
- Color richness: Vivid, saturated, warm palette? (+30)
- Light quality: Golden hour, open shade, directional light? (+30)
- Street life: Human presence, urban environment? (+20)
- Layered depth: Foreground, middle ground, background? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'arbus': `You are scoring a photo as Diane Arbus would.
Score from 0-100 based on:
- Directness: Subject looking straight at camera? Frontally composed? (+30)
- Social edge: Outsider, unusual, or overlooked subject matter? (+30)
- Flash quality: Harsh, flat lighting or direct flash aesthetic? (+20)
- Square crop potential: Does it work in 1:1 format? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'newton': `You are scoring a photo as Helmut Newton would.
Score from 0-100 based on:
- Graphic strength: Bold lines, architecture, graphic B&W contrast? (+30)
- Power dynamic: Strong subject presence, confident posture? (+25)
- Light drama: Hard shadows, bold directional light? (+25)
- Fashion/luxury context: Elegant or provocative setting? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'mccurry': `You are scoring a photo as Steve McCurry would.
Score from 0-100 based on:
- Color intensity: Rich, deep, saturated colors? (+30)
- Human connection: Eye contact, emotional expression? (+30)
- Cultural context: Travel, exotic setting, cultural richness? (+20)
- Compositional simplicity: Clear subject, uncluttered? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
};

// ─── Obróbka Sharp (odpowiednik CSS filterów z aplikacji web) ──────────────
// Formuła kontrastu: output = input * c + 127.5 * (1 - c)

const SHARP_EDITS = {
  // grayscale(100%) contrast(1.2) brightness(0.9)
  'cartier-bresson': (p) =>
    p.grayscale().modulate({ brightness: 0.9 }).linear(1.2, -25.5),

  // grayscale(100%) contrast(1.5) brightness(1.1)
  'avedon': (p) =>
    p.grayscale().modulate({ brightness: 1.1 }).linear(1.5, -63.75),

  // saturate(1.3) contrast(1.1) brightness(1.05)
  'meyerowitz': (p) =>
    p.modulate({ brightness: 1.05, saturation: 1.3 }).linear(1.1, -12.75),

  // grayscale(60%) contrast(1.3) sepia(0.2)  →  desaturate + contrast
  'arbus': (p) =>
    p.modulate({ brightness: 1.0, saturation: 0.4 }).linear(1.3, -38.25),

  // contrast(1.4) brightness(0.95) saturate(0.8)
  'newton': (p) =>
    p.modulate({ brightness: 0.95, saturation: 0.8 }).linear(1.4, -51.0),

  // saturate(1.5) contrast(1.2) brightness(0.95)
  'mccurry': (p) =>
    p.modulate({ brightness: 0.95, saturation: 1.5 }).linear(1.2, -25.5),
};

// ─── Helpers ──────────────────────────────────────────────────────────────

const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function scoreBar(score) {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function scoreCategory(score, threshold) {
  if (score >= threshold) return 'PICK ';
  if (score >= 60)        return 'MAYBE';
  return 'skip ';
}

async function analyzeImage(client, imagePath, photographerId) {
  // Skaluj do max 1920px przed wysłaniem — pliki z aparatu są zbyt duże dla API
  const resized = await sharp(imagePath)
    .rotate()                          // zachowaj orientację z EXIF
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const mediaType = 'image/jpeg';
  const base64 = resized.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPTS[photographerId],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Score this photo. Return ONLY valid JSON.' },
      ],
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function applyEdit(inputPath, outputPath, photographerId) {
  const editFn = SHARP_EDITS[photographerId];
  if (!editFn) {
    await copyFile(inputPath, outputPath);
    return;
  }
  const pipeline = sharp(inputPath);
  await editFn(pipeline).toFile(outputPath);
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Picker Photo CLI

Użycie:
  node scripts/pick.mjs <katalog> [opcje]
  npm run pick -- <katalog> [opcje]

Opcje:
  -p, --photographer <id>   ID fotografa (pomija interaktywny wybór)
  -t, --threshold <liczba>  Minimalny wynik do skopiowania (domyślnie: 75)
  -o, --out <nazwa>         Nazwa folderu wyjściowego (domyślnie: edycja)
  --no-edit                 Kopiuj pliki bez edycji

Dostępni fotografowie:
${PHOTOGRAPHERS.map(p => `  ${p.id.padEnd(22)} ${p.name}`).join('\n')}
`);
    process.exit(0);
  }

  const dirPath = args[0];
  let photographerId = null;
  let threshold = 75;
  let outDirName = 'edycja';
  let noEdit = false;

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--photographer' || args[i] === '-p') && args[i + 1]) {
      photographerId = args[++i];
    } else if ((args[i] === '--threshold' || args[i] === '-t') && args[i + 1]) {
      threshold = parseInt(args[++i], 10);
    } else if ((args[i] === '--out' || args[i] === '-o') && args[i + 1]) {
      outDirName = args[++i];
    } else if (args[i] === '--no-edit') {
      noEdit = true;
    }
  }

  if (photographerId && !PHOTOGRAPHERS.find(p => p.id === photographerId)) {
    console.error(`Nieznany fotograf: "${photographerId}"`);
    console.error(`Dostępne: ${PHOTOGRAPHERS.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

  // Interaktywny wybór fotografa
  if (!photographerId) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nWybierz fotografa:\n');
    PHOTOGRAPHERS.forEach((p, i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(26)} ${p.tags}`)
    );
    console.log('');
    const answer = await ask(rl, 'Numer (1-6): ');
    rl.close();
    const idx = parseInt(answer, 10) - 1;
    if (idx < 0 || idx >= PHOTOGRAPHERS.length) {
      console.error('Nieprawidłowy wybór.');
      process.exit(1);
    }
    photographerId = PHOTOGRAPHERS[idx].id;
  }

  const photographer = PHOTOGRAPHERS.find(p => p.id === photographerId);

  // Listowanie zdjęć
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
    console.error('Brak zdjęć (JPEG/PNG/WebP) w podanym katalogu.');
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Picker Photo CLI                                   │
├─────────────────────────────────────────────────────┤
│  Fotograf : ${photographer.name.padEnd(40)}│
│  Katalog  : ${dirPath.slice(-40).padEnd(40)}│
│  Zdjęcia  : ${String(images.length).padEnd(40)}│
│  Próg     : ≥ ${String(threshold).padEnd(38)}│
└─────────────────────────────────────────────────────┘
`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Brak ANTHROPIC_API_KEY w zmiennych środowiskowych.');
    console.error('Dodaj do .env.local lub wyeksportuj: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic();
  const results = [];

  // Analiza
  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i];
    const name = basename(imagePath);
    const prefix = `[${String(i + 1).padStart(String(images.length).length)}/${images.length}]`;
    process.stdout.write(`${prefix} ${name.slice(0, 35).padEnd(35)} `);

    try {
      const result = await analyzeImage(client, imagePath, photographerId);
      const score = Math.max(0, Math.min(100, Math.round(result.score)));
      results.push({ path: imagePath, name, score, reasoning: result.reasoning, editSuggestion: result.editSuggestion });
      const cat = scoreCategory(score, threshold);
      console.log(`${String(score).padStart(3)}  ${scoreBar(score)}  ${cat}`);
    } catch (err) {
      console.log(`  —  błąd: ${err.message.slice(0, 40)}`);
      results.push({ path: imagePath, name, score: 0, reasoning: 'error', editSuggestion: '', error: true });
    }
  }

  // Podsumowanie
  const picks   = results.filter(r => !r.error && r.score >= threshold);
  const maybes  = results.filter(r => !r.error && r.score >= 60 && r.score < threshold);
  const rejects = results.filter(r => !r.error && r.score < 60);
  const errors  = results.filter(r => r.error);

  console.log(`
───────────────────────────────────────────
  PICKS        ${String(picks.length).padStart(3)} zdjęć  (score ≥ ${threshold})
  DO ROZWAŻENIA ${String(maybes.length).padStart(3)} zdjęć  (60–${threshold - 1})
  ODRZUCONE    ${String(rejects.length).padStart(3)} zdjęć
${errors.length > 0 ? `  BŁĘDY        ${String(errors.length).padStart(3)} zdjęć` : ''}───────────────────────────────────────────
`);

  if (picks.length === 0) {
    console.log('Brak zdjęć powyżej progu — nic do skopiowania.');
    process.exit(0);
  }

  // Tworzenie folderu wyjściowego
  const outDir = join(dirPath, outDirName);
  await mkdir(outDir, { recursive: true });

  // Kopiowanie / edycja
  console.log(`Zapisywanie PICKS do: ${outDir}\n`);

  for (const pick of picks.sort((a, b) => b.score - a.score)) {
    const outPath = join(outDir, pick.name);
    process.stdout.write(`  ${String(pick.score).padStart(3)}  ${pick.name.slice(0, 40).padEnd(40)} `);
    try {
      if (noEdit) {
        await copyFile(pick.path, outPath);
      } else {
        await applyEdit(pick.path, outPath, photographerId);
      }
      console.log('✓');
    } catch (err) {
      console.log(`✗  ${err.message.slice(0, 40)}`);
    }
  }

  // Raport JSON
  const report = {
    photographer: photographer.name,
    photographerId,
    directory: dirPath,
    outputDirectory: outDir,
    date: new Date().toISOString(),
    threshold,
    editApplied: !noEdit,
    summary: { picks: picks.length, maybes: maybes.length, rejects: rejects.length },
    results: results.sort((a, b) => b.score - a.score),
  };

  const reportPath = join(outDir, '_raport.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`
✓ Gotowe!
  ${picks.length} zdjęć zapisanych w: ${outDir}
  Raport: ${reportPath}
`);
}

main().catch(err => {
  console.error('\nBłąd:', err.message);
  process.exit(1);
});
