/** Query keys for goals popups/tabs (addendum PU-30…33, TB-05). */
export const GOAL_URL = {
  tab: 'tab',
  goal: 'goal',
  allocate: 'allocate',
  goalSchedule: 'goalSchedule',
} as const;

export type GoalsListTab = 'active' | 'done';

export function parseGoalsTab(raw: string | undefined): GoalsListTab {
  if (raw === 'done' || raw === 'completed') return 'done';
  return 'active';
}

export function goalsTabParam(tab: GoalsListTab): string {
  return tab === 'done' ? 'done' : 'active';
}
