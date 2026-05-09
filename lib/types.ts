export interface Photo {
  id: string;
  file?: File;
  url: string;
  name: string;
  mediaType?: 'image/jpeg' | 'image/png' | 'image/webp';
  score?: number;
  reasoning?: string;
  editSuggestion?: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
}

export interface GalleryState {
  photos: Photo[];
  photographerId: string | null;
  analyzing: boolean;
  analyzed: boolean;
}
