export type BadgeTone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

export function difficultyTone(difficulty: string | null): BadgeTone {
  if (difficulty === 'Easy') return 'good';
  if (difficulty === 'Medium') return 'warn';
  if (difficulty === 'Hard') return 'bad';
  return 'neutral';
}

export function statusTone(status: string | null): BadgeTone {
  if (status === 'Accepted') return 'good';
  if (status === null) return 'neutral';
  return 'bad';
}

/** 85+ is solid, 60-84 is fine, below that is worth revisiting. */
export function qualityTone(score: number | null): BadgeTone {
  if (score === null) return 'neutral';
  if (score >= 85) return 'good';
  if (score >= 60) return 'warn';
  return 'bad';
}
