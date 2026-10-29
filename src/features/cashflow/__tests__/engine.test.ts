import { cashFlow, type Fact, type Lookup } from '../engine';

const look: Lookup = {
  kindOf: (id) => {
    if (id.startsWith('inc:')) return 'income';
    if (id.startsWith('exp:')) return 'expense';
    if (id.startsWith('liab:')) return 'liability';
    if (id.startsWith('hold:')) return 'asset';
    return 'asset';
  },
  categoryOf: (id) => (id.startsWith('inc:') || id.startsWith('exp:') ? id.slice(4) : null),
  groupOf: (c) => (c === 'market' ? 'group.food' : null),
  isCash: (id) => !id.startsWith('hold:') && !id.startsWith('liab:'),
};

function fact(partial: Partial<Fact> & Pick<Fact, 'eventId' | 'ledgerAccountId' | 'amount' | 'type'>): Fact {
  return {
    date: '2026-09-10',
    payeeId: null,
    tagIds: [],
    accountIds: ['bank'],
    ...partial,
  };
}

describe('cashFlow engine (B5.3 / §9.2)', () => {
  it('income bands add up to income and spending to spent; left over is the rest', () => {
    const facts: Fact[] = [
      fact({ eventId: '1', type: 'income', ledgerAccountId: 'inc:salary', amount: -200_000_000n, accountIds: ['bank'] }),
      fact({ eventId: '1', type: 'income', ledgerAccountId: 'bank', amount: 200_000_000n, accountIds: ['bank'] }),
      fact({ eventId: '2', type: 'expense', ledgerAccountId: 'exp:market', amount: 50_000_000n, accountIds: ['bank'] }),
      fact({ eventId: '2', type: 'expense', ledgerAccountId: 'bank', amount: -50_000_000n, accountIds: ['bank'] }),
    ];
    const bands = cashFlow(facts, look, { goalAllocations: 0n, includeTransfers: false });
    const sum = (kind: string) => bands.filter((b) => b.kind === kind).reduce((s, b) => s + b.amount, 0n);
    expect(sum('income')).toBe(200_000_000n);
    expect(sum('spending')).toBe(50_000_000n);
    expect(sum('left_over')).toBe(150_000_000n);
  });

  it('borrowed money is a grey source, never income', () => {
    const facts: Fact[] = [
      fact({ eventId: '1', type: 'income', ledgerAccountId: 'inc:salary', amount: -40_000_000n }),
      fact({ eventId: '1', type: 'income', ledgerAccountId: 'bank', amount: 40_000_000n }),
      fact({ eventId: '2', type: 'loan_proceeds', ledgerAccountId: 'liab:loan', amount: -100_000_000n }),
      fact({ eventId: '2', type: 'loan_proceeds', ledgerAccountId: 'bank', amount: 100_000_000n }),
    ];
    const bands = cashFlow(facts, look, { goalAllocations: 0n, includeTransfers: false });
    expect(bands.find((b) => b.kind === 'borrowed')?.amount).toBe(100_000_000n);
    expect(bands.filter((b) => b.kind === 'income').reduce((s, b) => s + b.amount, 0n)).toBe(40_000_000n);
  });

  it('transfers appear only when includeTransfers is on', () => {
    const facts: Fact[] = [
      fact({ eventId: '1', type: 'transfer', ledgerAccountId: 'bank', amount: -10_000_000n, accountIds: ['bank', 'wallet'] }),
      fact({ eventId: '1', type: 'transfer', ledgerAccountId: 'wallet', amount: 10_000_000n, accountIds: ['bank', 'wallet'] }),
    ];
    const off = cashFlow(facts, look, { goalAllocations: 0n, includeTransfers: false });
    const on = cashFlow(facts, look, { goalAllocations: 0n, includeTransfers: true });
    expect(off.some((b) => b.kind === 'transfers')).toBe(false);
    expect(on.filter((b) => b.kind === 'transfers').map((b) => [b.side, b.amount])).toEqual([
      ['in', 10_000_000n],
      ['out', 10_000_000n],
    ]);
  });

});
