'use client';

import { Photo } from '@/lib/types';
import ScoreBar from './ScoreBar';

interface Props {
  photo: Photo;
  cssFilter?: string;
  showScore?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
}

export default function PhotoCard({ photo, cssFilter, showScore, onClick, onRemove }: Props) {
  const isAnalyzing = photo.status === 'analyzing';
  const isDone = photo.status === 'done';
  const isError = photo.status === 'error';

  return (
    <div
      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-zinc-900"
      onClick={onClick}
    >
      <img
        src={photo.url}
        alt={photo.name}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        style={{ filter: cssFilter || 'none' }}
      />

      {/* Analyzing spinner */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center">
          <span className="text-red-300 text-xs font-medium">Błąd</span>
        </div>
      )}

      {/* Score overlay at bottom */}
      {showScore && isDone && photo.score !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-4 bg-gradient-to-t from-black/90 to-transparent">
          <ScoreBar score={photo.score} />
        </div>
      )}

      {/* Hover details panel */}
      {isDone && photo.reasoning && (
        <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-3 flex flex-col justify-end">
          <p className="text-xs text-zinc-200 line-clamp-3 leading-relaxed">{photo.reasoning}</p>
          {photo.editSuggestion && (
            <p className="text-xs text-zinc-500 mt-1.5 line-clamp-2 leading-relaxed">
              {photo.editSuggestion}
            </p>
          )}
        </div>
      )}

      {/* Remove button (shown only when onRemove is provided and not analyzing) */}
      {onRemove && !isAnalyzing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 hover:bg-black text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}
