#!/usr/bin/env node
/**
 * Picker Photo CLI — Krok 1: Selekcja
 *
 * Analizuje katalog zdjęć przez Claude Vision i kopiuje PICKS
 * do podkatalogu (bez edycji — oryginały). Krok 2 to: npm run edit
 *
 * Użycie:
 *   npm run pick -- <katalog> [opcje]
 *
 * Opcje:
 *   -p, --photographer <id>   ID fotografa (pomija interaktywny wybór)
 *   -t, --threshold <liczba>  Minimalny wynik (domyślnie: 75)
 *   -o, --out <nazwa>         Nazwa folderu wyjściowego (domyślnie: edycja)
 *   --help
 */

import { readdir, mkdir, copyFile, readFile, writeFile, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { createInterface } from 'readline';
import sharp from 'sharp';
import Anthropic from '@anthropic-ai/sdk';

const PHOTOGRAPHERS = [
  { id: 'cartier-bresson', name: 'Henri Cartier-Bresson', tags: 'B&W · Street · Moment' },
  { id: 'avedon',          name: 'Richard Avedon',        tags: 'Portrait · Drama · B&W' },
  { id: 'meyerowitz',      name: 'Joel Meyerowitz',       tags: 'Color · Light · Street' },
  { id: 'arbus',           name: 'Diane Arbus',           tags: 'Portrait · Raw · Social' },
  { id: 'newton',          name: 'Helmut Newton',         tags: 'Fashion · Bold · Graphic' },
  { id: 'mccurry',         name: 'Steve McCurry',         tags: 'Color · Emotion · Travel' },
  { id: 'capa',            name: 'Robert Capa',           tags: 'B&W · War · Reportage' },
  { id: 'mccullin',        name: 'Don McCullin',          tags: 'B&W · War · Raw' },
  { id: 'salgado',         name: 'Sebastião Salgado',     tags: 'B&W · Epic · Humanitarian' },
  { id: 'eggleston',       name: 'William Eggleston',     tags: 'Color · Everyday · America' },
  { id: 'parr',            name: 'Martin Parr',           tags: 'Color · Flash · Ironic' },
  { id: 'goldin',          name: 'Nan Goldin',            tags: 'Color · Intimate · Documentary' },
  { id: 'leibovitz',       name: 'Annie Leibovitz',       tags: 'Portrait · Cinematic · Editorial' },
  { id: 'maier',           name: 'Vivian Maier',          tags: 'B&W · Street · Square' },
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

  'capa': `You are scoring a photo as Robert Capa would for war and conflict reportage.
Score from 0-100 based on:
- Action/tension: Is there movement, urgency, or palpable danger? (+30)
- Raw emotion: Human emotion under extreme stress — fear, grief, determination? (+30)
- Authenticity: Does it feel unposed, real, reportage? Technical imperfection is fine (+25)
- Historical weight: Does it feel like it documents something that matters? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'mccullin': `You are scoring a photo as Don McCullin would for war and social documentary.
Score from 0-100 based on:
- Raw human suffering or resilience: Is there visible hardship, grief, exhaustion? (+35)
- Conflict or poverty context: War zone, deprivation, social struggle? (+30)
- B&W tonal drama: Deep shadows, highlights that feel earned? (+20)
- Dignity in adversity: Does the subject retain humanity despite circumstances? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'salgado': `You are scoring a photo as Sebastião Salgado would.
Score from 0-100 based on:
- Epic scale: Grand landscape, massive crowds, monumental scene? (+30)
- Dramatic light: Strong directional light creating cathedral-like B&W drama? (+30)
- Humanitarian narrative: Human labor, migration, dignity, struggle? (+25)
- Classical composition: Monumental, timeless, almost Renaissance in feeling? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'eggleston': `You are scoring a photo as William Eggleston would.
Score from 0-100 based on:
- Everyday subject: Ordinary, overlooked, mundane subject treated as worthy? (+35)
- Color richness: Saturated, vivid, unexpected color relationships? (+30)
- Democratic eye: Treating common things — parking lots, diners, signs — as equally important? (+20)
- Slight unease: Something slightly strange, poetic, or melancholy in the ordinary? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'parr': `You are scoring a photo as Martin Parr would.
Score from 0-100 based on:
- Hypersaturation potential: Will colors become almost garish and pop? (+30)
- Social observation: Consumer culture, leisure, class, tourism, kitsch? (+30)
- Direct flash aesthetic: Flat, flash-lit, bright midday pop quality? (+25)
- Irony or absurdity: Something funny, critical, or absurd in the scene? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'goldin': `You are scoring a photo as Nan Goldin would.
Score from 0-100 based on:
- Intimacy and vulnerability: A close, personal, unguarded moment between people? (+35)
- Authenticity: Real life, not staged — could be from someone's personal diary? (+30)
- Warm film color: Skin tones, warm shadows, slightly faded or overexposed? (+20)
- Human connection: Friendship, love, identity, loneliness, desire? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'leibovitz': `You are scoring a photo as Annie Leibovitz would for editorial and celebrity portraits.
Score from 0-100 based on:
- Cinematic drama: Theatrical, staged, almost movie-still quality? (+30)
- Lighting mastery: Strong directional light, colored gels, dramatic contrast? (+30)
- Subject authority: Celebrity, powerful personality, or commanding presence? (+25)
- Storytelling: Does it reveal something about the subject's identity or inner world? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,

  'maier': `You are scoring a photo as Vivian Maier would for street photography.
Score from 0-100 based on:
- Square format composition: Does the scene work perfectly in 1:1 crop? (+25)
- Candid street observation: Unnoticed, unposed, authentic urban moment? (+30)
- Geometry, shadows, reflections: Strong shapes, mirrored surfaces, graphic elements? (+25)
- Observer's presence: A sense of curious, intelligent eye watching the world? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
};

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
  const resized = await sharp(imagePath)
    .rotate()
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM_PROMPTS[photographerId],
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: resized.toString('base64') } },
        { type: 'text', text: 'Score this photo. Return ONLY valid JSON.' },
      ],
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Picker Photo — Krok 1: Selekcja

Użycie:
  npm run pick -- <katalog> [opcje]

Opcje:
  -p, --photographer <id>   ID fotografa (pomija interaktywny wybór)
  -t, --threshold <liczba>  Minimalny wynik do skopiowania (domyślnie: 75)
  -o, --out <nazwa>         Nazwa folderu wyjściowego (domyślnie: edycja)
  --scan <plik>             Użyj kandydatów z _scan.json (po: npm run scan)

Fotografowie:
${PHOTOGRAPHERS.map(p => `  ${p.id.padEnd(22)} ${p.name}`).join('\n')}

Workflow z pre-filtrem:
  npm run scan -- <katalog>
  npm run pick -- <katalog> --scan <katalog>/_scan.json -p <fotograf>
  npm run edit -- <katalog>/edycja
`);
    process.exit(0);
  }

  const dirPath = args[0];
  let photographerId = null;
  let threshold = 75;
  let outDirName = 'edycja';
  let scanFile = null;

  for (let i = 1; i < args.length; i++) {
    if ((args[i] === '--photographer' || args[i] === '-p') && args[i + 1]) {
      photographerId = args[++i];
    } else if ((args[i] === '--threshold' || args[i] === '-t') && args[i + 1]) {
      threshold = parseInt(args[++i], 10);
    } else if ((args[i] === '--out' || args[i] === '-o') && args[i + 1]) {
      outDirName = args[++i];
    } else if ((args[i] === '--scan' || args[i] === '--from') && args[i + 1]) {
      scanFile = args[++i];
    }
  }

  if (photographerId && !PHOTOGRAPHERS.find(p => p.id === photographerId)) {
    console.error(`Nieznany fotograf: "${photographerId}"`);
    console.error(`Dostępne: ${PHOTOGRAPHERS.map(p => p.id).join(', ')}`);
    process.exit(1);
  }

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

  // Wczytaj listę z _scan.json lub skanuj cały katalog
  let images;
  if (scanFile) {
    try {
      const scan = JSON.parse(await readFile(scanFile, 'utf-8'));
      images = scan.candidates.map(c => c.path);
      console.log(`  Kandydaci z pre-filtru: ${images.length} (z ${scan.summary.total} oryginałów, redukcja ${scan.summary.reductionPercent}%)\n`);
    } catch {
      console.error(`Nie można wczytać scan file: ${scanFile}`);
      process.exit(1);
    }
  } else {
    let files;
    try {
      files = await readdir(dirPath);
    } catch {
      console.error(`Nie można odczytać katalogu: ${dirPath}`);
      process.exit(1);
    }
    images = files
      .filter(f => VALID_EXTS.has(extname(f).toLowerCase()))
      .map(f => join(dirPath, f))
      .sort();
  }

  if (images.length === 0) {
    console.error('Brak zdjęć do analizy.');
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Picker Photo — Krok 1: Selekcja                    │
├─────────────────────────────────────────────────────┤
│  Fotograf : ${photographer.name.padEnd(40)}│
│  Katalog  : ${dirPath.slice(-40).padEnd(40)}│
│  Zdjęcia  : ${String(images.length).padEnd(40)}│
│  Próg     : ≥ ${String(threshold).padEnd(38)}│
└─────────────────────────────────────────────────────┘
`);

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Brak ANTHROPIC_API_KEY. Ustaw: export ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic();
  const results = [];

  for (let i = 0; i < images.length; i++) {
    const imagePath = images[i];
    const name = basename(imagePath);
    const prefix = `[${String(i + 1).padStart(String(images.length).length)}/${images.length}]`;
    process.stdout.write(`${prefix} ${name.slice(0, 35).padEnd(35)} `);

    try {
      const result = await analyzeImage(client, imagePath, photographerId);
      const score = Math.max(0, Math.min(100, Math.round(result.score)));
      results.push({ path: imagePath, name, score, reasoning: result.reasoning, editSuggestion: result.editSuggestion });
      console.log(`${String(score).padStart(3)}  ${scoreBar(score)}  ${scoreCategory(score, threshold)}`);
    } catch (err) {
      console.log(`  —  błąd: ${err.message.slice(0, 40)}`);
      results.push({ path: imagePath, name, score: 0, reasoning: 'error', editSuggestion: '', error: true });
    }
  }

  const picks   = results.filter(r => !r.error && r.score >= threshold);
  const maybes  = results.filter(r => !r.error && r.score >= 60 && r.score < threshold);
  const rejects = results.filter(r => !r.error && r.score < 60);
  const errors  = results.filter(r => r.error);

  console.log(`
───────────────────────────────────────────
  PICKS         ${String(picks.length).padStart(3)} zdjęć  (score ≥ ${threshold})
  DO ROZWAŻENIA ${String(maybes.length).padStart(3)} zdjęć  (60–${threshold - 1})
  ODRZUCONE     ${String(rejects.length).padStart(3)} zdjęć
${errors.length > 0 ? `  BŁĘDY         ${String(errors.length).padStart(3)} zdjęć\n` : ''}───────────────────────────────────────────
`);

  if (picks.length === 0) {
    console.log('Brak zdjęć powyżej progu — nic do skopiowania.');
    process.exit(0);
  }

  const outDir = join(dirPath, outDirName);
  await mkdir(outDir, { recursive: true });

  console.log(`Kopiowanie PICKS (oryginały) do: ${outDir}\n`);

  for (const pick of picks.sort((a, b) => b.score - a.score)) {
    const outPath = join(outDir, pick.name);
    process.stdout.write(`  ${String(pick.score).padStart(3)}  ${pick.name.slice(0, 40).padEnd(40)} `);
    try {
      await copyFile(pick.path, outPath);
      console.log('✓');
    } catch (err) {
      console.log(`✗  ${err.message.slice(0, 40)}`);
    }
  }

  const report = {
    photographer: photographer.name,
    photographerId,
    directory: dirPath,
    outputDirectory: outDir,
    date: new Date().toISOString(),
    threshold,
    summary: { picks: picks.length, maybes: maybes.length, rejects: rejects.length },
    results: results.sort((a, b) => b.score - a.score),
  };

  const reportPath = join(outDir, '_raport.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`
✓ Krok 1 gotowy!
  ${picks.length} oryginałów w: ${outDir}
  Raport: ${reportPath}

Krok 2 — obróbka stylistyczna:
  npm run edit -- "${outDir}"
`);
}

main().catch(err => {
  console.error('\nBłąd:', err.message);
  process.exit(1);
});
