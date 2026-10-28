import { matchInstitution } from '../institutions';

describe('matchInstitution', () => {
  it('matches GTBank from typed account names', () => {
    expect(matchInstitution('GTBank Current')?.id).toBe('gtbank');
  });

  it('matches wallets by keyword', () => {
    expect(matchInstitution('My OPay wallet')?.id).toBe('opay');
    expect(matchInstitution('PalmPay savings')?.id).toBe('palmpay');
  });

  it('returns null for unrelated names', () => {
    expect(matchInstitution('Petty cash')).toBeNull();
  });
});
