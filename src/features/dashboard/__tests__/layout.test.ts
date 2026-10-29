import { DEFAULT_DASHBOARD_LAYOUT, moveCard, resolveDashboardLayout, toggleCardHidden, visibleDashboardCards } from '../layout';

describe('dashboard layout', () => {
  it('P05-08: defaults include every card, with Health and Investments from Phase 5', () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.order.length).toBe(14);
    expect(visibleDashboardCards(DEFAULT_DASHBOARD_LAYOUT)).toHaveLength(14);
    expect(DEFAULT_DASHBOARD_LAYOUT.order.slice(-2)).toEqual(['health', 'investments']);
  });

  it('merge keeps unknown ids out and appends new cards', () => {
    const merged = resolveDashboardLayout({ order: ['netWorth', 'unknown'], hidden: ['recent'] });
    expect(merged.order[0]).toBe('netWorth');
    expect(merged.order).toContain('checklist');
    expect(merged.hidden).toContain('recent');
  });

  it('moveCard swaps neighbors', () => {
    const order = [...DEFAULT_DASHBOARD_LAYOUT.order];
    const next = moveCard(order, 'netWorth', 'down');
    expect(next[0]).toBe('checklist');
    expect(next[1]).toBe('leftToSpend');
  });

  it('toggleCardHidden tracks visibility', () => {
    const hidden = toggleCardHidden([], 'goals', false);
    expect(hidden).toContain('goals');
    const shown = toggleCardHidden(hidden, 'goals', true);
    expect(shown).not.toContain('goals');
  });
});
