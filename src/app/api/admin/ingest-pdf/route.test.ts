import { describe, it, expect } from 'vitest';
import { chunkText } from '@/lib/ingestion';
import { stripJsonFence } from './route';

describe('chunkText', () => {
  it('returns no chunks for empty text', () => {
    expect(chunkText('', 10)).toEqual([]);
    expect(chunkText('   ', 10)).toEqual([]);
  });

  it('collapses whitespace and returns a single chunk for short text', () => {
    const chunks = chunkText('Bonjour   le\nmonde', 10);
    expect(chunks).toEqual([{ content: 'Bonjour le monde', index: 1 }]);
  });

  it('numbers chunks sequentially starting at 1', () => {
    const longText = 'Phrase numéro un. '.repeat(2000);
    const chunks = chunkText(longText, 10);
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i + 1));
  });

  it('never exceeds maxChunks', () => {
    const longText = 'Phrase numéro un. '.repeat(5000);
    const chunks = chunkText(longText, 3);
    expect(chunks.length).toBeLessThanOrEqual(3);
  });

  it('prefers to cut at a sentence boundary rather than mid-word', () => {
    const first = 'A'.repeat(7100) + '. ';
    const second = 'B'.repeat(7000);
    const chunks = chunkText(first + second, 10);
    // The cut should land right after the ". " rather than mid-run of Bs.
    expect(chunks[0].content.endsWith('.')).toBe(true);
    expect(chunks[0].content).not.toContain('B');
  });
});

describe('stripJsonFence', () => {
  it('removes a ```json fence around the payload', () => {
    const input = '```json\n{"a":1}\n```';
    expect(stripJsonFence(input)).toBe('{"a":1}');
  });

  it('removes a bare ``` fence without a language tag', () => {
    const input = '```\n{"a":1}\n```';
    expect(stripJsonFence(input)).toBe('{"a":1}');
  });

  it('leaves unfenced JSON untouched (aside from trimming)', () => {
    expect(stripJsonFence('  {"a":1}  ')).toBe('{"a":1}');
  });
});
