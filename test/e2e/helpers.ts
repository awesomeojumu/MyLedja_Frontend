import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json';

export { en };

/** Demo person from build plan 2.7; works only with the mock adapter. */
export const ADA = { email: 'ada@example.test', password: 'demo-password-1', code: '123456' };

export async function expectNoSeriousAxeIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

export async function signIn(page: Page, email = ADA.email, password = ADA.password) {
  await page.goto('/sign-in');
  await page.getByLabel(en['auth.email'], { exact: true }).fill(email);
  await page.getByLabel(en['auth.password'], { exact: true }).fill(password);
  await page.getByRole('button', { name: en['signIn.submit'], exact: true }).click();
}
