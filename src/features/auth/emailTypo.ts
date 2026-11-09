const TYPO_MAP: Record<string, string> = {
  // Gmail
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmeil.com': 'gmail.com',
  'gamail.com': 'gmail.com',
  'gmaik.com': 'gmail.com',
  'gamil.co': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmaio.com': 'gmail.com',

  // Yahoo
  'yaoo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yaho.com.ng': 'yahoo.com',

  // Hotmail
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmale.com': 'hotmail.com',
  'hormail.com': 'hotmail.com',

  // Outlook
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlock.com': 'outlook.com',
  'ootlook.com': 'outlook.com',
  'outluk.com': 'outlook.com',
  'putlook.com': 'outlook.com',

  // iCloud
  'iclod.com': 'icloud.com',
  'iclou.com': 'icloud.com',
  'iclloud.com': 'icloud.com',
  'icoud.com': 'icloud.com',

  // Proton
  'prton.me': 'proton.me',
  'protomail.com': 'proton.me',
  'protonmial.com': 'proton.me',
};

/**
 * Checks if the given email has a recognized domain typo.
 * Returns the suggested corrected email, or null if no known typo is detected.
 */
export function detectEmailTypo(email: string): { original: string; suggested: string; suggestedDomain: string } | null {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return null;

  const localPart = trimmed.slice(0, atIndex);
  const domainPart = trimmed.slice(atIndex + 1).toLowerCase();

  const suggestedDomain = TYPO_MAP[domainPart];
  if (!suggestedDomain || suggestedDomain === domainPart) return null;

  return {
    original: trimmed,
    suggested: `${localPart}@${suggestedDomain}`,
    suggestedDomain,
  };
}
