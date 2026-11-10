import type { Payee } from '@/data/workspace/model';

/**
 * Common Nigerian bank description prefixes from NIP, POS, WEB, and aggregator switches.
 */
const NIGERIAN_BANK_PREFIXES = [
  /^POS\s*(\/|\*|-)?\s*/i,
  /^WEB\s*(\/|\*|-)?\s*/i,
  /^TRF\s*(\/|\*|-)?\s*/i,
  /^NIP\s*(\/|\*|-)?\s*/i,
  /^PAYSTACK\s*(\/|\*|-)?\s*/i,
  /^FLUTTERWAVE\s*(\/|\*|-)?\s*/i,
  /^MONIEPOINT\s*(\/|\*|-)?\s*/i,
  /^OPAY\s*(\/|\*|-)?\s*/i,
  /^PALMPAY\s*(\/|\*|-)?\s*/i,
  /^INTERSWITCH\s*(\/|\*|-)?\s*/i,
  /^GTWORLD\s*(\/|\*|-)?\s*/i,
  /^ACCESS\s*(\/|\*|-)?\s*/i,
  /^ZENITH\s*(\/|\*|-)?\s*/i,
  /^UBA\s*(\/|\*|-)?\s*/i,
  /^FIRSTBANK\s*(\/|\*|-)?\s*/i,
  /^KUDA\s*(\/|\*|-)?\s*/i,
  /^STANBIC\s*(\/|\*|-)?\s*/i,
];

/**
 * Suffixes frequently attached to transaction memos (terminal IDs, session suffixes, location acronyms).
 */
const NIGERIAN_MEMO_SUFFIXES = [
  /\s*\*\d+$/i,
  /\s+LA\s+NG$/i,
  /\s+LOS\s+NG$/i,
  /\s+ABJ\s+NG$/i,
  /\s+IB\s+NG$/i,
  /\s+PH\s+NG$/i,
  /\s+NG$/i,
  /\s+TERMINAL\b.*$/i,
  /\s+REF[:\s].*$/i,
  /\s+\d{6,}$/,
];

/**
 * Strips raw bank prefixes, terminal numbers, and location codes from raw descriptions.
 */
export function cleanNigerianMerchantName(raw: string): { cleaned: string; isDirty: boolean; original: string } {
  let cleaned = raw.trim();
  const original = cleaned;

  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of NIGERIAN_BANK_PREFIXES) {
      if (prefix.test(cleaned)) {
        cleaned = cleaned.replace(prefix, '').trim();
        changed = true;
      }
    }
    for (const suffix of NIGERIAN_MEMO_SUFFIXES) {
      if (suffix.test(cleaned)) {
        cleaned = cleaned.replace(suffix, '').trim();
        changed = true;
      }
    }
  }

  // Capitalize neatly if all-caps
  if (cleaned.length > 2 && cleaned === cleaned.toUpperCase()) {
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ''))
      .join(' ');
  }

  return {
    cleaned: cleaned || original,
    isDirty: cleaned !== original && Boolean(cleaned),
    original,
  };
}

/**
 * Normalizes a payee name into a comparison key (lowercase, stripped noise, alpha-numeric tokens only).
 */
export function normalizeMerchantName(name: string): string {
  const { cleaned } = cleanNigerianMerchantName(name);
  return cleaned
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const cur = Math.min(row[j]! + 1, prev + 1, row[j - 1]! + cost);
      row[j - 1] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

export type DuplicateGroup = {
  group: Payee[];
  primary: Payee;
  reason: string;
};

/**
 * Detects fuzzy duplicates across all workspace payees.
 */
export function findFuzzyDuplicates(payees: Payee[]): DuplicateGroup[] {
  const visited = new Set<string>();
  const duplicateGroups: DuplicateGroup[] = [];

  for (let i = 0; i < payees.length; i++) {
    const p1 = payees[i]!;
    if (visited.has(p1.id)) continue;

    const norm1 = normalizeMerchantName(p1.name);
    const tokens1 = new Set(norm1.split(' ').filter((w) => w.length > 2));
    const matched: Payee[] = [p1];

    for (let j = i + 1; j < payees.length; j++) {
      const p2 = payees[j]!;
      if (visited.has(p2.id)) continue;

      const norm2 = normalizeMerchantName(p2.name);
      if (!norm1 || !norm2) continue;

      let isDuplicate = false;
      let reason = '';

      if (norm1 === norm2) {
        isDuplicate = true;
        reason = 'Exact normalized match';
      } else {
        const firstToken1 = norm1.split(' ')[0];
        const firstToken2 = norm2.split(' ')[0];
        if (firstToken1 && firstToken2 && firstToken1 === firstToken2 && firstToken1.length >= 3) {
          isDuplicate = true;
          reason = `Shared primary merchant name (${firstToken1})`;
        } else if (norm1.length > 4 && norm2.length > 4) {
          const dist = levenshtein(norm1, norm2);
          if (dist <= 2) {
            isDuplicate = true;
            reason = `Similar name (${dist} char diff)`;
          } else {
            const tokens2 = norm2.split(' ').filter((w) => w.length > 2);
            const sharedTokens = tokens2.filter((t) => tokens1.has(t));
            if (sharedTokens.length >= 2 || (tokens1.size === 1 && tokens2.length === 1 && sharedTokens.length === 1)) {
              isDuplicate = true;
              reason = `Shared merchant tokens (${sharedTokens.join(', ')})`;
            }
          }
        }
      }

      if (isDuplicate) {
        matched.push(p2);
        visited.add(p2.id);
      }
    }

    if (matched.length > 1) {
      visited.add(p1.id);
      // Pick the cleanest / shortest title as primary
      const sorted = [...matched].sort((a, b) => a.name.length - b.name.length);
      duplicateGroups.push({
        group: matched,
        primary: sorted[0]!,
        reason: 'Potential duplicate merchant names',
      });
    }
  }

  return duplicateGroups;
}
