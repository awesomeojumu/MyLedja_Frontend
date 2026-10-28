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

/** A new person through sign-up and Welcome, so the device holds a seeded workspace. */
export async function signUpAndSetUp(page: Page, email: string) {
  await page.goto('/sign-up');
  await page.getByLabel(en['signUp.name'], { exact: true }).fill('Tunde');
  await page.getByLabel(en['auth.email'], { exact: true }).fill(email);
  await page.getByLabel(en['auth.password'], { exact: true }).fill('lagos-rain-2026');
  await page.getByTestId('terms').click();
  await page.getByRole('button', { name: en['signUp.submit'] }).click();
  await page.getByLabel(en['signUp.codeDigit'].replace('{n}', '1')).fill(ADA.code);
  await page.getByRole('button', { name: en['signUp.verify'] }).click();
  await page.getByRole('button', { name: en['signUp.readyContinue'] }).click();
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(en['welcome.stepOf'].replace('{n}', String(step)))).toBeVisible();
    await page.getByRole('button', { name: en['common.continue'], exact: true }).click();
  }
  await page.getByRole('button', { name: en['welcome.done.dashboard'] }).click();
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
}
