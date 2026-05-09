'use client';

interface Props {
  score: number;
  showLabel?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

export default function ScoreBar({ score, showLabel = true }: Props) {
  const color = scoreColor(score);

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs mb-1" style={{ color }}>
          <span className="font-bold tabular-nums">{score}</span>
        </div>
      )}
      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
