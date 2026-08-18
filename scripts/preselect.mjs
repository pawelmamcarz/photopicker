#!/usr/bin/env node
/**
 * Picker Photo CLI — Krok 0.5: Lokalny AI pre-selektor (Ollama)
 *
 * Używa lokalnego modelu multimodalnego (llava, moondream itp.)
 * do wstępnej oceny zdjęć — zero kosztów API.
 * Czyta kandydatów z _scan.json lub całego katalogu.
 * Wyniki → _preselect.json → przekaż do: npm run pick --from
 *
 * Wymagania:
 *   brew install ollama
 *   ollama pull qwen2.5vl        # polecane — najlepszy stosunek jakości do rozm.
 *   ollama pull llama3.2-vision  # alternatywa Meta
 *   ollama pull minicpm-v        # szybki, mały
 *   ollama serve                 # uruchamia serwer (lub auto przy pull)
 *
 * Użycie:
 *   npm run preselect -- <katalog> [opcje]
 *   npm run preselect -- <katalog> --from _scan.json [opcje]
 *
 * Opcje:
 *   --from <plik>           Wejście: _scan.json z npm run scan
 *   -p, --photographer <id> Styl oceny (opcjonalne, lepsze wyniki)
 *   --model <model>         Model Ollama (domyślnie: qwen2.5vl)
 *   --top-percent <n>       Zachowaj top N% wg oceny (domyślnie: 20)
 *   --top <n>               Zachowaj dokładnie N zdjęć (nadpisuje --top-percent)
 *   --min-score <n>         Minimalny wynik 0-100 (domyślnie: 50)
 *   --ollama-url <url>      URL serwera Ollama (domyślnie: http://localhost:11434)
 *   -o, --out <plik>        Plik wyjściowy (domyślnie: <katalog>/_preselect.json)
 *   -w, --workers <n>       Równoległe zapytania (domyślnie: 2)
 *   --help
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, extname } from 'path';
import { createInterface } from 'readline';
import sharp from 'sharp';

// ─── Prompty oceny per fotograf ────────────────────────────────────────────

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

const PROMPTS = {
  'cartier-bresson':
    'Score this photo 0-100 as Henri Cartier-Bresson: decisive moment, street geometry, human emotion, B&W contrast potential.',
  'avedon':
    'Score this photo 0-100 as Richard Avedon: subject isolation, raw psychological expression, B&W portrait potential.',
  'meyerowitz':
    'Score this photo 0-100 as Joel Meyerowitz: vivid color, golden hour light, street life, layered depth.',
  'arbus':
    'Score this photo 0-100 as Diane Arbus: frontal direct subjects, social edge, flash aesthetic, square crop potential.',
  'newton':
    'Score this photo 0-100 as Helmut Newton: graphic bold lines, power, hard shadows, fashion/luxury context.',
  'mccurry':
    'Score this photo 0-100 as Steve McCurry: intense saturated color, eye contact, cultural richness, travel.',
  'capa':
    'Score this photo 0-100 as Robert Capa: action/tension, raw emotion, authentic unposed reportage feel.',
  'mccullin':
    'Score this photo 0-100 as Don McCullin: human suffering or resilience, conflict/poverty context, B&W tonal drama.',
  'salgado':
    'Score this photo 0-100 as Sebastião Salgado: epic scale, dramatic directional light, humanitarian narrative, monumental composition.',
  'eggleston':
    'Score this photo 0-100 as William Eggleston: ordinary overlooked subject, vivid unexpected color, mundane America, democratic eye.',
  'parr':
    'Score this photo 0-100 as Martin Parr: hypersaturated color, social observation, consumer culture, irony or absurdity.',
  'goldin':
    'Score this photo 0-100 as Nan Goldin: intimacy and vulnerability, authentic unposed moment, warm film tones, human connection.',
  'leibovitz':
    'Score this photo 0-100 as Annie Leibovitz: cinematic drama, strong lighting, powerful subject presence, storytelling.',
  'maier':
    'Score this photo 0-100 as Vivian Maier: square format composition, candid street observation, geometry and shadows.',
  '_generic':
    'Score this photo 0-100 on overall photographic quality: composition, lighting, sharpness, interesting subject, emotional impact.',
};

// ─── Ollama API ────────────────────────────────────────────────────────────

async function checkOllama(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function listModels(baseUrl) {
  const res = await fetch(`${baseUrl}/api/tags`);
  const data = await res.json();
  return (data.models || []).map(m => m.name);
}

async function ollamaScore(imagePath, prompt, model, baseUrl) {
  // Zmniejsz do 512px — szybciej, wystarczy dla oceny
  const resized = await sharp(imagePath)
    .rotate()
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const base64 = resized.toString('base64');

  const fullPrompt =
    `${prompt}\n\nRespond with ONLY valid JSON: {"score": <0-100>, "reason": "<one sentence>"}`;

  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      images: [base64],
      stream: false,
      options: { temperature: 0.1, num_predict: 80 },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);

  const data = await res.json();
  const text = data.response || '';

  // Wyciągnij JSON z odpowiedzi (model może dodać komentarz przed/po)
  const match = text.match(/\{[^}]+\}/);
  if (!match) throw new Error(`Brak JSON w odpowiedzi: ${text.slice(0, 80)}`);

  const parsed = JSON.parse(match[0]);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
  return { score, reason: String(parsed.reason || '').slice(0, 200) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const VALID_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

function scoreBar(score) {
  const filled = Math.round(score / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

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

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Picker Photo — Krok 0.5: Lokalny AI (Ollama)

Wymagania:
  brew install ollama
  ollama pull llava          # lub llava:13b, llava:34b, moondream
  ollama serve

Użycie:
  npm run preselect -- <katalog> [opcje]
  npm run preselect -- <katalog> --from <katalog>/_scan.json [opcje]

Opcje:
  --from <plik>           Kandydaci z _scan.json (po npm run scan)
  -p, --photographer <id> Styl oceny fotografa
  --model <model>         Model Ollama (domyślnie: qwen2.5vl)
  --top-percent <n>       Zachowaj top N% (domyślnie: 20)
  --top <n>               Zachowaj dokładnie N zdjęć
  --min-score <n>         Odrzuć poniżej tego wyniku (domyślnie: 50)
  --ollama-url <url>      URL Ollama (domyślnie: http://localhost:11434)
  -o, --out <plik>        Plik wyjściowy
  -w, --workers <n>       Równolegle (domyślnie: 2)

Fotografowie:
${PHOTOGRAPHERS.map(p => `  ${p.id.padEnd(22)} ${p.name}`).join('\n')}

Pełny workflow:
  npm run scan       -- /foto          → _scan.json
  npm run preselect  -- /foto --from _scan.json -p cartier-bresson
  npm run pick       -- /foto --from _preselect.json -p cartier-bresson
  npm run edit       -- /foto/edycja
`);
    process.exit(0);
  }

  const dirPath = args[0];
  let fromFile = null;
  let photographerId = null;
  let model = 'qwen2.5vl';
  let topPercent = 20;
  let topN = null;
  let minScore = 50;
  let ollamaUrl = 'http://localhost:11434';
  let outFile = null;
  let workers = 2;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1])                                  fromFile = args[++i];
    else if ((args[i] === '-p' || args[i] === '--photographer') && args[i+1]) photographerId = args[++i];
    else if (args[i] === '--model' && args[i + 1])                            model = args[++i];
    else if (args[i] === '--top-percent' && args[i + 1])                      topPercent = parseFloat(args[++i]);
    else if (args[i] === '--top' && args[i + 1])                              topN = parseInt(args[++i], 10);
    else if (args[i] === '--min-score' && args[i + 1])                        minScore = parseInt(args[++i], 10);
    else if (args[i] === '--ollama-url' && args[i + 1])                       ollamaUrl = args[++i];
    else if ((args[i] === '-o' || args[i] === '--out') && args[i + 1])        outFile = args[++i];
    else if ((args[i] === '-w' || args[i] === '--workers') && args[i + 1])    workers = parseInt(args[++i], 10);
  }

  if (!outFile) outFile = join(dirPath, '_preselect.json');

  // Interaktywny wybór fotografa
  if (!photographerId) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log('\nWybierz fotografa (Enter = ogólna jakość):\n');
    PHOTOGRAPHERS.forEach((p, i) =>
      console.log(`  ${String(i + 1).padStart(2)}. ${p.name.padEnd(26)} ${p.tags}`)
    );
    console.log('   0. Ogólna jakość fotograficzna\n');
    const answer = await ask(rl, 'Numer (0-14): ');
    rl.close();
    const idx = parseInt(answer, 10);
    if (idx === 0) {
      photographerId = '_generic';
    } else if (idx >= 1 && idx <= PHOTOGRAPHERS.length) {
      photographerId = PHOTOGRAPHERS[idx - 1].id;
    } else {
      photographerId = '_generic';
    }
  }

  const photographer = PHOTOGRAPHERS.find(p => p.id === photographerId);
  const prompt = PROMPTS[photographerId] || PROMPTS['_generic'];

  // Sprawdź Ollama
  console.log(`\nSprawdzam Ollama pod: ${ollamaUrl} ...`);
  const ollamaOk = await checkOllama(ollamaUrl);
  if (!ollamaOk) {
    console.error(`\n✗ Ollama nie odpowiada na ${ollamaUrl}`);
    console.error('  Uruchom: ollama serve');
    console.error('  Zainstaluj: brew install ollama && ollama pull llava');
    process.exit(1);
  }

  // Sprawdź model
  const models = await listModels(ollamaUrl);
  const modelAvailable = models.some(m => m === model || m.startsWith(model + ':'));
  if (!modelAvailable) {
    console.error(`\n✗ Model "${model}" nie jest zainstalowany.`);
    console.error(`  Dostępne modele: ${models.join(', ') || '(brak)'}`);
    console.error(`  Zainstaluj: ollama pull ${model}`);
    process.exit(1);
  }
  console.log(`  ✓ Model: ${model}\n`);

  // Wczytaj kandydatów
  let images;
  let sourceTotal = null;

  if (fromFile) {
    try {
      const scan = JSON.parse(await readFile(fromFile, 'utf-8'));
      images = scan.candidates.map(c => ({ path: c.path, name: c.name }));
      sourceTotal = scan.summary?.total;
      console.log(`  Z pre-filtru: ${images.length} kandydatów${sourceTotal ? ` (z ${sourceTotal} oryginałów)` : ''}`);
    } catch {
      console.error(`Nie można wczytać: ${fromFile}`);
      process.exit(1);
    }
  } else {
    let files;
    try { files = await readdir(dirPath); } catch {
      console.error(`Nie można odczytać: ${dirPath}`); process.exit(1);
    }
    images = files
      .filter(f => VALID_EXTS.has(extname(f).toLowerCase()))
      .map(f => ({ path: join(dirPath, f), name: f }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  if (images.length === 0) {
    console.error('Brak zdjęć do analizy.');
    process.exit(1);
  }

  console.log(`
┌─────────────────────────────────────────────────────┐
│  Picker Photo — Krok 0.5: Lokalny AI (Ollama)       │
├─────────────────────────────────────────────────────┤
│  Model    : ${model.padEnd(40)}│
│  Fotograf : ${(photographer?.name || 'Ogólna jakość').padEnd(40)}│
│  Zdjęcia  : ${String(images.length).padEnd(40)}│
│  Wątki    : ${String(workers).padEnd(40)}│
│  Min score: ${String(minScore).padEnd(40)}│
└─────────────────────────────────────────────────────┘
`);

  // Analiza
  let done = 0;
  const scored = await pLimit(images, async ({ path: imgPath, name }) => {
    const prefix = `[${String(++done).padStart(String(images.length).length)}/${images.length}]`;
    process.stdout.write(`${prefix} ${name.slice(0, 34).padEnd(34)} `);
    try {
      const { score, reason } = await ollamaScore(imgPath, prompt, model, ollamaUrl);
      const cat = score >= 75 ? 'PICK ' : score >= 60 ? 'MAYBE' : 'skip ';
      console.log(`${String(score).padStart(3)}  ${scoreBar(score)}  ${cat}`);
      return { path: imgPath, name, score, reason, error: false };
    } catch (err) {
      console.log(`  —  błąd: ${err.message.slice(0, 35)}`);
      return { path: imgPath, name, score: 0, reason: 'error', error: true };
    }
  }, workers);

  // Filtrowanie i ranking
  const valid = scored.filter(m => !m.error && m.score >= minScore);
  const sorted = valid.sort((a, b) => b.score - a.score);

  let candidates;
  if (topN !== null) {
    candidates = sorted.slice(0, topN);
  } else {
    const cutoff = Math.max(1, Math.round(images.length * topPercent / 100));
    candidates = sorted.slice(0, cutoff);
  }

  const errors = scored.filter(m => m.error);

  console.log(`
─────────────────────────────────────────────
  Przeskanowane  : ${images.length}
  Poniżej progu  : ${valid.length < images.length ? images.length - valid.length - errors.length : 0}
${errors.length > 0 ? `  Błędy          : ${errors.length}\n` : ''}  Kandydaci → AI : ${candidates.length}  (top ${topN ? topN : topPercent + '%'})
─────────────────────────────────────────────
`);

  // Zapis
  const report = {
    directory: dirPath,
    date: new Date().toISOString(),
    model,
    photographer: photographer?.name || 'generic',
    photographerId,
    settings: { minScore, topPercent, topN },
    summary: {
      input: images.length,
      sourceTotal,
      candidates: candidates.length,
    },
    candidates: candidates.map(m => ({
      path: m.path,
      name: m.name,
      localScore: m.score,
      localReason: m.reason,
    })),
  };

  await writeFile(outFile, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`✓ Gotowe! Raport: ${outFile}

Następny krok — Claude ocenia ${candidates.length} najlepszych:
  npm run pick -- "${dirPath}" --from "${outFile}" -p ${photographerId !== '_generic' ? photographerId : '<fotograf>'}
`);
}

main().catch(err => {
  console.error('\nBłąd:', err.message);
  process.exit(1);
});
