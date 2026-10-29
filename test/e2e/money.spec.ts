import { expect, test, type Page } from '@playwright/test';

import { en, expectNoSeriousAxeIssues, signUpAndSetUp } from './helpers';

async function addAccount(page: Page, name: string, opening: string, isMobile: boolean) {
  // On a phone the mock-only Developer panel sits over the bottom bar, so go through the drawer.
  if (isMobile) {
    await page.getByRole('button', { name: en['nav.menu'] }).click();
    await page.getByRole('dialog').getByRole('link', { name: en['nav.accounts'], exact: true }).click();
  } else await page.getByRole('link', { name: en['nav.accounts'], exact: true }).locator('visible=true').first().click();
  await expect(page).toHaveURL(/\/accounts$/);
  await page.getByTestId('accounts-add').click();
  // PU-13 is two steps: pick kind, then name/opening (type grid covers Continue otherwise).
  await page.getByTestId('type-bank').click();
  await page.getByTestId('account-name').fill(name);
  await page.getByTestId('account-opening').fill(opening);
  await page.getByTestId('save-account').click();
  await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
}

test('P09-01, P09-02, P09-04: an account page, a CSV import and its Undo', async ({ page, isMobile }) => {
  test.setTimeout(90_000);
  await signUpAndSetUp(page, `import-${isMobile ? 'phone' : 'desktop'}@example.test`);
  await addAccount(page, 'Zenith Current', '1000', isMobile);
  await page.getByRole('link', { name: /Zenith Current/ }).click();
  await expect(page).toHaveURL(/\/accounts\/[\w-]+$/);
  await expect(page.getByTestId('account-balance')).toHaveText('₦1,000.00');
  await expectNoSeriousAxeIssues(page);

  await page.getByTestId('account-import').click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: en['import.choose'] }).click();
  await (
    await chooser
  ).setFiles({
    name: 'statement.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Date,Narration,Amount\n02/10/2026,Shoprite Lekki,-184.50\n05/10/2026,Acme salary,640\n'),
  });
  await expect(page.getByTestId('import-preview')).toContainText('Shoprite Lekki');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectNoSeriousAxeIssues(page);
  await page.getByTestId('import-next').click();
  await page.getByTestId('import-post').click();
  await expect(page.getByTestId('account-balance')).toHaveText('₦1,455.50');
  // Toast Undo — prefer over any leftover import-sheet undo control.
  await page.getByRole('button', { name: en['common.undo'] }).first().click();
  await expect(page.getByTestId('account-balance')).toHaveText('₦1,000.00');
});
