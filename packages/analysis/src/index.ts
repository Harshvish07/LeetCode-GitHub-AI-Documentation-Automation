export { analyzeSolution } from './solution-analyzer.js';
export type { AnalyzeSolutionInput } from './solution-analyzer.js';

export type {
  AlgorithmCharacteristics,
  AlgorithmPattern,
  CodeQualityObservation,
  ComplexityEstimate,
  Confidence,
  ConfidenceLevel,
  EdgeCaseObservation,
  ObservationSeverity,
  PatternMatch,
  PossibleIssue,
  SolutionAnalysis,
} from './types.js';
export { ALGORITHM_PATTERNS } from './types.js';

export type { CodeContext } from './context.js';
export { buildCodeContext } from './context.js';

export { detectPatterns } from './pattern-detector/index.js';
export { estimateComplexity } from './complexity-analyzer/index.js';
export { reviewCodeQuality } from './code-review/index.js';
export { analyzeEdgeCases } from './edge-case-analyzer/index.js';
