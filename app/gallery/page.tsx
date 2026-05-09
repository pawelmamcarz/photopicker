'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGallery } from '@/lib/store';
import { PHOTOGRAPHERS } from '@/lib/photographers';
import { Photo } from '@/lib/types';
import PhotoGrid from '@/components/PhotoGrid';
import AnalyzeButton from '@/components/AnalyzeButton';

function generateId(): string {
  return `photo_${Math.random().toString(36).slice(2, 9)}`;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export default function GalleryPage() {
  const router = useRouter();
  const { photographerId, photos, setPhotos, updatePhoto } = useGallery();
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!photographerId) router.replace('/');
  }, [photographerId, router]);

  const photographer = PHOTOGRAPHERS.find((p) => p.id === photographerId);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) =>
      (VALID_TYPES as readonly string[]).includes(f.type)
    );
    const newPhotos: Photo[] = arr.map((file) => ({
      id: generateId(),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      mediaType: file.type as Photo['mediaType'],
      status: 'pending',
    }));
    setPhotos([...photos, ...newPhotos].slice(0, 20));
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter((p) => p.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!photographerId || photos.length === 0) return;
    setAnalyzing(true);
    setProgress(0);

    const pending = photos.filter((p) => p.status === 'pending');
    pending.forEach((p) => updatePhoto(p.id, { status: 'analyzing' }));

    let completed = 0;

    await Promise.all(
      pending.map(async (photo) => {
        setProgressLabel(`Analiza: ${photo.name}`);
        try {
          const base64 = await fileToBase64(photo.file!);
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: base64,
              mediaType: photo.mediaType,
              photographerId,
              photoId: photo.id,
            }),
          });

          if (!res.ok) throw new Error('API error');

          const data = await res.json();
          updatePhoto(photo.id, {
            score: data.score,
            reasoning: data.reasoning,
            editSuggestion: data.editSuggestion,
            status: 'done',
          });
        } catch {
          updatePhoto(photo.id, { status: 'error' });
        }

        completed++;
        setProgress(Math.round((completed / pending.length) * 100));
      })
    );

    setAnalyzing(false);
    router.push('/results');
  };

  const pendingCount = photos.filter((p) => p.status === 'pending').length;

  if (!photographerId) return null;

  return (
    <main className="min-h-screen p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-zinc-500 hover:text-zinc-300 text-sm mb-2 flex items-center gap-1 transition-colors"
            >
              ← Zmień fotografa
            </button>
            <h1 className="text-3xl font-bold text-white">Galeria</h1>
            {photographer && (
              <p className="text-zinc-400 mt-1 text-sm">
                Styl:{' '}
                <span style={{ color: photographer.color }} className="font-semibold">
                  {photographer.name}
                </span>
              </p>
            )}
          </div>

          {photos.length > 0 && !analyzing && (
            <AnalyzeButton
              count={pendingCount}
              onClick={handleAnalyze}
              disabled={pendingCount === 0}
            />
          )}
        </div>

        {/* Progress */}
        {analyzing && (
          <div className="mb-8 bg-zinc-900 rounded-xl p-5">
            <div className="flex justify-between text-sm text-zinc-400 mb-2">
              <span className="truncate pr-4">{progressLabel || 'Analizowanie...'}</span>
              <span className="font-mono flex-shrink-0">{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Drop zone */}
        {!analyzing && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`mb-6 border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-150 ${
              isDragging
                ? 'border-white bg-zinc-800/60'
                : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="text-4xl mb-3">📷</div>
            <p className="text-zinc-200 font-medium text-base">
              Przeciągnij zdjęcia lub kliknij, aby wybrać
            </p>
            <p className="text-zinc-500 text-sm mt-1">
              JPEG · PNG · WebP &nbsp;·&nbsp; max 20 zdjęć
              {photos.length > 0 && (
                <span className="ml-2 text-zinc-400">
                  ({photos.length}/20 dodanych)
                </span>
              )}
            </p>
          </div>
        )}

        {/* Grid */}
        {photos.length > 0 && (
          <PhotoGrid
            photos={photos}
            cssFilter={photographer?.cssFilter}
            onRemove={!analyzing ? removePhoto : undefined}
          />
        )}

        {/* Bottom CTA when photos loaded */}
        {photos.length > 0 && !analyzing && pendingCount > 0 && (
          <div className="mt-8 flex justify-center">
            <AnalyzeButton
              count={pendingCount}
              onClick={handleAnalyze}
              disabled={pendingCount === 0}
            />
          </div>
        )}
      </div>
    </main>
  );
}
