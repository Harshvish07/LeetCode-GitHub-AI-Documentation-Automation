import type { CodeContext } from '../context.js';

/**
 * Structural primitives shared by the pattern-detector, complexity-analyzer,
 * and code-review modules: loop-nesting depth and function/recursion
 * detection. These work off the source *text*, not a real parser/AST — see
 * each function's own comment for exactly what that means it can and can't
 * see. Kept in one place so every module that needs "how deeply nested are
 * the loops" or "does this function call itself" agrees on one answer.
 */

/** Replaces string/char/template literals and line/block comments with whitespace, preserving length and newlines, so brace/keyword scanning never gets confused by a `{` or `for` that only appears inside a string or a comment. */
export function stripStringsAndComments(code: string): string {
  let result = '';
  let i = 0;
  const n = code.length;

  while (i < n) {
    const c = code[i];
    const next = code[i + 1];

    if (c === '/' && next === '/') {
      while (i < n && code[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

    if (c === '/' && next === '*') {
      result += '  ';
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        result += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += '  ';
        i += 2;
      }
      continue;
    }

    if (c === '#') {
      while (i < n && code[i] !== '\n') {
        result += ' ';
        i++;
      }
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      result += ' ';
      i++;
      while (i < n && code[i] !== quote) {
        if (code[i] === '\\' && i + 1 < n) {
          result += '  ';
          i += 2;
          continue;
        }
        result += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        result += ' ';
        i++;
      }
      continue;
    }

    result += c;
    i++;
  }

  return result;
}

function normalizeIndent(whitespace: string): number {
  let width = 0;
  for (const ch of whitespace) width += ch === '\t' ? 4 : 1;
  return width;
}

export interface LoopStructure {
  maxNestingDepth: number;
  loopCount: number;
}

function wordBefore(clean: string, endExclusive: number): { word: string; start: number } {
  let i = endExclusive - 1;
  while (i >= 0 && /\s/.test(clean[i]!)) i--;
  const wordEnd = i + 1;
  let wordStart = wordEnd;
  while (wordStart > 0 && /[a-zA-Z_]/.test(clean[wordStart - 1]!)) wordStart--;
  return { word: clean.slice(wordStart, wordEnd), start: wordStart };
}

/** True if the `{` at `bracePos` opens a `for(...)`, `while(...)`, or `do` body. */
function isLoopOpeningBrace(clean: string, bracePos: number): boolean {
  let i = bracePos - 1;
  while (i >= 0 && /\s/.test(clean[i]!)) i--;
  if (i < 0) return false;

  if (clean[i] === ')') {
    let balance = 1;
    i--;
    while (i >= 0 && balance > 0) {
      if (clean[i] === ')') balance++;
      else if (clean[i] === '(') balance--;
      i--;
    }
    const { word } = wordBefore(clean, i + 1);
    return word === 'for' || word === 'while';
  }

  const { word } = wordBefore(clean, i + 1);
  return word === 'do';
}

/** Brace-counting nesting analysis for C-like languages (JS/TS/Java/C/C++/C#/Go/Rust/Swift/Kotlin/...). */
function analyzeBraceLoops(clean: string): LoopStructure {
  let depth = 0;
  let maxDepth = 0;
  let loopCount = 0;
  const stack: boolean[] = [];

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (c === '{') {
      const isLoop = isLoopOpeningBrace(clean, i);
      if (isLoop) {
        depth++;
        loopCount++;
        maxDepth = Math.max(maxDepth, depth);
      }
      stack.push(isLoop);
    } else if (c === '}') {
      if (stack.pop()) depth--;
    }
  }

  return { maxNestingDepth: maxDepth, loopCount };
}

/** Indentation-based nesting analysis for Python (no braces to count). */
function analyzeIndentationLoops(lines: readonly string[]): LoopStructure {
  const loopLineRegex = /^(\s*)(for|while)\b/;
  const stack: number[] = [];
  let maxDepth = 0;
  let loopCount = 0;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '');
    const match = loopLineRegex.exec(line);
    if (!match) continue;

    const indent = normalizeIndent(match[1] ?? '');
    while (stack.length > 0 && stack[stack.length - 1]! >= indent) stack.pop();
    stack.push(indent);
    loopCount++;
    maxDepth = Math.max(maxDepth, stack.length);
  }

  return { maxNestingDepth: maxDepth, loopCount };
}

/**
 * Picks brace-based or indentation-based loop analysis by declared language,
 * falling back to indentation analysis if the brace method finds nothing at
 * all (covers an unlabeled/unknown-language Python-shaped submission).
 */
export function analyzeLoopStructure(ctx: CodeContext): LoopStructure {
  const isPython = ctx.language?.toLowerCase().startsWith('python') ?? false;
  if (isPython) return analyzeIndentationLoops(ctx.lines);

  const clean = stripStringsAndComments(ctx.code);
  const braceResult = analyzeBraceLoops(clean);
  if (braceResult.loopCount === 0) {
    const indentResult = analyzeIndentationLoops(ctx.lines);
    if (indentResult.loopCount > 0) return indentResult;
  }
  return braceResult;
}

export interface FunctionInfo {
  name: string;
  firstParamName: string | null;
  bodyCode: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstParamName(paramsText: string): string | null {
  const first = paramsText.split(',')[0]?.trim();
  if (!first) return null;

  const withoutDefault = first.split('=')[0]!.trim();
  const colonIdx = withoutDefault.indexOf(':');
  if (colonIdx > 0) {
    const candidate = withoutDefault.slice(0, colonIdx).trim();
    if (/^[A-Za-z_]\w*$/.test(candidate)) return candidate;
  }

  const tokens = withoutDefault
    .replace(/[*&[\]]/g, ' ')
    .trim()
    .split(/\s+/);
  const last = tokens[tokens.length - 1];
  return last && /^[A-Za-z_]\w*$/.test(last) ? last : null;
}

function findMatchingBrace(clean: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < clean.length; i++) {
    if (clean[i] === '{') depth++;
    else if (clean[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const BRACE_FUNCTION_PATTERNS: RegExp[] = [
  // function name(params) {
  /\bfunction\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
  // const/let/var name = (params) => {
  /\b(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>\s*\{/g,
  // Java/C++/C#-ish: ReturnType name(params) {
  /\b[A-Za-z_][\w<>[\],\s.]*\s+(\w+)\s*\(([^)]*)\)\s*\{/g,
];

function extractBraceFunctions(clean: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const seenBraceIndex = new Set<number>();

  for (const pattern of BRACE_FUNCTION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(clean))) {
      const braceIndex = match.index + match[0].length - 1;
      if (seenBraceIndex.has(braceIndex)) continue;
      seenBraceIndex.add(braceIndex);

      const name = match[1]!;
      const bodyEnd = findMatchingBrace(clean, braceIndex);
      const bodyCode = clean.slice(braceIndex + 1, bodyEnd === -1 ? clean.length : bodyEnd);
      functions.push({ name, firstParamName: firstParamName(match[2] ?? ''), bodyCode });
    }
  }

  return functions;
}

function extractPythonFunctions(lines: readonly string[]): FunctionInfo[] {
  const cleanLines = lines.map((line) => line.replace(/#.*$/, ''));
  const defRegex = /^(\s*)def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*[^:]+)?\s*:/;
  const functions: FunctionInfo[] = [];

  for (let i = 0; i < cleanLines.length; i++) {
    const match = defRegex.exec(cleanLines[i]!);
    if (!match) continue;

    const indent = normalizeIndent(match[1] ?? '');
    const bodyLines: string[] = [];
    for (let j = i + 1; j < cleanLines.length; j++) {
      const line = cleanLines[j]!;
      if (line.trim().length === 0) {
        bodyLines.push(line);
        continue;
      }
      const lineIndentMatch = /^(\s*)/.exec(line);
      const lineIndent = normalizeIndent(lineIndentMatch ? lineIndentMatch[1]! : '');
      if (lineIndent <= indent) break;
      bodyLines.push(line);
    }

    functions.push({
      name: match[2]!,
      firstParamName: firstParamName(match[3] ?? ''),
      bodyCode: bodyLines.join('\n'),
    });
  }

  return functions;
}

/** Every function/method definition this heuristic could find, brace-style or Python `def`-style. */
export function extractFunctions(ctx: CodeContext): FunctionInfo[] {
  const isPython = ctx.language?.toLowerCase().startsWith('python') ?? false;
  if (isPython) return extractPythonFunctions(ctx.lines);

  const clean = stripStringsAndComments(ctx.code);
  const functions = extractBraceFunctions(clean);
  if (functions.length === 0) {
    // Unknown/unlabeled language: try Python-shaped extraction as a fallback.
    return extractPythonFunctions(ctx.lines);
  }
  return functions;
}

export interface RecursionInfo {
  isRecursive: boolean;
  /** Names of functions found to call themselves within their own body. */
  functionNames: string[];
}

/** A function "is recursive" here means its own name appears as a call inside its own body text — not that it necessarily terminates, or terminates at all. */
export function detectRecursion(ctx: CodeContext): RecursionInfo {
  const functions = extractFunctions(ctx);
  const recursive = functions.filter((fn) =>
    new RegExp(`\\b${escapeRegExp(fn.name)}\\s*\\(`).test(fn.bodyCode),
  );
  return {
    isRecursive: recursive.length > 0,
    functionNames: [...new Set(recursive.map((fn) => fn.name))],
  };
}
