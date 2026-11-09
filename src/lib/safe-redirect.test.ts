import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it('keeps in-app paths', () => {
    expect(safeNextPath('/library/abc?x=1')).toBe('/library/abc?x=1');
    expect(safeNextPath('/admin')).toBe('/admin');
  });

  it('falls back for missing or external destinations', () => {
    for (const bad of [null, '', 'https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '/a\nb']) {
      expect(safeNextPath(bad)).toBe('/dashboard');
    }
  });
});
