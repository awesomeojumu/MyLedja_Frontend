import { darkTheme, lightTheme, type Theme } from '../theme';
import { sizeClassFor } from '../size';

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((ch) => (ch <= 0.03928 ? ch / 12.92 : ((ch + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const textKeys = ['text', 'textSecondary', 'textHelper', 'link', 'goldLabel'] as const;
const groundKeys = ['page', 'card'] as const;
const hoverTextKeys = ['text', 'textSecondary', 'textHelperOnHover', 'link'] as const;

describe.each([lightTheme, darkTheme])('$name theme meets WCAG AA', (theme: Theme) => {
  for (const t of textKeys) {
    for (const g of groundKeys) {
      it(`${t} on ${g}`, () => {
        expect(contrast(theme[t], theme[g])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
  for (const t of hoverTextKeys) {
    it(`${t} on hover`, () => {
      expect(contrast(theme[t], theme.hover)).toBeGreaterThanOrEqual(4.5);
    });
  }
  it('main button label on its fill', () => {
    expect(contrast(theme.onPrimaryFill, theme.primaryFill)).toBeGreaterThanOrEqual(4.5);
  });
  it('tag text on tag fill', () => {
    expect(contrast(theme.tagText, theme.tagFill)).toBeGreaterThanOrEqual(4.5);
  });
  it('sidebar labels', () => {
    expect(contrast(theme.onSidebar, theme.sidebar)).toBeGreaterThanOrEqual(4.5);
  });
  it('input borders reach 3:1 for non-text', () => {
    expect(contrast(theme.inputBorder, theme.card)).toBeGreaterThanOrEqual(3);
  });
});

describe('size classes (DESIGN.md 3.1)', () => {
  it.each<[number, string]>([
    [375, 'phone'],
    [800, 'tablet'],
    [1100, 'desktop'],
    [1500, 'wide'],
  ])('%i px is %s', (w, cls) => {
    expect(sizeClassFor(w)).toBe(cls);
  });
});
