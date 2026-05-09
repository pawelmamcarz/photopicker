'use client';

import { PHOTOGRAPHERS } from '@/lib/photographers';

interface Props {
  selected: string | null;
  onSelect: (id: string) => void;
}

export default function PhotographerSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {PHOTOGRAPHERS.map((p) => {
        const isSelected = selected === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`text-left p-5 rounded-xl border-2 transition-all duration-150 ${
              isSelected
                ? 'bg-zinc-800'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-850'
            }`}
            style={{ borderColor: isSelected ? p.color : undefined }}
          >
            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: p.color + '22',
                    color: p.color,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Name */}
            <h3 className="font-bold text-white text-base mb-1">{p.name}</h3>

            {/* Description */}
            <p className="text-zinc-400 text-sm leading-snug">{p.description}</p>

            {/* CSS filter preview strip */}
            <div className="mt-4 h-1.5 rounded-full" style={{ backgroundColor: p.color + '66' }} />
          </button>
        );
      })}
    </div>
  );
}
