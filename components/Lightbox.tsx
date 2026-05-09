'use client';

import { useEffect } from 'react';
import { Photo } from '@/lib/types';
import ScoreBar from './ScoreBar';

interface Props {
  photo: Photo;
  onClose: () => void;
}

function scoreBadge(score: number): { label: string; className: string } {
  if (score >= 75) return { label: 'PICK', className: 'bg-green-500/20 text-green-400' };
  if (score >= 60) return { label: 'MAYBE', className: 'bg-yellow-500/20 text-yellow-400' };
  return { label: 'ODRZUCONE', className: 'bg-zinc-700 text-zinc-400' };
}

export default function Lightbox({ photo, onClose }: Props) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const badge = photo.score !== undefined ? scoreBadge(photo.score) : null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="max-w-5xl w-full bg-zinc-900 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="flex-1 flex items-center justify-center bg-zinc-950 min-h-64">
          <img
            src={photo.url}
            alt={photo.name}
            className="max-h-[75vh] max-w-full object-contain"
          />
        </div>

        {/* Sidebar */}
        <div className="w-full md:w-72 p-6 flex flex-col border-t md:border-t-0 md:border-l border-zinc-800">
          <div className="flex justify-between items-start mb-5">
            <h3 className="font-medium text-white text-sm truncate pr-3 leading-snug">
              {photo.name}
            </h3>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white text-2xl leading-none flex-shrink-0"
            >
              ×
            </button>
          </div>

          {photo.status === 'done' && photo.score !== undefined && (
            <>
              <div className="mb-5">
                <div className="flex items-end gap-3 mb-2">
                  <span className="text-4xl font-bold text-white tabular-nums">
                    {photo.score}
                  </span>
                  {badge && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded mb-1 ${badge.className}`}>
                      {badge.label}
                    </span>
                  )}
                </div>
                <ScoreBar score={photo.score} showLabel={false} />
              </div>

              {photo.reasoning && (
                <div className="mb-5">
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Ocena
                  </h4>
                  <p className="text-sm text-zinc-300 leading-relaxed">{photo.reasoning}</p>
                </div>
              )}

              {photo.editSuggestion && (
                <div>
                  <h4 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">
                    Retusz
                  </h4>
                  <p className="text-sm text-zinc-400 leading-relaxed">{photo.editSuggestion}</p>
                </div>
              )}
            </>
          )}

          {photo.status === 'pending' && (
            <p className="text-zinc-500 text-sm">Jeszcze nie przeanalizowano.</p>
          )}

          {photo.status === 'analyzing' && (
            <div className="flex items-center gap-2 text-zinc-400 text-sm">
              <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
              Analizowanie...
            </div>
          )}

          {photo.status === 'error' && (
            <p className="text-red-400 text-sm">Błąd analizy.</p>
          )}
        </div>
      </div>
    </div>
  );
}
