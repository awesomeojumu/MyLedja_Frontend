/** Date formatter for overlay headers and dates: YYYY-MM-DD -> formatted string */
export function formatDay(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const [year, month, day] = isoDate.split('-');
    if (!year || !month || !day) return isoDate;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(month, 10) - 1;
    return `${parseInt(day, 10)} ${months[mIdx] ?? month} ${year}`;
  } catch {
    return isoDate;
  }
}
