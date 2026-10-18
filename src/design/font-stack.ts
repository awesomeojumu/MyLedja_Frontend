/** Web Inter_400Regular drops space glyphs. Prefer system UI on web. */
export function namedFontFamily(loaded: string | undefined, web: boolean): string | undefined {
  if (!loaded) return undefined;
  if (!web) return loaded;
  return "ui-sans-serif, system-ui, Segoe UI, sans-serif";
}

export const WEB_SPACE_CSS = `
input, textarea { outline: none; }
[class*="css-text"] { white-space: pre-wrap !important; }
`;
