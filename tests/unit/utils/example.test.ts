import { describe, it, expect } from 'vitest';

/**
 * Example unit test file
 * Unit tests test pure functions with no dependencies
 */

describe('Utils Example', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should test a utility function', () => {
    // Example utility function
    function capitalize(str: string): string {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('World');
    expect(capitalize('tEsT')).toBe('Test');
  });
});

