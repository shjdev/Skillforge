import { describe, expect, it } from 'vitest';
import { describeBlobError } from './blobUpload';

const file = { size: 12 * 1024 * 1024 };

describe('describeBlobError', () => {
  it('reports the size for a file-too-large error', () => {
    const msg = describeBlobError(new Error('Vercel Blob: File is too large, the file length cannot be greater than 1000.'), file);
    expect(msg).toContain('trop volumineux');
    expect(msg).toContain('12.0 Mo');
  });

  it('explains a missing Blob store token', () => {
    const msg = describeBlobError(new Error('Vercel Blob: No read-write token found.'), file);
    expect(msg).toContain('Blob store');
  });

  it('keeps the original message otherwise', () => {
    expect(describeBlobError(new Error('boom'), file)).toContain('boom');
  });
});
