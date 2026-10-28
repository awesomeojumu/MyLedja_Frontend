import { expect, type Page } from '@playwright/test';
import { en } from '../e2e/helpers';

export const API = process.env.E2E_API_URL ?? 'http://localhost:4000';
export const MAIL = process.env.E2E_MAIL_URL ?? 'http://localhost:2526';
export const PASSWORD = 'lagos-rain-2026';

export const uniqueEmail = (tag: string) =>
  `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

export async function lastCode(email: string): Promise<string> {
  let code = '';
  await expect
    .poll(async () => {
      const res = await fetch(`${MAIL}/?email=${encodeURIComponent(email)}`);
      code = ((await res.json()) as { code: string }).code;
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code;
}

export async function signUpAndVerify(page: Page, email: string, name = 'Tunde') {
  await page.goto('/sign-up');
  await page.getByLabel(en['signUp.name'], { exact: true }).fill(name);
  await page.getByLabel(en['auth.email'], { exact: true }).fill(email);
  await page.getByLabel(en['auth.password'], { exact: true }).fill(PASSWORD);
  await page.getByTestId('terms').click();
  await page.getByRole('button', { name: en['signUp.submit'] }).click();
  await expect(page.getByText(en['signUp.checkTitle'])).toBeVisible();
  const code = await lastCode(email);
  await page.getByLabel(en['signUp.codeDigit'].replace('{n}', '1')).fill(code);
  await page.getByRole('button', { name: en['signUp.verify'] }).click();
  await expect(page.getByText(en['signUp.readyTitle'])).toBeVisible();
  await page.getByRole('button', { name: en['signUp.readyContinue'] }).click();
}

export async function finishWelcome(
  page: Page,
  first?: { account: string; opening: string },
) {
  await expect(page).toHaveURL(/\/welcome$/);
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(en['welcome.stepOf'].replace('{n}', String(step)))).toBeVisible();
    if (step === 3 && first) {
      await page.getByRole('textbox', { name: en['welcome.step3.name'], exact: true }).fill(first.account);
      await page.getByRole('textbox', { name: en['welcome.step3.opening'], exact: true }).fill(first.opening);
    }
    await page.getByRole('button', { name: en['common.continue'], exact: true }).click();
  }
  await expect(page.getByText(en['welcome.done.title'])).toBeVisible();
  await page.getByRole('button', { name: en['welcome.done.dashboard'] }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { name: en['signIn.title'] })).toBeVisible();
  await page.getByRole('textbox', { name: en['auth.email'], exact: true }).fill(email);
  await page.getByLabel(en['auth.password'], { exact: true }).fill(password);
  await page.getByRole('button', { name: en['signIn.submit'], exact: true }).click();
}

export async function openNav(page: Page, isMobile: boolean) {
  if (isMobile) await page.getByRole('button', { name: en['nav.menu'] }).click();
}

/** Select uses button + radio options (not combobox/option). Always scope to the open dialog. */
export async function pickSelect(page: Page, testId: string, optionLabel: string) {
  const trigger = page.getByRole('dialog').getByTestId(testId);
  const label = (await trigger.getAttribute('aria-label')) ?? '';
  if (label.endsWith(`, ${optionLabel}`) || label === optionLabel) return;
  await trigger.click();
  await page.getByRole('radio', { name: optionLabel, exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-label', new RegExp(`${optionLabel}$`));
}
