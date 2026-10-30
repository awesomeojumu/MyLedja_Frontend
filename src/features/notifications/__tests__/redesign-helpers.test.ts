import { formatRedesignNotificationWhen, redesignEmptyCopy, redesignGroupLabel } from '../redesignHelpers';

describe('Page 27 redesign notification helpers', () => {
  it('formats today as H:MM (Figma 2:1140 Trailing)', () => {
    expect(formatRedesignNotificationWhen('2026-10-28T09:00:00.000Z', '2026-10-28')).toMatch(/^\d+:\d{2}$/);
  });

  it('formats earlier days as D Mon (Figma 2:1140)', () => {
    expect(formatRedesignNotificationWhen('2026-10-01T09:00:00.000Z', '2026-10-28')).toBe('1 Oct');
  });

  it('empty copy keys match Figma 13:6410', () => {
    expect(redesignEmptyCopy()).toEqual({
      title: 'notifications.redesign.emptyTitle',
      body: 'notifications.redesign.emptyBody',
    });
  });

  it('group labels reuse DESIGN Today / This week / Earlier', () => {
    expect(redesignGroupLabel('today')).toBe('notifications.group.today');
    expect(redesignGroupLabel('week')).toBe('notifications.group.week');
    expect(redesignGroupLabel('earlier')).toBe('notifications.group.earlier');
  });
});
