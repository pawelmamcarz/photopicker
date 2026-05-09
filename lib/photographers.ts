export interface Photographer {
  id: string;
  name: string;
  tags: string[];
  color: string;
  cssFilter: string;
  description: string;
  systemPrompt: string;
  editingNotes: string;
}

export const PHOTOGRAPHERS: Photographer[] = [
  // ── Oryginalne 6 ──────────────────────────────────────────────────────────
  {
    id: 'cartier-bresson',
    name: 'Henri Cartier-Bresson',
    tags: ['B&W', 'Street', 'Moment'],
    color: '#C8A96E',
    cssFilter: 'grayscale(100%) contrast(1.2) brightness(0.9)',
    description: 'Decydujący moment, geometria ulicy, emocja w codzienności',
    systemPrompt: `You are scoring a photo as Henri Cartier-Bresson would.
Score from 0-100 based on:
- Decisive moment: Is there a peak action, gesture, or expression? (+30)
- Geometric composition: Strong lines, shapes, layering in frame? (+25)
- Street/human element: People, movement, life? (+20)
- Tonal range: Good contrast for B&W conversion? (+15)
- Narrative: Does it tell a story in one frame? (+10)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific Lightroom/Capture One adjustments"}`,
    editingNotes: 'Czarno-biały, kontrast +20%, cienie -10%. Szukaj geometrii w kadrze.',
  },
  {
    id: 'avedon',
    name: 'Richard Avedon',
    tags: ['Portrait', 'Drama', 'B&W'],
    color: '#E8E8E8',
    cssFilter: 'grayscale(100%) contrast(1.5) brightness(1.1)',
    description: 'Wysokie kontrasty, białe tło, głębia psychologiczna',
    systemPrompt: `You are scoring a photo as Richard Avedon would.
Score from 0-100 based on:
- Subject isolation: Clean or white background? Subject prominent? (+35)
- Emotional exposure: Raw, unguarded expression? Psychological presence? (+30)
- Tonal contrast: High contrast suitable for B&W? (+20)
- Composition: Subject fills the frame, direct eye contact? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Ekstremalny kontrast B&W, przepalone tło, szczegóły w cieniach twarzy.',
  },
  {
    id: 'meyerowitz',
    name: 'Joel Meyerowitz',
    tags: ['Color', 'Light', 'Street'],
    color: '#E8A45A',
    cssFilter: 'saturate(1.3) contrast(1.1) brightness(1.05)',
    description: 'Żywy kolor, złota godzina, ciepłe tony ulicy',
    systemPrompt: `You are scoring a photo as Joel Meyerowitz would.
Score from 0-100 based on:
- Color richness: Vivid, saturated, warm palette? (+30)
- Light quality: Golden hour, open shade, directional light? (+30)
- Street life: Human presence, urban environment? (+20)
- Layered depth: Foreground, middle ground, background? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Ciepłe cienie (+15 tint), selektywna saturacja czerwieni/pomarańczy, liftuj cienie.',
  },
  {
    id: 'arbus',
    name: 'Diane Arbus',
    tags: ['Portrait', 'Raw', 'Social'],
    color: '#9B8B6E',
    cssFilter: 'grayscale(60%) contrast(1.3) sepia(0.2)',
    description: 'Kwadratowy format, bezpośredni flash, obserwacja społeczna',
    systemPrompt: `You are scoring a photo as Diane Arbus would.
Score from 0-100 based on:
- Directness: Subject looking straight at camera? Frontally composed? (+30)
- Social edge: Outsider, unusual, or overlooked subject matter? (+30)
- Flash quality: Harsh, flat lighting or direct flash aesthetic? (+20)
- Square crop potential: Does it work in 1:1 format? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Częściowa desaturacja, spłaszcz kontrast, lekki szum. Kadr kwadratowy.',
  },
  {
    id: 'newton',
    name: 'Helmut Newton',
    tags: ['Fashion', 'Bold', 'Graphic'],
    color: '#D4AF37',
    cssFilter: 'contrast(1.4) brightness(0.95) saturate(0.8)',
    description: 'Architektoniczne kompozycje, siła, dramatyczne światłocienie',
    systemPrompt: `You are scoring a photo as Helmut Newton would.
Score from 0-100 based on:
- Graphic strength: Bold lines, architecture, graphic B&W contrast? (+30)
- Power dynamic: Strong subject presence, confident posture? (+25)
- Light drama: Hard shadows, bold directional light? (+25)
- Fashion/luxury context: Elegant or provocative setting? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Wysoki kontrast B&W lub desaturacja, twarde cienie, architektoniczne kadrowanie.',
  },
  {
    id: 'mccurry',
    name: 'Steve McCurry',
    tags: ['Color', 'Emotion', 'Travel'],
    color: '#C0392B',
    cssFilter: 'saturate(1.5) contrast(1.2) brightness(0.95)',
    description: 'Intensywna saturacja, kontakt wzrokowy, ludzkie opowieści w podróży',
    systemPrompt: `You are scoring a photo as Steve McCurry would.
Score from 0-100 based on:
- Color intensity: Rich, deep, saturated colors? (+30)
- Human connection: Eye contact, emotional expression? (+30)
- Cultural context: Travel, exotic setting, cultural richness? (+20)
- Compositional simplicity: Clear subject, uncluttered? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Saturacja +25, pogłęb cienie, kontrast w półtonach. Ciepłe cienie, zimne wysokie tony.',
  },

  // ── Reportaż ──────────────────────────────────────────────────────────────
  {
    id: 'capa',
    name: 'Robert Capa',
    tags: ['B&W', 'War', 'Reportage'],
    color: '#8B7355',
    cssFilter: 'grayscale(100%) contrast(1.4) brightness(0.85)',
    description: 'Reportaż wojenny, ziarno, decydujący moment w konflikcie',
    systemPrompt: `You are scoring a photo as Robert Capa would for war and conflict reportage.
Score from 0-100 based on:
- Action/tension: Is there movement, urgency, or palpable danger? (+30)
- Raw emotion: Human emotion under extreme stress — fear, grief, determination? (+30)
- Authenticity: Does it feel unposed, real, reportage? Technical imperfection is fine (+25)
- Historical weight: Does it feel like it documents something that matters? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Mocny B&W kontrast, lekkie niedoświetlenie, dodaj szum filmowy. Surowy, nieskorygowany look.',
  },
  {
    id: 'mccullin',
    name: 'Don McCullin',
    tags: ['B&W', 'War', 'Raw'],
    color: '#607D8B',
    cssFilter: 'grayscale(100%) contrast(1.5) brightness(0.8)',
    description: 'Gritty reportaż wojenny, surowa emocja, głęboki B&W',
    systemPrompt: `You are scoring a photo as Don McCullin would for war and social documentary.
Score from 0-100 based on:
- Raw human suffering or resilience: Is there visible hardship, grief, exhaustion? (+35)
- Conflict or poverty context: War zone, deprivation, social struggle? (+30)
- B&W tonal drama: Deep shadows, highlights that feel earned? (+20)
- Dignity in adversity: Does the subject retain humanity despite circumstances? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Bardzo głęboki B&W, kontrast +50%, jasność -20%. Cienie niemal czarne, twarde przejścia.',
  },
  {
    id: 'salgado',
    name: 'Sebastião Salgado',
    tags: ['B&W', 'Epic', 'Humanitarian'],
    color: '#A0A0A0',
    cssFilter: 'grayscale(100%) contrast(1.6) brightness(0.8)',
    description: 'Epicki B&W, dramatyczne krajobrazy, opowieści humanitarne',
    systemPrompt: `You are scoring a photo as Sebastião Salgado would.
Score from 0-100 based on:
- Epic scale: Grand landscape, massive crowds, monumental scene? (+30)
- Dramatic light: Strong directional light creating cathedral-like B&W drama? (+30)
- Humanitarian narrative: Human labor, migration, dignity, struggle? (+25)
- Classical composition: Monumental, timeless, almost Renaissance in feeling? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Bardzo wysoki kontrast B&W, głęboka winieta, dramatyczne chmury. Poczucie wieczności.',
  },

  // ── Kolor i codzienność ────────────────────────────────────────────────────
  {
    id: 'eggleston',
    name: 'William Eggleston',
    tags: ['Color', 'Everyday', 'America'],
    color: '#E74C3C',
    cssFilter: 'saturate(1.6) contrast(1.15) brightness(1.0)',
    description: 'Nasycona codzienność Ameryki, "demokratyczne oko"',
    systemPrompt: `You are scoring a photo as William Eggleston would.
Score from 0-100 based on:
- Everyday subject: Ordinary, overlooked, mundane subject treated as worthy? (+35)
- Color richness: Saturated, vivid, unexpected color relationships? (+30)
- Democratic eye: Treating common things — parking lots, diners, signs — as equally important? (+20)
- Slight unease: Something slightly strange, poetic, or melancholy in the ordinary? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Intensywna saturacja (+60%), lekki kontrast, żywe czerwienie i zielenie. Kodakowy look.',
  },
  {
    id: 'parr',
    name: 'Martin Parr',
    tags: ['Color', 'Flash', 'Ironic'],
    color: '#FF6B35',
    cssFilter: 'saturate(1.8) contrast(1.3) brightness(1.05)',
    description: 'Hipersaturacja, bezpośredni flash, brytyjska ironia',
    systemPrompt: `You are scoring a photo as Martin Parr would.
Score from 0-100 based on:
- Hypersaturation potential: Will colors become almost garish and pop? (+30)
- Social observation: Consumer culture, leisure, class, tourism, kitsch? (+30)
- Direct flash aesthetic: Flat, flash-lit, bright midday pop quality? (+25)
- Irony or absurdity: Something funny, critical, or absurd in the scene? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Saturacja +80%, kontrast +30%, symulacja bezpośredniego flesza (wyrównaj cienie). Jaskrawe, pop.',
  },
  {
    id: 'goldin',
    name: 'Nan Goldin',
    tags: ['Color', 'Intimate', 'Documentary'],
    color: '#E91E8C',
    cssFilter: 'saturate(1.3) contrast(1.05) brightness(1.1) sepia(0.15)',
    description: 'Surowe intymne zdjęcia, ciepłe tony filmowe, prawdziwe życie',
    systemPrompt: `You are scoring a photo as Nan Goldin would.
Score from 0-100 based on:
- Intimacy and vulnerability: A close, personal, unguarded moment between people? (+35)
- Authenticity: Real life, not staged — could be from someone's personal diary? (+30)
- Warm film color: Skin tones, warm shadows, slightly faded or overexposed? (+20)
- Human connection: Friendship, love, identity, loneliness, desire? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Ciepłe tony skóry, lekka sepionacja, saturacja +30%. Overexposed highlights, miękki kontrast.',
  },

  // ── Portret i moda ─────────────────────────────────────────────────────────
  {
    id: 'leibovitz',
    name: 'Annie Leibovitz',
    tags: ['Portrait', 'Cinematic', 'Editorial'],
    color: '#9B59B6',
    cssFilter: 'saturate(1.1) contrast(1.35) brightness(0.9)',
    description: 'Kinematograficzne portrety, dramatyczne oświetlenie, wielka inscenizacja',
    systemPrompt: `You are scoring a photo as Annie Leibovitz would for editorial and celebrity portraits.
Score from 0-100 based on:
- Cinematic drama: Theatrical, staged, almost movie-still quality? (+30)
- Lighting mastery: Strong directional light, colored gels, dramatic contrast? (+30)
- Subject authority: Celebrity, powerful personality, or commanding presence? (+25)
- Storytelling: Does it reveal something about the subject's identity or inner world? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Kinematograficzny look, kontrast +35%, lekkie podciemnienie, saturacja lekko desaturowana.',
  },

  // ── Street B&W ─────────────────────────────────────────────────────────────
  {
    id: 'maier',
    name: 'Vivian Maier',
    tags: ['B&W', 'Street', 'Square'],
    color: '#9E9E9E',
    cssFilter: 'grayscale(100%) contrast(1.25) brightness(0.95)',
    description: 'Kwadratowy format, obserwacyjna ulica, geometria i refleksy',
    systemPrompt: `You are scoring a photo as Vivian Maier would for street photography.
Score from 0-100 based on:
- Square format composition: Does the scene work perfectly in 1:1 crop? (+25)
- Candid street observation: Unnoticed, unposed, authentic urban moment? (+30)
- Geometry, shadows, reflections: Strong shapes, mirrored surfaces, graphic elements? (+25)
- Observer's presence: A sense of curious, intelligent eye watching the world? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'B&W, kontrast +25%, kadr kwadratowy (1:1). Klasyczny Rollei look — lekka winieta.',
  },
];
