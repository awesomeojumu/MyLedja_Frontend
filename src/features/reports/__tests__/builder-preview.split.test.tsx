import { fireEvent, screen } from '@testing-library/react-native';

import { t } from '@/i18n';

import { renderWithProviders } from '../../../../test/helpers/render';
import { BuilderPreview } from '../BuilderPreview';
import type { BuilderPreviewResult } from '../builderRunner';

describe('BuilderPreview split / area (P0 #3)', () => {
  it('renders split columns from table.columns / row.values', async () => {
    const result: BuilderPreviewResult = {
      chart: 'table',
      unit: 'money',
      from: '2026-10-01',
      to: '2026-10-31',
      previous: null,
      table: {
        columns: [
          { key: 'cash', label: 'Cash' },
          { key: 'bank', label: 'Bank' },
        ],
        rows: [{ key: 'market', label: 'Market', values: [10_000n, 20_000n], total: 30_000n }],
        columnTotals: [10_000n, 20_000n],
        total: 30_000n,
      },
    };
    await renderWithProviders(<BuilderPreview testID="builder-preview" result={result} />);
    expect(screen.getByTestId('builder-preview-matrix')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Bank')).toBeTruthy();
    expect(screen.getAllByText('₦100.00').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('₦200.00').length).toBeGreaterThanOrEqual(1);
  });

  it('area chart draws filled path', async () => {
    const result: BuilderPreviewResult = {
      chart: 'area',
      unit: 'money',
      from: '2026-10-01',
      to: '2026-10-31',
      previous: null,
      table: {
        columns: [{ key: 'total', label: 'total' }],
        rows: [
          { key: 'a', label: 'A', values: [10n], total: 10n },
          { key: 'b', label: 'B', values: [20n], total: 20n },
        ],
        columnTotals: [30n],
        total: 30n,
      },
    };
    await renderWithProviders(<BuilderPreview testID="builder-preview" result={result} />);
    expect(screen.getByTestId('builder-preview-chart')).toBeTruthy();
    const image = screen.getByLabelText(t('reports.preview'));
    await fireEvent(image, 'layout', { nativeEvent: { layout: { width: 300, height: 160 } } });
    expect(screen.getByTestId('chart-area-fill')).toBeTruthy();
  });
});
