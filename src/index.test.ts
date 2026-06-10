import { describe, it, expect } from 'vitest';
import { greet } from './index.js';

describe('greet', () => {
  it('greets by name', () => {
    expect(greet('Telenor')).toBe('Hello, Telenor!');
  });
});
