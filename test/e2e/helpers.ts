import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Locator, type Page } from '@playwright/test';
import en from '../../src/i18n/en.json';

export { en };

/** Demo person from build plan 2.7; works only with the built-in mock (no EXPO_PUBLIC_API_URL). */
export const ADA = { email: 'ada@example.test', password: 'demo-password-1', code: '123456' };
export const PASSWORD = 'lagos-rain-2026!';

export async function expectNoSeriousAxeIssues(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** The first text field after a label (form fields here are a label then an input). */
export const fieldAfter = (page: Page, label: string, nth = 0): Locator =>
  page.getByText(label, { exact: true }).nth(nth).locator('xpath=following::input[1]');

export async function signIn(page: Page, email = ADA.email, password = ADA.password) {
  await page.goto('/sign-in');
  await page.getByPlaceholder(en['ui.signInScreen.youDomainCom']).fill(email);
  await page.getByPlaceholder('••••••••••••').fill(password);
  await page.getByText(en['ui.signInScreen.signIn'], { exact: true }).click();
}

/** A new person through sign up and the email code, ending on Welcome. */
export async function signUp(page: Page, email: string) {
  await page.goto('/sign-up');
  await page.getByPlaceholder(en['ui.signUpScreen.eGTundeAdebayo']).fill('Tunde');
  await page.getByPlaceholder(en['ui.signUpScreen.youDomainCom']).fill(email);
  await page.getByPlaceholder(en['signUp.rule.length']).fill(PASSWORD);
  await page.getByText(en['ui.signUpScreen.termsOfServiceAndPrivacy'], { exact: true }).click();
  await page.getByText(en['ui.termsPrivacySheet.iUnderstandAndAgree'], { exact: true }).click();
  await page.getByText(en['ui.signUpScreen.createAccount'], { exact: true }).click();
  // The code goes in as soon as all six digits are typed.
  await page.getByPlaceholder('123456').fill(ADA.code);
  await expect(page).toHaveURL(/\/welcome$/);
}

export const stepHeader = (n: number, key: keyof typeof en) =>
  `${en['wiz.stepOf'].replace('{n}', String(n)).replace('{total}', '7')} · ${en[key]}`;

export const next = (page: Page) => page.getByText(en['wiz.next'], { exact: true }).click();

/** Adds an account in Welcome's Your money step through one of the quick chips. */
export async function addWelcomeAccount(page: Page, chip: keyof typeof en, name: string, balance: string) {
  await page.getByText(en[chip], { exact: true }).click();
  await page.getByPlaceholder(en['account.sheet.namePlaceholder']).fill(name);
  await fieldAfter(page, en['account.sheet.balance']).fill(balance);
  await page.getByText(en['account.sheet.save'], { exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

/** Sign up and go straight through Welcome with one everyday account, landing on the Dashboard. */
export async function signUpAndSetUp(page: Page, email: string) {
  await signUp(page, email);
  await next(page);
  await addWelcomeAccount(page, 'wiz.money.quick.operating', 'GTBank Current', '100000');
  for (let step = 2; step < 7; step++) await next(page);
  await expect(page.getByText(stepHeader(7, 'wiz.step.review'))).toBeVisible();
  await page.getByText(en['wiz.finish'], { exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Naira as the app shows it. */
export const naira = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
