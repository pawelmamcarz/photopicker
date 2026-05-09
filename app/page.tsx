'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGallery } from '@/lib/store';
import PhotographerSelector from '@/components/PhotographerSelector';

export default function HomePage() {
  const router = useRouter();
  const { setPhotographerId, resetGallery } = useGallery();
  const [selected, setSelected] = useState<string | null>(null);

  const handleNext = () => {
    if (!selected) return;
    resetGallery();
    setPhotographerId(selected);
    router.push('/gallery');
  };

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-10 text-center">
          <h1 className="text-5xl font-bold text-white tracking-tight mb-3">
            Picker Photo
          </h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Prześlij galerię zdjęć. Wybierz mistrza fotografii. AI oceni każde zdjęcie
            i zaproponuje edycję w wybranym stylu.
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-4 mb-10 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-white text-zinc-950 flex items-center justify-center text-xs font-bold">
              1
            </span>
            <span className="text-white font-medium">Wybierz fotografa</span>
          </div>
          <span className="text-zinc-700">—</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center text-xs font-bold">
              2
            </span>
            <span>Prześlij zdjęcia</span>
          </div>
          <span className="text-zinc-700">—</span>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center text-xs font-bold">
              3
            </span>
            <span>Wyniki</span>
          </div>
        </div>

        {/* Photographer grid */}
        <PhotographerSelector selected={selected} onSelect={setSelected} />

        {/* CTA */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={handleNext}
            disabled={!selected}
            className="px-10 py-3.5 bg-white text-zinc-950 font-semibold rounded-xl disabled:opacity-25 disabled:cursor-not-allowed hover:bg-zinc-100 transition-colors text-base"
          >
            Dalej →
          </button>
        </div>
      </div>
    </main>
  );
}
