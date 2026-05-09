'use client';

import { useState } from 'react';
import { Photo } from '@/lib/types';
import PhotoCard from './PhotoCard';
import Lightbox from './Lightbox';

interface Props {
  photos: Photo[];
  cssFilter?: string;
  showScores?: boolean;
  onRemove?: (id: string) => void;
}

export default function PhotoGrid({ photos, cssFilter, showScores, onRemove }: Props) {
  const [lightboxPhoto, setLightboxPhoto] = useState<Photo | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            cssFilter={cssFilter}
            showScore={showScores}
            onClick={() => setLightboxPhoto(photo)}
            onRemove={onRemove ? () => onRemove(photo.id) : undefined}
          />
        ))}
      </div>

      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
        />
      )}
    </>
  );
}
