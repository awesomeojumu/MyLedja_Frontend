/** Tags ride in notes as a `tags:a,b` line so we stay schema-compatible (PU-01 / PU-18). */

const TAGS_RE = /^tags:(.*)$/m;

export function parseTags(notes?: string | null): string[] {
  if (!notes) return [];
  const m = notes.match(TAGS_RE);
  if (!m?.[1]) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripTagsLine(notes?: string | null): string {
  if (!notes) return '';
  return notes.replace(TAGS_RE, '').replace(/\n{2,}/g, '\n').trim();
}

export function withTags(notes: string | undefined, tags: string[]): string | undefined {
  const body = stripTagsLine(notes);
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  const tagLine = clean.length ? `tags:${clean.join(',')}` : '';
  const combined = [tagLine, body].filter(Boolean).join('\n');
  return combined || undefined;
}
