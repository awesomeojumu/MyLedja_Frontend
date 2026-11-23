import { expect, test } from '@playwright/test';
import { ADA, en, expectNoSeriousAxeIssues, next, signIn, signUp, stepHeader } from './helpers';

test('opens on Sign in, in light mode, and the toggle switches to dark', async ({ browser }) => {
  // Even with the device set to dark, a first visit is light until the person chooses.
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto('/');
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole('button', { name: en['theme.toDark'] })).toBeVisible();
  await page.getByRole('button', { name: en['theme.toDark'] }).click();
  await expect(page.getByRole('button', { name: en['theme.toLight'] })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: en['theme.toLight'] })).toBeVisible();
  await context.close();
});

test('Sign in passes the accessibility check', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page.getByText(en['ui.signInScreen.signIn'], { exact: true })).toBeVisible();
  await expectNoSeriousAxeIssues(page);
});

test('P01-02 wrong details never say which one', async ({ page }) => {
  await signIn(page, ADA.email, 'not-the-password-1');
  await expect(page.getByText(en['signIn.wrong'])).toBeVisible();
});

test('a person who has set up signs in to the Dashboard', async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(en['ui.quickActionTrio.addExpense'], { exact: true }).first()).toBeVisible();
});

test('recover the password with the email code', async ({ page }) => {
  await page.goto('/recover');
  await page.getByPlaceholder(en['ui.recoverScreen.youDomainCom']).fill(ADA.email);
  await page.getByText(en['ui.recoverScreen.sendRecoveryCode'], { exact: true }).click();
  await page.getByPlaceholder('123456').fill(ADA.code);
  await page.getByPlaceholder(en['signUp.rule.length']).fill('new-lagos-pass-1');
  await page.getByText(en['ui.recoverScreen.resetPassword'], { exact: true }).click();
  await expect(page.getByText(en['recover.doneTitle'])).toBeVisible();
});

test('sign up, the email code, all seven Welcome steps, then the Dashboard', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await signUp(page, `tunde-${isMobile ? 'phone' : 'desktop'}@example.test`);
  const steps = [
    'wiz.step.space',
    'wiz.step.money',
    'wiz.step.budget',
    'wiz.step.categories',
    'wiz.step.bills',
    'wiz.step.goals',
    'wiz.step.review',
  ] as const;
  for (const [i, key] of steps.entries()) {
    await expect(page.getByText(stepHeader(i + 1, key))).toBeVisible();
    if (i === 0) await expectNoSeriousAxeIssues(page);
    if (i < steps.length - 1) await next(page);
  }
  await page.getByText(en['wiz.finish'], { exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(en['ui.quickActionTrio.addExpense'], { exact: true }).first()).toBeVisible();
});
