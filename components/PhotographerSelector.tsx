'use client';

import { PHOTOGRAPHERS } from '@/lib/photographers';

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
}

// Gradient pokrywający pełne spektrum barw — widać efekt każdego filtra CSS
const PREVIEW_GRADIENT =
  'linear-gradient(to right, #c0392b, #e67e22, #f1c40f, #27ae60, #2980b9, #8e44ad, #e8b89a)';

export default function PhotographerSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {PHOTOGRAPHERS.map((p) => {
        const isSelected = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`text-left rounded-xl border-2 transition-all duration-150 overflow-hidden ${
              isSelected
                ? 'bg-zinc-800'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-850'
            }`}
            style={{ borderColor: isSelected ? p.color : undefined }}
          >
            {/* Podgląd filtra — gradient przez CSS filter fotografa */}
            <div
              className="w-full h-12"
              style={{
                background: PREVIEW_GRADIENT,
                filter: p.cssFilter,
              }}
            />

            {/* Treść karty */}
            <div className="p-3">
              <div className="flex flex-wrap gap-1 mb-2">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide"
                    style={{ backgroundColor: p.color + '22', color: p.color }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <h3 className="font-bold text-white text-sm leading-tight mb-1">{p.name}</h3>
              <p className="text-zinc-500 text-xs leading-snug">{p.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
