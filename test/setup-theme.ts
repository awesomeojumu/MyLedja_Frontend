import { syncRedesignTheme } from '@/design/redesign/theme';

jest.setTimeout(15000);

afterEach(() => {
  syncRedesignTheme('light');
});
