import { expect, test } from '@playwright/test';
import { en, expectNoSeriousAxeIssues } from '../e2e/helpers';
import {
  finishWelcome,
  lastCode,
  openNav,
  PASSWORD,
  signIn,
  signUpAndVerify,
  uniqueEmail,
} from './session';

test.describe.configure({ mode: 'serial' });

test('real API: sign up, check email, finish Welcome, land on Dashboard', async ({ page, isMobile }) => {
  const email = uniqueEmail('signup');
  await signUpAndVerify(page, email);
  await finishWelcome(page);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
  await expectNoSeriousAxeIssues(page);

  // Wrong details
  await openNav(page, isMobile);
  await page.getByRole('button', { name: en['nav.signOut'] }).click();
  await signIn(page, email, 'definitely-wrong-password');
  await expect(page.getByText(en['signIn.wrong'])).toBeVisible();

  // Sign in works
  await signIn(page, email, PASSWORD);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
});

test('real API: recover account then sign in with the new password', async ({ page }) => {
  const email = uniqueEmail('recover');
  await signUpAndVerify(page, email);
  await finishWelcome(page);

  await page.goto('/recover');
  await page.getByRole('textbox', { name: en['auth.email'], exact: true }).fill(email);
  await page.getByRole('button', { name: en['recover.submit'] }).click();
  await expect(page.getByText(en['recover.sent'], { exact: false })).toBeVisible();

  const code = await lastCode(email);
  await page.getByLabel(en['signUp.codeDigit'].replace('{n}', '1')).fill(code);
  const newPassword = 'lagos-sun-2026-ok';
  await page.getByLabel(en['recover.newPassword'], { exact: true }).fill(newPassword);
  await page.getByLabel(en['recover.confirmPassword'], { exact: true }).fill(newPassword);
  await page.getByRole('button', { name: en['recover.save'] }).click();
  await expect(page.getByText(en['recover.doneTitle'], { exact: false })).toBeVisible();
  await page.getByRole('button', { name: en['recover.toSignIn'] }).click();

  await signIn(page, email, newPassword);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
});
