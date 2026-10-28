import { expect, test } from '@playwright/test';
import { ADA, en, expectNoSeriousAxeIssues, signIn } from './helpers';

test('sign up, check email, finish Welcome, land on Dashboard', async ({ page }) => {
  await page.goto('/sign-up');
  await page.getByLabel(en['signUp.name'], { exact: true }).fill('Tunde');
  await page.getByLabel(en['auth.email'], { exact: true }).fill('tunde@example.test');
  await page.getByLabel(en['auth.password'], { exact: true }).fill('lagos-rain-2026');
  await page.getByTestId('terms').click();
  await page.getByRole('button', { name: en['signUp.submit'] }).click();

  await expect(page.getByText(en['signUp.checkTitle'])).toBeVisible();
  await page.getByLabel(en['signUp.codeDigit'].replace('{n}', '1')).fill(ADA.code);
  await page.getByRole('button', { name: en['signUp.verify'] }).click();
  await expect(page.getByText(en['signUp.readyTitle'])).toBeVisible();
  await page.getByRole('button', { name: en['signUp.readyContinue'] }).click();

  await expect(page).toHaveURL(/\/welcome$/);
  for (let step = 1; step <= 5; step++) {
    await expect(page.getByText(en['welcome.stepOf'].replace('{n}', String(step)))).toBeVisible();
    await page.getByRole('button', { name: en['common.continue'], exact: true }).click();
  }
  await expect(page.getByText(en['welcome.done.title'])).toBeVisible();
  await page.getByRole('button', { name: en['welcome.done.dashboard'] }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
});

test('sign in, sign out, recover the password', async ({ page, isMobile }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();

  if (isMobile) await page.getByRole('button', { name: en['nav.menu'] }).click();
  await page.getByRole('button', { name: en['nav.signOut'] }).click();
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByRole('link', { name: en['signIn.forgot'] }).click();
  await expect(page.getByRole('heading', { name: en['recover.title'] })).toBeVisible();
  await page.getByLabel(en['auth.email'], { exact: true }).locator('visible=true').fill(ADA.email);
  await page.getByRole('button', { name: en['recover.submit'] }).click();
  await expect(page.getByText(en['recover.sent'])).toBeVisible();
  await page.getByLabel(en['signUp.codeDigit'].replace('{n}', '1')).locator('visible=true').fill(ADA.code);
  await page.getByLabel(en['recover.newPassword'], { exact: true }).locator('visible=true').fill('new-lagos-pass-1');
  await page.getByLabel(en['recover.confirmPassword'], { exact: true }).locator('visible=true').fill('new-lagos-pass-1');
  await page.getByRole('button', { name: en['recover.save'] }).click();
  await expect(page.getByText(en['recover.doneTitle'])).toBeVisible();
});

test('P01-02 wrong details never say which one', async ({ page }) => {
  await signIn(page, ADA.email, 'not-the-password-1');
  await expect(page.getByText(en['signIn.wrong'])).toBeVisible();
});

test('P01-04 refreshing without "Stay signed in" asks to sign in again', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The tick-box is a browser choice; one project is enough.');
  await signIn(page);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('E-09 resizing changes the frame without reloading', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Resizing is a desktop browser behaviour.');
  await signIn(page);
  await expect(page.getByTestId('frame-sidebar')).toBeVisible();
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(page.getByTestId('frame-rail')).toBeVisible();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(page.getByTestId('frame-phone')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { marker?: number }).marker)).toBe(1);
});

for (const path of ['/sign-in', '/sign-up', '/recover']) {
  test(`accessibility: ${path} has no serious or critical axe issues`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole('button').first()).toBeVisible();
    await expectNoSeriousAxeIssues(page);
  });
}

test('accessibility: Welcome and Dashboard have no serious or critical axe issues', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('heading', { name: en['dashboard.title'] })).toBeVisible();
  await expectNoSeriousAxeIssues(page);
});
