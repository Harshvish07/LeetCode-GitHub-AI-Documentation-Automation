import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { parseLeetCodeExtraction } from './parser.js';

function docFromHtml(html: string): Document {
  return new JSDOM(html).window.document;
}

describe('parseLeetCodeExtraction', () => {
  it('extracts a full accepted-submission page', () => {
    const url = 'https://leetcode.com/problems/two-sum/submissions/123456/';
    const doc = docFromHtml(`
      <head>
        <title>Two Sum - LeetCode</title>
      </head>
      <body>
        <a href="/problems/two-sum/">1. Two Sum</a>
        <div diff="easy"><span>Easy</span></div>
        <div class="editor"><button>JavaScript</button></div>
        <div data-e2e-locator="submission-result">
          <span>Accepted</span>
          <span>Runtime: 52 ms</span>
          <span>Memory: 42.1 MB</span>
        </div>
        <div class="monaco-editor">
          <div class="view-lines">
            <div class="view-line">var twoSum = function(nums, target) {</div>
            <div class="view-line">  return [];</div>
            <div class="view-line">};</div>
          </div>
        </div>
      </body>
    `);

    const result = parseLeetCodeExtraction(doc, url);

    expect(result.problem).toEqual({
      url,
      slug: 'two-sum',
      number: 1,
      title: 'Two Sum',
      difficulty: 'Easy',
      description: null,
    });
    expect(result.submission).toEqual({
      language: 'JavaScript',
      code: 'var twoSum = function(nums, target) {\n  return [];\n};',
      status: 'Accepted',
      runtime: '52 ms',
      memory: '42.1 MB',
    });
    expect(result.warnings).toEqual(['description']);
    expect(() => new Date(result.extractedAt).toISOString()).not.toThrow();
  });

  it('reads the description from a meta tag when the DOM content is not present', () => {
    const url = 'https://leetcode.com/problems/two-sum/';
    const doc = docFromHtml(`
      <head>
        <title>Two Sum - LeetCode</title>
        <meta name="description" content="Given an array of integers, return indices of the two numbers that add up to target." />
      </head>
    `);

    const result = parseLeetCodeExtraction(doc, url);

    expect(result.problem.description).toBe(
      'Given an array of integers, return indices of the two numbers that add up to target.',
    );
  });

  it('falls back to document.title when no title element is found, without a numeric prefix', () => {
    const url = 'https://leetcode.com/problems/two-sum/';
    const doc = docFromHtml('<head><title>Two Sum - LeetCode</title></head>');

    const result = parseLeetCodeExtraction(doc, url);

    expect(result.problem.title).toBe('Two Sum');
    expect(result.problem.number).toBeNull();
    expect(result.warnings).toContain('number');
  });

  it('returns null/warnings for every field on a bare, unrecognized page — never invents data', () => {
    const url = 'https://leetcode.com/problems/two-sum/';
    const doc = docFromHtml('<head><title></title></head><body></body>');

    const result = parseLeetCodeExtraction(doc, url);

    expect(result.problem).toEqual({
      url,
      slug: 'two-sum',
      number: null,
      title: null,
      difficulty: null,
      description: null,
    });
    expect(result.submission).toEqual({
      language: null,
      code: null,
      status: null,
      runtime: null,
      memory: null,
    });
    expect(result.warnings.sort()).toEqual(
      [
        'code',
        'description',
        'difficulty',
        'language',
        'number',
        'runtime',
        'memory',
        'status',
        'title',
      ].sort(),
    );
  });

  it('reports a null slug when the URL is not a recognizable problem URL', () => {
    const doc = docFromHtml('<head><title>LeetCode</title></head>');

    const result = parseLeetCodeExtraction(doc, 'https://leetcode.com/explore/');

    expect(result.problem.slug).toBeNull();
    expect(result.warnings).toContain('slug');
  });
});
