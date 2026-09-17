import { describe, expect, it } from 'vitest';
import { publishRequestSchema } from './publish.schema.js';

describe('publishRequestSchema', () => {
  it('accepts an empty body (mode omitted)', () => {
    expect(publishRequestSchema.safeParse({}).success).toBe(true);
  });

  it('accepts mode: "create"', () => {
    const result = publishRequestSchema.safeParse({ mode: 'create' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe('create');
  });

  it('accepts mode: "update"', () => {
    const result = publishRequestSchema.safeParse({ mode: 'update' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mode).toBe('update');
  });

  it('rejects an unknown mode value', () => {
    expect(publishRequestSchema.safeParse({ mode: 'overwrite' }).success).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(publishRequestSchema.safeParse('create').success).toBe(false);
    expect(publishRequestSchema.safeParse(null).success).toBe(false);
  });
});
