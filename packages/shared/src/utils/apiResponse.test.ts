import { describe, expect, it } from 'vitest';
import { failure, isSuccess, success } from './apiResponse.js';

describe('apiResponse helpers', () => {
  it('wraps data in a success envelope', () => {
    const response = success({ id: 1 });
    expect(response).toEqual({ success: true, data: { id: 1 } });
  });

  it('wraps a message in an error envelope', () => {
    const response = failure('not found', 'NOT_FOUND');
    expect(response).toEqual({
      success: false,
      error: { message: 'not found', code: 'NOT_FOUND' },
    });
  });

  it('narrows success responses via isSuccess', () => {
    const response = success(42);
    if (isSuccess(response)) {
      expect(response.data).toBe(42);
    } else {
      throw new Error('expected success response');
    }
  });

  it('narrows error responses via isSuccess', () => {
    const response = failure('bad request');
    expect(isSuccess(response)).toBe(false);
  });

  it('includes details only when provided', () => {
    const withDetails = failure('invalid', 'VALIDATION_ERROR', [
      { path: 'code', message: 'required' },
    ]);
    expect(withDetails.error.details).toEqual([{ path: 'code', message: 'required' }]);

    const withoutDetails = failure('invalid', 'VALIDATION_ERROR');
    expect(withoutDetails.error).not.toHaveProperty('details');
  });
});
