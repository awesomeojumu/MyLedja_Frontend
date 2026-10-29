/** Nigerian banks and wallets for Welcome step 3 (DESIGN.md page 4 / GET /v1/institutions). */

export type Institution = {
  id: string;
  label: string;
  keywords: string[];
  initials: string;
  logoUrl?: string | null;
};

/** Offline fallback when GET /v1/institutions is unreachable. */
export const NG_INSTITUTIONS: Institution[] = [
  { id: 'gtbank', label: 'GTBank', keywords: ['gtb', 'gt bank', 'guaranty trust', 'gtco'], initials: 'GT' },
  { id: 'access', label: 'Access Bank', keywords: ['access', 'diamond'], initials: 'AB' },
  { id: 'zenith', label: 'Zenith Bank', keywords: ['zenith'], initials: 'ZB' },
  { id: 'first-bank', label: 'First Bank', keywords: ['first bank', 'fbn', 'firstbank'], initials: 'FB' },
  { id: 'uba', label: 'UBA', keywords: ['uba', 'united bank'], initials: 'UB' },
  { id: 'fcmb', label: 'FCMB', keywords: ['fcmb'], initials: 'FC' },
  { id: 'stanbic', label: 'Stanbic IBTC', keywords: ['stanbic', 'ibtc'], initials: 'SI' },
  { id: 'fidelity', label: 'Fidelity Bank', keywords: ['fidelity'], initials: 'FB' },
  { id: 'union', label: 'Union Bank', keywords: ['union bank', 'unionbank'], initials: 'UB' },
  { id: 'polaris', label: 'Polaris Bank', keywords: ['polaris', 'skye'], initials: 'PB' },
  { id: 'kuda', label: 'Kuda', keywords: ['kuda'], initials: 'KD' },
  { id: 'opay', label: 'OPay', keywords: ['opay', 'o pay', 'paycom'], initials: 'OP' },
  { id: 'palmpay', label: 'PalmPay', keywords: ['palmpay', 'palm pay'], initials: 'PP' },
  { id: 'moniepoint', label: 'Moniepoint', keywords: ['moniepoint', 'monie point', 'teamapt'], initials: 'MP' },
  { id: 'paystack', label: 'Paystack', keywords: ['paystack'], initials: 'PS' },
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

/** Map API InstitutionList rows into the Welcome matcher shape. */
export function fromApiInstitutions(
  rows: { id: string; name: string; aliases: string[]; logoUrl: string | null }[],
): Institution[] {
  return rows.map((r) => ({
    id: r.id,
    label: r.name,
    keywords: r.aliases,
    initials: initialsOf(r.name),
    logoUrl: r.logoUrl,
  }));
}

/** Best institution match for a typed account name, if any. */
export function matchInstitution(accountName: string, list: Institution[] = NG_INSTITUTIONS): Institution | null {
  const hay = normalize(accountName);
  if (!hay) return null;
  let best: { inst: Institution; score: number } | null = null;
  for (const inst of list) {
    const labelNorm = normalize(inst.label);
    if (hay.includes(labelNorm) || labelNorm.includes(hay)) {
      const score = labelNorm.length;
      if (!best || score > best.score) best = { inst, score };
      continue;
    }
    for (const kw of inst.keywords) {
      const k = normalize(kw);
      if (k.length >= 3 && hay.includes(k)) {
        const score = k.length;
        if (!best || score > best.score) best = { inst, score };
      }
    }
  }
  return best?.inst ?? null;
}
