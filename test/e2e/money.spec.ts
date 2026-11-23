import { expect, test } from '@playwright/test';
import { addWelcomeAccount, en, fieldAfter, naira, next, signUp, stepHeader } from './helpers';

test('Welcome sets up the budget, bills, debts and goals; spending and saving each move money once', async ({ page, isMobile }) => {
  test.setTimeout(150_000);
  await signUp(page, `plan-${isMobile ? 'phone' : 'desktop'}@example.test`);

  // 1. Your space
  await next(page);

  // 2. Your money: ₦300,000 everyday, ₦100,000 emergency fund.
  await expect(page.getByText(stepHeader(2, 'wiz.step.money'))).toBeVisible();
  await addWelcomeAccount(page, 'wiz.money.quick.operating', 'GTBank Current', '300000');
  await addWelcomeAccount(page, 'wiz.money.quick.emergency', 'Rainy day', '100000');
  await expect(page.getByText(en['wiz.money.total'].replace('{amount}', naira(400000)))).toBeVisible();
  await next(page);

  // 3. Income: ₦500,000 take-home.
  await expect(page.getByText(stepHeader(3, 'wiz.step.income'))).toBeVisible();
  await fieldAfter(page, en['wiz.budget.takeHome']).fill('500000');
  await next(page);

  // 4. Budget structure: 50/30/20 in naira.
  await expect(page.getByText(stepHeader(4, 'wiz.step.structure'))).toBeVisible();
  await expect(page.getByText(naira(250000)).first()).toBeVisible();
  await expect(page.getByText(naira(150000)).first()).toBeVisible();
  await expect(page.getByText(naira(100000)).first()).toBeVisible();
  await next(page);

  // 5. Bills: rent ₦150,000, and a ₦200,000 loan repaid ₦25,000 a month.
  await page.getByText(en['wiz.bills.preset.rent'], { exact: true }).click();
  await fieldAfter(page, en['wiz.bills.amount']).fill('150000');
  await page.getByText(en['wiz.debts.add'], { exact: true }).click();
  await page.getByPlaceholder(en['wiz.debts.namePlaceholder']).fill('FairMoney loan');
  await fieldAfter(page, en['wiz.debts.amount']).fill('200000');
  await fieldAfter(page, en['wiz.debts.monthly']).fill('25000');
  await next(page);

  // 6. A laptop goal, kept in the emergency account.
  await page.getByText(en['wiz.goals.addSavings'], { exact: true }).click();
  await page.getByPlaceholder(en['wiz.goals.namePlaceholder']).fill('New laptop');
  await fieldAfter(page, en['wiz.goals.target']).fill('600000');
  await next(page);

  // 7. Categories, as suggested.
  await expect(page.getByText(stepHeader(7, 'wiz.step.categories'))).toBeVisible();
  await next(page);

  // 8. Review: bills include the repayment.
  await expect(page.getByText(stepHeader(8, 'wiz.step.review'))).toBeVisible();
  await expect(page.getByText(en['wiz.review.billsLine'].replace('{n}', '1').replace('{amount}', naira(175000)))).toBeVisible();
  await page.getByText(en['wiz.finish'], { exact: true }).click();
  await expect(page).toHaveURL(/\/$/);

  // Net worth: ₦400,000 in accounts less the ₦200,000 loan.
  await expect(page.getByText(naira(200000)).first()).toBeVisible();

  // Bills and goals came through setup.
  await page.goto('/plan');
  await expect(page.getByText('Rent', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('FairMoney loan', { exact: true }).first()).toBeVisible();
  await page.goto('/goals');
  await expect(page.getByText('New laptop', { exact: true }).first()).toBeVisible();

  // A ₦5,000 Food expense is spending.
  await page.goto('/');
  await page.getByText(en['ui.quickActionTrio.addExpense'], { exact: true }).first().click();
  await page.getByRole('dialog').locator('input').first().fill('5000');
  await page.getByText(en['quick.chooseCategory'], { exact: true }).click();
  await page.getByText('Food', { exact: true }).first().click();
  await page.getByText(en['quick.save'], { exact: true }).click();
  await expect(page.getByText(en['quick.savedExpense'])).toBeVisible();
  await expect(page.getByText(naira(195000)).first()).toBeVisible();

  // ₦20,000 into the goal moves money between accounts: net worth and spending don't change.
  await page.getByText(en['ui.quickActionTrio.addExpense'], { exact: true }).first().click();
  await page.getByRole('dialog').locator('input').first().fill('20000');
  await page.getByText(en['quick.chooseCategory'], { exact: true }).click();
  await page.getByText(en['quick.optionSave'], { exact: true }).click();
  await page.getByText(en['quick.chooseTarget'], { exact: true }).click();
  await page.getByText(en['quick.targetGoal'].replace('{name}', 'New laptop'), { exact: true }).click();
  await page.getByText(en['quick.save'], { exact: true }).click();
  await expect(page.getByText(en['quick.savedGoal'].replace('{name}', 'New laptop'))).toBeVisible();
  await expect(page.getByText(naira(195000)).first()).toBeVisible();
  await expect(page.getByText(naira(5000)).first()).toBeVisible();
});
