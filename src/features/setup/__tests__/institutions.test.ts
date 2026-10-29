import { fromApiInstitutions, matchInstitution } from '../institutions';

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

  it('uses API list when provided, including logoUrl', () => {
    const list = fromApiInstitutions([
      { id: 'gtbank', name: 'GTBank', aliases: ['GTCO'], logoUrl: 'https://cdn.example/gt.png' },
    ]);
    const hit = matchInstitution('GTCO Current', list);
    expect(hit?.id).toBe('gtbank');
    expect(hit?.logoUrl).toBe('https://cdn.example/gt.png');
  });
});
