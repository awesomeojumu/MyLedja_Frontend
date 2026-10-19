/** Capital that left cash is not a loss. Only the gap vs what came back is profit or shortfall. */
export function splitInvestmentReturn(capital: number, received: number): {
  capitalReturned: number;
  profit: number;
  shortfall: number;
} {
  const safeCapital = Number.isFinite(capital) && capital > 0 ? capital : 0;
  const safeReceived = Number.isFinite(received) && received > 0 ? received : 0;
  return {
    capitalReturned: Math.min(safeReceived, safeCapital),
    profit: Math.max(safeReceived - safeCapital, 0),
    shortfall: Math.max(safeCapital - safeReceived, 0),
  };
}

export function splitCopy(split: { capitalReturned: number; profit: number; shortfall: number }): string {
  if (split.profit > 0) return `Capital back ₦${split.capitalReturned.toFixed(2)}. Profit ₦${split.profit.toFixed(2)}.`;
  if (split.shortfall > 0) return `Returned ₦${split.capitalReturned.toFixed(2)}. Shortfall ₦${split.shortfall.toFixed(2)}.`;
  return `Capital back ₦${split.capitalReturned.toFixed(2)}.`;
}
