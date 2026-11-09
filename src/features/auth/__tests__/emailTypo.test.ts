import { detectEmailTypo } from '../emailTypo';

describe('detectEmailTypo', () => {
  it('detects common typos for gmail', () => {
    expect(detectEmailTypo('user@gamil.com')).toEqual({
      original: 'user@gamil.com',
      suggested: 'user@gmail.com',
      suggestedDomain: 'gmail.com',
    });
    expect(detectEmailTypo('john.doe@gmai.com')?.suggested).toBe('john.doe@gmail.com');
    expect(detectEmailTypo('test@gmial.com')?.suggested).toBe('test@gmail.com');
  });

  it('detects yahoo and hotmail typos', () => {
    expect(detectEmailTypo('user@yaoo.com')?.suggested).toBe('user@yahoo.com');
    expect(detectEmailTypo('user@hotmial.com')?.suggested).toBe('user@hotmail.com');
    expect(detectEmailTypo('user@outlok.com')?.suggested).toBe('user@outlook.com');
  });

  it('returns null for valid emails without typos', () => {
    expect(detectEmailTypo('user@gmail.com')).toBeNull();
    expect(detectEmailTypo('user@yahoo.com')).toBeNull();
    expect(detectEmailTypo('user@mycompany.org')).toBeNull();
    expect(detectEmailTypo('invalid-email')).toBeNull();
    expect(detectEmailTypo('')).toBeNull();
  });
});
