import type { IncomeDeduction, IncomeStream } from '@/data/workspace/model';

/** Resolve a deduction amount from fixed minor or % of gross. */
export function deductionAmount(d: IncomeDeduction, gross: bigint): bigint {
  if (d.amountMinor) return BigInt(d.amountMinor);
  if (d.percent) return (gross * BigInt(Math.round(d.percent * 100))) / 10_000n;
  return 0n;
}

/**
 * E24 / case 18 parts from a gross stream. Returns null when pension/NHF accounts are missing
 * or parts don't leave a positive take-home.
 */
export function grossSplitParts(stream: Pick<IncomeStream, 'recordMode' | 'grossMinor' | 'deductions' | 'expectedMinor'>): {
  gross: bigint;
  takeHome: bigint;
  paye: bigint;
  pension: bigint;
  nhf: bigint;
  pensionAccountId: string;
  nhfAccountId: string;
} | null {
  if (stream.recordMode !== 'gross' || !stream.grossMinor) return null;
  const gross = BigInt(stream.grossMinor);
  if (gross <= 0n) return null;
  const deductions = stream.deductions ?? [];
  const payeRow = deductions.find((d) => d.kind === 'paye');
  const pensionRow = deductions.find((d) => d.kind === 'pension');
  const nhfRow = deductions.find((d) => d.kind === 'nhf');
  const paye = payeRow ? deductionAmount(payeRow, gross) : 0n;
  const pension = pensionRow ? deductionAmount(pensionRow, gross) : 0n;
  const nhf = nhfRow ? deductionAmount(nhfRow, gross) : 0n;
  const pensionAccountId = pensionRow?.targetAccountId;
  const nhfAccountId = nhfRow?.targetAccountId;
  if (!pensionAccountId || !nhfAccountId) return null;
  const takeHome = gross - paye - pension - nhf;
  if (takeHome <= 0n) return null;
  return { gross, takeHome, paye, pension, nhf, pensionAccountId, nhfAccountId };
}
