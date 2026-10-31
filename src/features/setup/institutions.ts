/** Nigerian banks and wallets for Welcome step 3 (DESIGN.md page 4 / GET /v1/institutions). */

export type Institution = {
  id: string;
  label: string;
  keywords: string[];
  initials: string;
  logoUrl?: string | null;
};

/** Offline fallback when GET /v1/institutions is unreachable. Same names as the API list. */
export const NG_INSTITUTIONS: Institution[] = [
  { id: 'access', label: 'Access Bank', keywords: ['access', 'diamond'], initials: 'AB' },
  { id: 'citibank', label: 'Citibank Nigeria', keywords: ['citi', 'citibank'], initials: 'CN' },
  { id: 'ecobank', label: 'Ecobank', keywords: ['ecobank'], initials: 'EC' },
  { id: 'fcmb', label: 'FCMB', keywords: ['fcmb', 'first city monument'], initials: 'FC' },
  { id: 'fidelity', label: 'Fidelity Bank', keywords: ['fidelity'], initials: 'FI' },
  { id: 'first-bank', label: 'First Bank', keywords: ['first bank', 'fbn', 'firstbank'], initials: 'FB' },
  { id: 'globus', label: 'Globus Bank', keywords: ['globus'], initials: 'GB' },
  { id: 'gtbank', label: 'GTBank', keywords: ['gtb', 'gt bank', 'guaranty trust', 'gtco'], initials: 'GT' },
  { id: 'jaiz', label: 'Jaiz Bank', keywords: ['jaiz'], initials: 'JB' },
  { id: 'keystone', label: 'Keystone Bank', keywords: ['keystone'], initials: 'KB' },
  { id: 'lotus', label: 'Lotus Bank', keywords: ['lotus'], initials: 'LB' },
  { id: 'optimus', label: 'Optimus Bank', keywords: ['optimus'], initials: 'OB' },
  { id: 'parallex', label: 'Parallex Bank', keywords: ['parallex'], initials: 'PX' },
  { id: 'polaris', label: 'Polaris Bank', keywords: ['polaris', 'skye'], initials: 'PB' },
  { id: 'premiumtrust', label: 'PremiumTrust Bank', keywords: ['premiumtrust', 'premium trust'], initials: 'PT' },
  { id: 'providus', label: 'Providus Bank', keywords: ['providus'], initials: 'PV' },
  { id: 'stanbic', label: 'Stanbic IBTC', keywords: ['stanbic', 'ibtc'], initials: 'SI' },
  { id: 'standard-chartered', label: 'Standard Chartered', keywords: ['standard chartered', 'stanchart'], initials: 'SC' },
  { id: 'sterling', label: 'Sterling Bank', keywords: ['sterling'], initials: 'SB' },
  { id: 'suntrust', label: 'SunTrust Bank', keywords: ['suntrust', 'sun trust'], initials: 'ST' },
  { id: 'taj', label: 'TAJBank', keywords: ['taj', 'tajbank'], initials: 'TJ' },
  { id: 'titan-trust', label: 'Titan Trust Bank', keywords: ['titan', 'titan trust'], initials: 'TT' },
  { id: 'uba', label: 'UBA', keywords: ['uba', 'united bank'], initials: 'UB' },
  { id: 'union', label: 'Union Bank', keywords: ['union bank', 'unionbank'], initials: 'UN' },
  { id: 'unity', label: 'Unity Bank', keywords: ['unity'], initials: 'UY' },
  { id: 'wema', label: 'Wema Bank', keywords: ['wema', 'alat'], initials: 'WB' },
  { id: 'zenith', label: 'Zenith Bank', keywords: ['zenith'], initials: 'ZB' },
  { id: 'kuda', label: 'Kuda', keywords: ['kuda'], initials: 'KD' },
  { id: 'moniepoint', label: 'Moniepoint', keywords: ['moniepoint', 'monie point', 'teamapt'], initials: 'MP' },
  { id: 'fairmoney', label: 'FairMoney', keywords: ['fairmoney', 'fair money'], initials: 'FM' },
  { id: 'carbon', label: 'Carbon', keywords: ['carbon', 'paylater'], initials: 'CB' },
  { id: 'vfd', label: 'VFD Microfinance Bank', keywords: ['vfd', 'vbank'], initials: 'VF' },
  { id: 'rubies', label: 'Rubies Bank', keywords: ['rubies'], initials: 'RB' },
  { id: 'sparkle', label: 'Sparkle', keywords: ['sparkle'], initials: 'SP' },
  { id: 'opay', label: 'OPay', keywords: ['opay', 'o pay', 'paycom'], initials: 'OP' },
  { id: 'palmpay', label: 'PalmPay', keywords: ['palmpay', 'palm pay'], initials: 'PP' },
  { id: 'paga', label: 'Paga', keywords: ['paga'], initials: 'PG' },
  { id: 'chipper', label: 'Chipper Cash', keywords: ['chipper'], initials: 'CC' },
  { id: 'paystack', label: 'Paystack', keywords: ['paystack'], initials: 'PS' },
  { id: 'piggyvest', label: 'PiggyVest', keywords: ['piggyvest', 'piggybank'], initials: 'PV' },
  { id: 'cowrywise', label: 'Cowrywise', keywords: ['cowrywise', 'cowry wise'], initials: 'CW' },
  { id: 'risevest', label: 'Risevest', keywords: ['risevest', 'rise'], initials: 'RV' },
  { id: 'bamboo', label: 'Bamboo', keywords: ['bamboo'], initials: 'BM' },
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
