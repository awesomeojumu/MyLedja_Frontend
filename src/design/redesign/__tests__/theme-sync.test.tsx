import { render } from '@testing-library/react-native';
import { DesignProvider } from '@/design/ThemeProvider';
import { redesignLight, syncRedesignTheme } from '../theme';

describe('redesign theme sync', () => {
  afterEach(() => {
    syncRedesignTheme('light');
  });

  it('keeps light surfaces white', async () => {
    await render(
      <DesignProvider initialChoice="light">
        <></>
      </DesignProvider>,
    );
    expect(redesignLight.surface).toBe('#FFFFFF');
    expect(redesignLight.text).toBe('#001D34');
  });

  it('switches cards and text when the choice is dark', async () => {
    syncRedesignTheme('light');
    await render(
      <DesignProvider initialChoice="dark">
        <></>
      </DesignProvider>,
    );
    expect(redesignLight.page).toBe('#071326');
    expect(redesignLight.surface).toBe('#102844');
    expect(redesignLight.text).toBe('#F6F9FE');
  });
});
