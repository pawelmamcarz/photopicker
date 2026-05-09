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
  {
    id: 'cartier-bresson',
    name: 'Henri Cartier-Bresson',
    tags: ['B&W', 'Street', 'Moment'],
    color: '#C8A96E',
    cssFilter: 'grayscale(100%) contrast(1.2) brightness(0.9)',
    description: 'Decisive moment, street geometry, human emotion in everyday life',
    systemPrompt: `You are scoring a photo as Henri Cartier-Bresson would.
Score from 0-100 based on:
- Decisive moment: Is there a peak action, gesture, or expression? (+30)
- Geometric composition: Strong lines, shapes, layering in frame? (+25)
- Street/human element: People, movement, life? (+20)
- Tonal range: Good contrast for B&W conversion? (+15)
- Narrative: Does it tell a story in one frame? (+10)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific Lightroom/Capture One adjustments"}`,
    editingNotes: 'Convert to B&W, boost contrast, emphasize shadows. Look for geometric shapes in the frame.',
  },
  {
    id: 'avedon',
    name: 'Richard Avedon',
    tags: ['Portrait', 'Drama', 'B&W'],
    color: '#E8E8E8',
    cssFilter: 'grayscale(100%) contrast(1.5) brightness(1.1)',
    description: 'High contrast portraits, white backgrounds, psychological depth',
    systemPrompt: `You are scoring a photo as Richard Avedon would.
Score from 0-100 based on:
- Subject isolation: Clean or white background? Subject prominent? (+35)
- Emotional exposure: Raw, unguarded expression? Psychological presence? (+30)
- Tonal contrast: High contrast suitable for B&W? (+20)
- Composition: Subject fills the frame, direct eye contact? (+15)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Extreme B&W contrast, blown highlights on background, deep shadow detail in face.',
  },
  {
    id: 'meyerowitz',
    name: 'Joel Meyerowitz',
    tags: ['Color', 'Light', 'Street'],
    color: '#E8A45A',
    cssFilter: 'saturate(1.3) contrast(1.1) brightness(1.05)',
    description: 'Vivid color, golden hour light quality, warm street tones',
    systemPrompt: `You are scoring a photo as Joel Meyerowitz would.
Score from 0-100 based on:
- Color richness: Vivid, saturated, warm palette? (+30)
- Light quality: Golden hour, open shade, directional light? (+30)
- Street life: Human presence, urban environment? (+20)
- Layered depth: Foreground, middle ground, background? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Warm shadows (+15 tint), boost saturation selectively in reds/oranges, lift shadows slightly.',
  },
  {
    id: 'arbus',
    name: 'Diane Arbus',
    tags: ['Portrait', 'Raw', 'Social'],
    color: '#9B8B6E',
    cssFilter: 'grayscale(60%) contrast(1.3) sepia(0.2)',
    description: 'Square format, direct flash, unflinching social observation',
    systemPrompt: `You are scoring a photo as Diane Arbus would.
Score from 0-100 based on:
- Directness: Subject looking straight at camera? Frontally composed? (+30)
- Social edge: Outsider, unusual, or overlooked subject matter? (+30)
- Flash quality: Harsh, flat lighting or direct flash aesthetic? (+20)
- Square crop potential: Does it work in 1:1 format? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Partial desaturation, flatten contrast slightly, add slight grain. Square crop.',
  },
  {
    id: 'newton',
    name: 'Helmut Newton',
    tags: ['Fashion', 'Bold', 'Graphic'],
    color: '#D4AF37',
    cssFilter: 'contrast(1.4) brightness(0.95) saturate(0.8)',
    description: 'Architectural compositions, power, bold light and shadow',
    systemPrompt: `You are scoring a photo as Helmut Newton would.
Score from 0-100 based on:
- Graphic strength: Bold lines, architecture, graphic B&W contrast? (+30)
- Power dynamic: Strong subject presence, confident posture? (+25)
- Light drama: Hard shadows, bold directional light? (+25)
- Fashion/luxury context: Elegant or provocative setting? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'High contrast B&W or desaturated color, hard shadows, architectural framing.',
  },
  {
    id: 'mccurry',
    name: 'Steve McCurry',
    tags: ['Color', 'Emotion', 'Travel'],
    color: '#C0392B',
    cssFilter: 'saturate(1.5) contrast(1.2) brightness(0.95)',
    description: 'Intense saturation, direct eye contact, human travel stories',
    systemPrompt: `You are scoring a photo as Steve McCurry would.
Score from 0-100 based on:
- Color intensity: Rich, deep, saturated colors? (+30)
- Human connection: Eye contact, emotional expression? (+30)
- Cultural context: Travel, exotic setting, cultural richness? (+20)
- Compositional simplicity: Clear subject, uncluttered? (+20)
Return ONLY valid JSON: {"score": number, "reasoning": "2-3 sentences", "editSuggestion": "specific adjustments"}`,
    editingNotes: 'Boost saturation +25, deepen shadows, add contrast in midtones. Warm shadows, cool highlights.',
  },
];
