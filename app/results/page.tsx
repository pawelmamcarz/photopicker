'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGallery } from '@/lib/store';
import { PHOTOGRAPHERS } from '@/lib/photographers';
import { Photo } from '@/lib/types';
import PhotoCard from '@/components/PhotoCard';
import Lightbox from '@/components/Lightbox';

function SectionHeader({
  label,
  count,
  range,
  color,
}: {
  label: string;
  count: number;
  range: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span
        className="px-3 py-1 rounded-lg text-sm font-bold"
        style={{ backgroundColor: color + '18', color }}
      >
        {label}
      </span>
      <span className="text-zinc-500 text-sm">{range}</span>
      <span className="ml-auto text-zinc-400 text-sm font-mono">{count}</span>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { photos, photographerId, resetGallery } = useGallery();
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && photos.filter((p) => p.status === 'done').length === 0) {
      router.replace('/gallery');
    }
  }, [mounted, photos, router]);

  const photographer = PHOTOGRAPHERS.find((p) => p.id === photographerId);
  const done = photos.filter((p) => p.status === 'done' || p.status === 'error');
  const picks = photos.filter((p) => p.status === 'done' && (p.score ?? 0) >= 75);
  const maybes = photos.filter(
    (p) => p.status === 'done' && (p.score ?? 0) >= 60 && (p.score ?? 0) < 75
  );
  const rejects = photos.filter(
    (p) => p.status === 'done' && (p.score ?? 0) < 60
  );

  const handleReset = () => {
    resetGallery();
    router.push('/');
  };

  if (!mounted || done.length === 0) return null;

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Wyniki</h1>
            {photographer && (
              <p className="text-zinc-400 text-sm">
                Styl:{' '}
                <span style={{ color: photographer.color }} className="font-semibold">
                  {photographer.name}
                </span>
                {photographer.editingNotes && (
                  <span className="block text-zinc-500 mt-0.5 text-xs max-w-md">
                    {photographer.editingNotes}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => router.push('/gallery')}
              className="px-4 py-2 border border-zinc-700 text-zinc-300 rounded-lg hover:border-zinc-500 transition-colors text-sm"
            >
              ← Galeria
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-sm font-medium"
            >
              Nowa sesja
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          <div className="bg-zinc-900 rounded-xl p-4 text-center border border-zinc-800">
            <div className="text-3xl font-bold text-green-400 tabular-nums mb-1">
              {picks.length}
            </div>
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Picks</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 text-center border border-zinc-800">
            <div className="text-3xl font-bold text-yellow-400 tabular-nums mb-1">
              {maybes.length}
            </div>
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Do rozważenia</div>
          </div>
          <div className="bg-zinc-900 rounded-xl p-4 text-center border border-zinc-800">
            <div className="text-3xl font-bold text-zinc-500 tabular-nums mb-1">
              {rejects.length}
            </div>
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Odrzucone</div>
          </div>
        </div>

        {/* PICKS */}
        {picks.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              label="PICKS ✓"
              count={picks.length}
              range="score ≥ 75"
              color="#22c55e"
            />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {picks
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((photo) => (
                  <div
                    key={photo.id}
                    className="ring-2 ring-green-500/25 rounded-xl overflow-hidden"
                  >
                    <PhotoCard
                      photo={photo}
                      showScore
                      onClick={() => setLightboxPhoto(photo)}
                    />
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* MAYBES */}
        {maybes.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              label="DO ROZWAŻENIA"
              count={maybes.length}
              range="60–74"
              color="#eab308"
            />
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {maybes
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((photo) => (
                  <div
                    key={photo.id}
                    className="ring-1 ring-yellow-500/20 rounded-lg overflow-hidden"
                  >
                    <PhotoCard
                      photo={photo}
                      showScore
                      onClick={() => setLightboxPhoto(photo)}
                    />
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* REJECTS */}
        {rejects.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              label="ODRZUCONE"
              count={rejects.length}
              range="< 60"
              color="#71717a"
            />
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
              {rejects
                .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
                .map((photo) => (
                  <div key={photo.id} className="opacity-40 hover:opacity-70 transition-opacity">
                    <PhotoCard
                      photo={photo}
                      showScore
                      onClick={() => setLightboxPhoto(photo)}
                    />
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </main>
  );
}
