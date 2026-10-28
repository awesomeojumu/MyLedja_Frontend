import { toBase64 } from '../ai';

describe('toBase64', () => {
  it('matches the standard encoding for every padding length', () => {
    for (const text of ['', 'M', 'Ma', 'Man', '%PDF-1.7\n']) {
      expect(toBase64(new TextEncoder().encode(text))).toBe(Buffer.from(text).toString('base64'));
    }
  });
});
