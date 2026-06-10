import { describe, it, expect } from 'vitest';
import { escapeCsvField, toCsvRow } from './csv.js';

describe('escapeCsvField', () => {
  it('leaves a plain field unchanged', () => {
    expect(escapeCsvField('hello')).toBe('hello');
  });

  it('quotes a field containing a comma', () => {
    expect(escapeCsvField('a,b')).toBe('"a,b"');
  });

  it('doubles inner quotes and wraps', () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });

  it('quotes a field containing a carriage return', () => {
    expect(escapeCsvField('a\rb')).toBe('"a\rb"');
  });
});

describe('toCsvRow', () => {
  it('joins escaped fields with commas', () => {
    expect(toCsvRow(['a', 'b,c', 'd"e'])).toBe('a,"b,c","d""e"');
  });
});
