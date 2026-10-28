/** Nigerian banks and wallets for Welcome step 3 (DESIGN.md page 4). Logos via API later (Q-8); monogram badges until then. */
export type Institution = {
  id: string;
  label: string;
  keywords: string[];
  /** Badge background (brand-adjacent; not official marks). */
  color: string;
  initials: string;
};

export const NG_INSTITUTIONS: Institution[] = [
  { id: 'gtbank', label: 'GTBank', keywords: ['gtb', 'gt bank', 'guaranty trust'], color: '#E35205', initials: 'GT' },
  { id: 'access', label: 'Access Bank', keywords: ['access', 'diamond'], color: '#FF8200', initials: 'AB' },
  { id: 'zenith', label: 'Zenith Bank', keywords: ['zenith'], color: '#E2231A', initials: 'ZB' },
  { id: 'firstbank', label: 'First Bank', keywords: ['first bank', 'fbn', 'firstbank'], color: '#002776', initials: 'FB' },
  { id: 'uba', label: 'UBA', keywords: ['uba', 'united bank'], color: '#D71920', initials: 'UB' },
  { id: 'fcmb', label: 'FCMB', keywords: ['fcmb'], color: '#5C068C', initials: 'FC' },
  { id: 'stanbic', label: 'Stanbic IBTC', keywords: ['stanbic', 'ibtc'], color: '#0033A0', initials: 'SI' },
  { id: 'fidelity', label: 'Fidelity Bank', keywords: ['fidelity'], color: '#081A4A', initials: 'FB' },
  { id: 'union', label: 'Union Bank', keywords: ['union bank', 'unionbank'], color: '#2A2A72', initials: 'UB' },
  { id: 'polaris', label: 'Polaris Bank', keywords: ['polaris', 'skye'], color: '#582C83', initials: 'PB' },
  { id: 'kuda', label: 'Kuda', keywords: ['kuda'], color: '#40196D', initials: 'KD' },
  { id: 'opay', label: 'OPay', keywords: ['opay', 'o pay'], color: '#1DCF9F', initials: 'OP' },
  { id: 'palmpay', label: 'PalmPay', keywords: ['palmpay', 'palm pay'], color: '#6A35FF', initials: 'PP' },
  { id: 'moniepoint', label: 'Moniepoint', keywords: ['moniepoint', 'monie point'], color: '#035FE3', initials: 'MP' },
  { id: 'paystack', label: 'Paystack Titan', keywords: ['paystack'], color: '#3BB75E', initials: 'PS' },
];

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Best institution match for a typed account name, if any. */
export function matchInstitution(accountName: string): Institution | null {
  const hay = normalize(accountName);
  if (!hay) return null;
  let best: { inst: Institution; score: number } | null = null;
  for (const inst of NG_INSTITUTIONS) {
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
