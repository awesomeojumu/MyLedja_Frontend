import { t } from '@/i18n';
import { formatTxDayHeader } from '../dayHeader';

describe('formatTxDayHeader', () => {
  it('says Today for the current workspace day', () => {
    expect(formatTxDayHeader('2026-10-30', '2026-10-30')).toBe(t('date.today'));
  });

  it('uses weekday and long month like Figma', () => {
    expect(formatTxDayHeader('2026-10-28', '2026-10-30')).toBe('Wednesday, 28 October');
  });
});
