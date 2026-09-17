import { describe, expect, it } from 'vitest';
import { buildProblemRepoPath, PROBLEMS_INDEX_PATH, ROOT_README_PATH } from './problemPath.js';

describe('buildProblemRepoPath', () => {
  it('builds "problems/NNN-slug/README.md" for a known number', () => {
    expect(buildProblemRepoPath({ slug: 'two-sum', number: 1 })).toBe(
      'problems/001-two-sum/README.md',
    );
  });

  it('omits the number when unknown', () => {
    expect(buildProblemRepoPath({ slug: 'two-sum', number: null })).toBe(
      'problems/two-sum/README.md',
    );
  });

  it('sanitizes a messy slug the same way the document filename generator does', () => {
    expect(buildProblemRepoPath({ slug: '../../etc/passwd', number: null })).toBe(
      'problems/etc-passwd/README.md',
    );
  });
});

describe('constants', () => {
  it('exposes the fixed index and root README paths', () => {
    expect(PROBLEMS_INDEX_PATH).toBe('problems/index.json');
    expect(ROOT_README_PATH).toBe('README.md');
  });
});
