import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import {
  extractDifficulty,
  extractLanguage,
  extractRuntimeMemory,
  extractSubmissionStatus,
  extractVisibleEditorCode,
  getMetaContent,
  parseNumberedTitle,
  queryFirstText,
  stripDocumentTitleSuffix,
} from './extractor.js';

function docFromHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('queryFirstText', () => {
  it('returns the first non-empty match among the given selectors', () => {
    const doc = docFromHtml('<div id="a"></div><div class="target">  Two Sum  </div>');
    expect(queryFirstText(doc, ['#missing', '.target'])).toBe('Two Sum');
  });

  it('returns null when nothing matches', () => {
    const doc = docFromHtml('<div>irrelevant</div>');
    expect(queryFirstText(doc, ['.nope'])).toBeNull();
  });

  it('ignores an unsupported selector instead of throwing', () => {
    const doc = docFromHtml('<div class="target">Two Sum</div>');
    expect(queryFirstText(doc, [':::invalid:::', '.target'])).toBe('Two Sum');
  });
});

describe('getMetaContent', () => {
  it('reads a meta[name] tag', () => {
    const doc = docFromHtml('<meta name="description" content="Solve two-sum efficiently." />');
    expect(getMetaContent(doc, 'description')).toBe('Solve two-sum efficiently.');
  });

  it('returns null when the meta tag is absent', () => {
    const doc = docFromHtml('<head></head>');
    expect(getMetaContent(doc, 'description')).toBeNull();
  });
});

describe('extractDifficulty', () => {
  it('finds an exact "Easy" leaf element', () => {
    const doc = docFromHtml('<div class="header"><span>Easy</span></div>');
    expect(extractDifficulty(doc)).toBe('Easy');
  });

  it('finds "Hard" nested inside a curated container selector', () => {
    const doc = docFromHtml('<div diff="hard"><span class="pill">Hard</span></div>');
    expect(extractDifficulty(doc)).toBe('Hard');
  });

  it('does not false-positive on prose that merely mentions a difficulty word', () => {
    const doc = docFromHtml(
      '<p>This is an easy problem once you see the pattern, not Hard at all.</p>',
    );
    expect(extractDifficulty(doc)).toBeNull();
  });

  it('returns null when no difficulty is present', () => {
    const doc = docFromHtml('<div>no difficulty here</div>');
    expect(extractDifficulty(doc)).toBeNull();
  });
});

describe('extractLanguage', () => {
  it('finds an exact known-language match', () => {
    const doc = docFromHtml('<div class="editor"><button>Python3</button></div>');
    expect(extractLanguage(doc)).toBe('Python3');
  });

  it('returns null when no known language is present', () => {
    const doc = docFromHtml('<div class="editor"><button>Run</button></div>');
    expect(extractLanguage(doc)).toBeNull();
  });
});

describe('extractSubmissionStatus', () => {
  it('finds "Accepted" inside a result container', () => {
    const doc = docFromHtml(
      '<div data-e2e-locator="submission-result"><span>Accepted</span></div>',
    );
    expect(extractSubmissionStatus(doc)).toBe('Accepted');
  });

  it('finds "Wrong Answer" inside a result container', () => {
    const doc = docFromHtml('<div class="result-panel"><h3>Wrong Answer</h3></div>');
    expect(extractSubmissionStatus(doc)).toBe('Wrong Answer');
  });

  it('returns null when there is no submission result on the page', () => {
    const doc = docFromHtml('<div class="description">Given an array of integers...</div>');
    expect(extractSubmissionStatus(doc)).toBeNull();
  });
});

describe('extractVisibleEditorCode', () => {
  it('joins .view-line elements in document order', () => {
    const doc = docFromHtml(`
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line">function twoSum(nums, target) {</div>
          <div class="view-line">  return [];</div>
          <div class="view-line">}</div>
        </div>
      </div>
    `);
    expect(extractVisibleEditorCode(doc)).toBe('function twoSum(nums, target) {\n  return [];\n}');
  });

  it('returns null when no editor lines are found', () => {
    const doc = docFromHtml('<div class="monaco-editor"><div class="view-lines"></div></div>');
    expect(extractVisibleEditorCode(doc)).toBeNull();
  });

  it('returns null when there is no editor on the page at all', () => {
    const doc = docFromHtml('<div>no editor here</div>');
    expect(extractVisibleEditorCode(doc)).toBeNull();
  });
});

describe('extractRuntimeMemory', () => {
  it('extracts runtime and memory from a result container', () => {
    const doc = docFromHtml(`
      <div data-e2e-locator="submission-result">
        <span>Runtime: 52 ms</span>
        <span>Memory: 42.1 MB</span>
      </div>
    `);
    expect(extractRuntimeMemory(doc)).toEqual({ runtime: '52 ms', memory: '42.1 MB' });
  });

  it('returns nulls when there is no result container, even if the page text mentions ms/MB', () => {
    const doc = docFromHtml('<p>Expected runtime around 50ms and 40MB on average.</p>');
    expect(extractRuntimeMemory(doc)).toEqual({ runtime: null, memory: null });
  });

  it('returns nulls when the result container has no matching text', () => {
    const doc = docFromHtml('<div class="result-panel">Accepted</div>');
    expect(extractRuntimeMemory(doc)).toEqual({ runtime: null, memory: null });
  });
});

describe('parseNumberedTitle', () => {
  it('splits a numbered title into number and title', () => {
    expect(parseNumberedTitle('1. Two Sum')).toEqual({ number: 1, title: 'Two Sum' });
  });

  it('handles multi-digit numbers', () => {
    expect(parseNumberedTitle('1245. Tree of Coprimes')).toEqual({
      number: 1245,
      title: 'Tree of Coprimes',
    });
  });

  it('returns null number when there is no numeric prefix', () => {
    expect(parseNumberedTitle('Two Sum')).toEqual({ number: null, title: 'Two Sum' });
  });

  it('returns both null for null input', () => {
    expect(parseNumberedTitle(null)).toEqual({ number: null, title: null });
  });
});

describe('stripDocumentTitleSuffix', () => {
  it('strips the " - LeetCode" suffix', () => {
    expect(stripDocumentTitleSuffix('Two Sum - LeetCode')).toBe('Two Sum');
  });

  it('returns the original text trimmed when there is no suffix', () => {
    expect(stripDocumentTitleSuffix('Two Sum')).toBe('Two Sum');
  });

  it('returns null for an empty/whitespace-only title', () => {
    expect(stripDocumentTitleSuffix('   ')).toBeNull();
  });
});
