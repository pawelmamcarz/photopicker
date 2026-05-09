'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Photo } from './types';

interface GalleryContextType {
  photographerId: string | null;
  photos: Photo[];
  setPhotographerId: (id: string) => void;
  setPhotos: (photos: Photo[]) => void;
  updatePhoto: (id: string, updates: Partial<Photo>) => void;
  resetGallery: () => void;
}

const GalleryContext = createContext<GalleryContextType | null>(null);

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [photographerId, setPhotographerId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const updatePhoto = (id: string, updates: Partial<Photo>) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const resetGallery = () => {
    setPhotos([]);
    setPhotographerId(null);
  };

  return (
    <GalleryContext.Provider
      value={{
        photographerId,
        photos,
        setPhotographerId,
        setPhotos,
        updatePhoto,
        resetGallery,
      }}
    >
      {children}
    </GalleryContext.Provider>
  );
}

export function useGallery() {
  const ctx = useContext(GalleryContext);
  if (!ctx) throw new Error('useGallery must be used within GalleryProvider');
  return ctx;
}
