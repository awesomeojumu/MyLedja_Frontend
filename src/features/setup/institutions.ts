/** Nigerian banks and wallets for Welcome step 3 (DESIGN.md page 4). Logos via API later (Q-8); navy monogram tiles until then. */
export type Institution = {
  id: string;
  label: string;
  keywords: string[];
  initials: string;
};

export const NG_INSTITUTIONS: Institution[] = [
  { id: 'gtbank', label: 'GTBank', keywords: ['gtb', 'gt bank', 'guaranty trust'], initials: 'GT' },
  { id: 'access', label: 'Access Bank', keywords: ['access', 'diamond'], initials: 'AB' },
  { id: 'zenith', label: 'Zenith Bank', keywords: ['zenith'], initials: 'ZB' },
  { id: 'firstbank', label: 'First Bank', keywords: ['first bank', 'fbn', 'firstbank'], initials: 'FB' },
  { id: 'uba', label: 'UBA', keywords: ['uba', 'united bank'], initials: 'UB' },
  { id: 'fcmb', label: 'FCMB', keywords: ['fcmb'], initials: 'FC' },
  { id: 'stanbic', label: 'Stanbic IBTC', keywords: ['stanbic', 'ibtc'], initials: 'SI' },
  { id: 'fidelity', label: 'Fidelity Bank', keywords: ['fidelity'], initials: 'FB' },
  { id: 'union', label: 'Union Bank', keywords: ['union bank', 'unionbank'], initials: 'UB' },
  { id: 'polaris', label: 'Polaris Bank', keywords: ['polaris', 'skye'], initials: 'PB' },
  { id: 'kuda', label: 'Kuda', keywords: ['kuda'], initials: 'KD' },
  { id: 'opay', label: 'OPay', keywords: ['opay', 'o pay'], initials: 'OP' },
  { id: 'palmpay', label: 'PalmPay', keywords: ['palmpay', 'palm pay'], initials: 'PP' },
  { id: 'moniepoint', label: 'Moniepoint', keywords: ['moniepoint', 'monie point'], initials: 'MP' },
  { id: 'paystack', label: 'Paystack Titan', keywords: ['paystack'], initials: 'PS' },
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
