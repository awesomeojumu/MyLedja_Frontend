/** Re-exports kept for older tests (PU-45 share helper). Prefer helpers. */
export { shareHasNaira } from './helpers';

export function scoreBand(score: number): 'strong' | 'okay' | 'needsAttention' {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'okay';
  return 'needsAttention';
}
