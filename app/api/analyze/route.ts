import { NextRequest, NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType, photographerId, photoId } = await req.json();

    if (!imageBase64 || !mediaType || !photographerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await analyzePhoto(imageBase64, mediaType, photographerId);

    return NextResponse.json({ photoId, ...result });
  } catch (err) {
    console.error('Analyze error:', err);
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
