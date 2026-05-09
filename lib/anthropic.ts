import Anthropic from '@anthropic-ai/sdk';
import { PHOTOGRAPHERS } from './photographers';

const client = new Anthropic();

export interface AnalysisResult {
  score: number;
  reasoning: string;
  editSuggestion: string;
}

export async function analyzePhoto(
  imageBase64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
  photographerId: string
): Promise<AnalysisResult> {
  const photographer = PHOTOGRAPHERS.find((p) => p.id === photographerId);
  if (!photographer) throw new Error('Unknown photographer');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: photographer.systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Score this photo. Return ONLY valid JSON.',
          },
        ],
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as AnalysisResult;
}
