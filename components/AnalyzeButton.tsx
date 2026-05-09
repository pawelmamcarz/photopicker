'use client';

interface Props {
  count: number;
  onClick: () => void;
  disabled?: boolean;
}

export default function AnalyzeButton({ count, onClick, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || count === 0}
      className="px-6 py-3 bg-white text-zinc-950 font-semibold rounded-lg hover:bg-zinc-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
    >
      Analizuj {count} zdjęć →
    </button>
  );
}
