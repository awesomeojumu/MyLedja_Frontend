import {
  DEFAULT_DASHBOARD_LAYOUT,
  layoutDeviceKind,
  moveCard,
  reorderCard,
  resolveDashboardLayout,
  resolveLayoutForDevice,
  toggleCardHidden,
  visibleDashboardCards,
  withStoredLayoutForDevice,
} from '../layout';

describe('dashboard layout', () => {
  it('P05-08: defaults include Phase 1–2 plus Health and Investments', () => {
    expect(DEFAULT_DASHBOARD_LAYOUT.order.length).toBe(14);
    expect(visibleDashboardCards(DEFAULT_DASHBOARD_LAYOUT)).toHaveLength(14);
    expect(DEFAULT_DASHBOARD_LAYOUT.order.indexOf('comingUp')).toBeLessThan(DEFAULT_DASHBOARD_LAYOUT.order.indexOf('incomeVsSpending'));
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

  it('PU06: phone and larger layouts are stored separately', () => {
    expect(layoutDeviceKind('phone')).toBe('phone');
    expect(layoutDeviceKind('desktop')).toBe('larger');
    const phoneHidden = withStoredLayoutForDevice(
      { budgetStyle: 'tracking', currency: 'NGN', weekStart: 'monday' },
      'phone',
      { order: [...DEFAULT_DASHBOARD_LAYOUT.order], hidden: ['goals'] },
    );
    expect(phoneHidden.dashboardLayoutPhone?.hidden).toContain('goals');
    expect(resolveLayoutForDevice(phoneHidden, 'phone').hidden).toContain('goals');
    expect(resolveLayoutForDevice(phoneHidden, 'desktop').hidden).not.toContain('goals');
  });

  it('PU06-2: reorderCard drops onto a target', () => {
    const order = [...DEFAULT_DASHBOARD_LAYOUT.order];
    const next = reorderCard(order, 'checklist', 'statTiles');
    expect(next.indexOf('checklist')).toBeGreaterThan(next.indexOf('netWorth'));
  });
});
