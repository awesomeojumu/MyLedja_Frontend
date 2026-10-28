export type BudgetCategory = { ledgerAccountId: string; carryOver?: boolean };

export type BudgetInputs = {
  /** Months in order, with no gaps, "YYYY-MM". */
  months: string[];
  categories: BudgetCategory[];
  assigned: (ledgerAccountId: string, month: string) => bigint;
  activity: (ledgerAccountId: string, month: string) => bigint;
  budgetableIncome: (month: string) => bigint;
  goalAllocations?: (month: string) => bigint;
};

export type BudgetRow = { carried: bigint; assigned: bigint; activity: bigint; available: bigint };

export type BudgetMonth = {
  month: string;
  rows: Map<string, BudgetRow>;
  /** Envelope only. Negative means more was planned than you have. */
  leftToPlan: bigint;
  /** Overspending from the month before, taken from this month's "left to plan". */
  overspentFromLastMonth: bigint;
};

/** TECH-SPEC 6.6 "Every naira a job". */
export function envelopeBudget(input: BudgetInputs): BudgetMonth[] {
  const out: BudgetMonth[] = [];
  let carried = new Map<string, bigint>();
  let leftToPlan = 0n;
  let overspent = 0n;
  for (const month of input.months) {
    const rows = new Map<string, BudgetRow>();
    let totalAssigned = 0n;
    const nextCarried = new Map<string, bigint>();
    let nextOverspent = 0n;
    for (const c of input.categories) {
      const row = makeRow(carried.get(c.ledgerAccountId) ?? 0n, input.assigned(c.ledgerAccountId, month), input.activity(c.ledgerAccountId, month));
      rows.set(c.ledgerAccountId, row);
      totalAssigned += row.assigned;
      if (row.available >= 0n) nextCarried.set(c.ledgerAccountId, row.available);
      else nextOverspent += -row.available;
    }
    leftToPlan = input.budgetableIncome(month) + leftToPlan - totalAssigned - overspent - (input.goalAllocations?.(month) ?? 0n);
    out.push({ month, rows, leftToPlan, overspentFromLastMonth: overspent });
    carried = nextCarried;
    overspent = nextOverspent;
  }
  return out;
}

/** TECH-SPEC 6.6 "Spending limits": nothing carries over unless a category has carry-over on. */
export function trackingBudget(input: BudgetInputs): BudgetMonth[] {
  const out: BudgetMonth[] = [];
  let carried = new Map<string, bigint>();
  for (const month of input.months) {
    const rows = new Map<string, BudgetRow>();
    const nextCarried = new Map<string, bigint>();
    for (const c of input.categories) {
      const row = makeRow(c.carryOver ? (carried.get(c.ledgerAccountId) ?? 0n) : 0n, input.assigned(c.ledgerAccountId, month), input.activity(c.ledgerAccountId, month));
      rows.set(c.ledgerAccountId, row);
      if (c.carryOver && row.available > 0n) nextCarried.set(c.ledgerAccountId, row.available);
    }
    out.push({ month, rows, leftToPlan: 0n, overspentFromLastMonth: 0n });
    carried = nextCarried;
  }
  return out;
}

function makeRow(carried: bigint, assigned: bigint, activity: bigint): BudgetRow {
  return { carried, assigned, activity, available: carried + assigned - activity };
}

/** TECH-SPEC 6.7 "Left to spend": the sum of available across spending categories. */
export function leftToSpend(month: BudgetMonth): bigint {
  let sum = 0n;
  for (const row of month.rows.values()) sum += row.available;
  return sum;
}
