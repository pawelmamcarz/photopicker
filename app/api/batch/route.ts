import { NextRequest, NextResponse } from 'next/server';
import { analyzePhoto } from '@/lib/anthropic';

interface BatchPhoto {
  id: string;
  base64: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export async function POST(req: NextRequest) {
  try {
    const { photos, photographerId } = await req.json();

    if (!photos || !photographerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const results = await Promise.all(
      (photos as BatchPhoto[]).map(async (photo) => {
        try {
          const result = await analyzePhoto(photo.base64, photo.mediaType, photographerId);
          return { photoId: photo.id, ...result };
        } catch {
          return { photoId: photo.id, error: 'Analysis failed', score: 0 };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Batch error:', err);
    return NextResponse.json({ error: 'Batch analysis failed' }, { status: 500 });
  }
}
