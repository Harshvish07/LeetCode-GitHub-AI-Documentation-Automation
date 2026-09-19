import type { ReactNode } from 'react';
import { difficultyTone, qualityTone, statusTone, type BadgeTone } from './tones.js';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function DifficultyBadge({ difficulty }: { difficulty: string | null }) {
  return <Badge tone={difficultyTone(difficulty)}>{difficulty ?? 'Unknown'}</Badge>;
}

export function StatusBadge({ status }: { status: string | null }) {
  return <Badge tone={statusTone(status)}>{status ?? 'Unknown'}</Badge>;
}

export function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="muted">Not reviewed</span>;
  return <Badge tone={qualityTone(score)}>{score}</Badge>;
}
