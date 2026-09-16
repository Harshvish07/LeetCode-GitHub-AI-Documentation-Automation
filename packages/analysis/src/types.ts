/**
 * Every type in this package describes the output of *heuristic, static-text*
 * analysis — regex/keyword/structural signals over the submitted source,
 * never execution, and never a guarantee. `confidence` fields exist
 * precisely because none of this is exact: see each module's own comments
 * for what it can and can't actually tell.
 */

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface Confidence {
  level: ConfidenceLevel;
  /** 0-1, the raw score the level was derived from — kept so callers can see the boundary, not just the bucket. */
  score: number;
  /** Why this confidence, in plain language (e.g. "1 of 3 corroborating signals matched"). */
  reason: string;
}

export const ALGORITHM_PATTERNS = [
  'Hash Map',
  'Hash Set',
  'Two Pointers',
  'Sliding Window',
  'Binary Search',
  'Stack',
  'Queue',
  'BFS',
  'DFS',
  'Recursion',
  'Backtracking',
  'Heap / Priority Queue',
  'Greedy',
  'Dynamic Programming',
  'Prefix Sum',
  'Sorting',
  'Linked List Techniques',
  'Tree Traversal',
  'Graph Traversal',
] as const;

export type AlgorithmPattern = (typeof ALGORITHM_PATTERNS)[number];

export interface PatternMatch {
  pattern: AlgorithmPattern;
  confidence: Confidence;
  /** Human-readable reasons this pattern was flagged — e.g. "found `new Map(` construction". */
  evidence: string[];
}

export interface ComplexityEstimate {
  /** e.g. "O(1)", "O(n)", "O(n log n)", "O(n^2)", "O(2^n)", or "Unknown" when signals were too sparse/conflicting to guess. */
  notation: string;
  confidence: Confidence;
  /** Which heuristics produced this estimate, and any conflicts noticed along the way. */
  reasoning: string[];
}

export interface AlgorithmCharacteristics {
  usesRecursion: boolean;
  usesIteration: boolean;
  maxLoopNestingDepth: number;
  usesSorting: boolean;
  usesHashing: boolean;
  /** An extra array/map/set/list sized proportional to the input was detected. */
  usesExtraLinearStructure: boolean;
}

export type ObservationSeverity = 'info' | 'warning';

export interface CodeQualityObservation {
  category:
    | 'nested-loops'
    | 'repeated-computation'
    | 'naming'
    | 'duplication'
    | 'conversion'
    | 'mutation'
    | 'readability';
  severity: ObservationSeverity;
  message: string;
}

export interface EdgeCaseObservation {
  concern: string;
  detail: string;
  severity: ObservationSeverity;
}

export interface PossibleIssue {
  message: string;
  severity: ObservationSeverity;
  /** Which sub-analyzer(s) this was synthesized from, for traceability. */
  source: 'pattern-detector' | 'complexity-analyzer' | 'code-review' | 'edge-case-analyzer';
}

/**
 * The full deterministic analysis of one submission. Every phase of this
 * (pattern detection, complexity, quality, edge cases) is a *heuristic*
 * over the source text — not an AST, not execution, not a proof. The
 * top-level `confidence` is the analyzer's own honest summary of how much
 * to trust the whole thing, not just an average of the parts.
 */
export interface SolutionAnalysis {
  detectedLanguage: string | null;
  detectedPatterns: PatternMatch[];
  estimatedTimeComplexity: ComplexityEstimate;
  estimatedSpaceComplexity: ComplexityEstimate;
  algorithmCharacteristics: AlgorithmCharacteristics;
  possibleIssues: PossibleIssue[];
  codeQualityObservations: CodeQualityObservation[];
  edgeCaseObservations: EdgeCaseObservation[];
  confidence: Confidence;
}
