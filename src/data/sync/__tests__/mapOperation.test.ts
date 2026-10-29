import type { Account } from '@/data/workspace/model';

import { fromBackendChange, fromBackendResult, toBackendOperation } from '../mapOperation';
import type { Operation } from '../types';

const bank: Account = {
  id: 'acc-bank',
  name: 'GTBank',
  type: 'bank',
  currency: 'NGN',
  countInBudget: true,
  archived: false,
  order: 0,
};

function op(partial: Partial<Operation> & Pick<Operation, 'type' | 'payload'>): Operation {
  return {
    operationId: 'op1',
    createdAt: '2026-10-28T12:00:00.000Z',
    schemaVersion: 1,
    deviceId: 'dev',
    ...partial,
  };
}

describe('mapOperation', () => {
  it('includes aliases on payee.create and payee.update', () => {
    expect(
      toBackendOperation(
        op({
          type: 'payee.create',
          payload: {
            collection: 'payees',
            id: 'p1',
            data: { name: 'Shoprite', aliases: ['POS SHOPRITE'], defaultCategoryId: null },
          },
        }),
        [bank],
      ),
    ).toMatchObject({
      type: 'payee.create',
      payload: { id: 'p1', name: 'Shoprite', aliases: ['POS SHOPRITE'] },
    });
    expect(
      toBackendOperation(
        op({
          type: 'payee.update',
          baseVersion: 2,
          payload: {
            collection: 'payees',
            id: 'p1',
            data: { name: 'Shoprite', aliases: ['POS'], defaultCategoryId: 'c1' },
          },
        }),
        [bank],
      ),
    ).toMatchObject({
      type: 'payee.update',
      targetId: 'p1',
      payload: { baseVersion: 2, name: 'Shoprite', aliases: ['POS'], defaultCategoryId: 'c1' },
    });
  });

  it('maps a local expense event to transaction.create', () => {
    const mapped = toBackendOperation(
      op({
        type: 'event.expense',
        payload: {
          collection: 'events',
          id: 'evt1',
          data: {
            type: 'expense',
            date: '2026-10-28',
            lines: [
              { a: 'acc-bank', m: '-1845000', c: 'NGN' },
              { a: 'cat-food', m: '1845000', c: 'NGN' },
            ],
          },
        },
      }),
      [bank],
    );
    expect(mapped).toMatchObject({
      type: 'transaction.create',
      payload: {
        type: 'expense',
        accountId: 'acc-bank',
        categoryId: 'cat-food',
        amount: '1845000',
        date: '2026-10-28',
      },
    });
  });

  it('maps backend conflict and change shapes', () => {
    expect(
      fromBackendResult({
        operationId: 'op1',
        status: 'conflict',
        result: null,
        current: { id: 'evt1', version: 3, amount: '1' },
        error: { message: 'already changed' },
      }, 'transaction.correct', 'ws'),
    ).toMatchObject({
      status: 'conflict',
      record: { id: 'evt1', version: 3 },
    });
    expect(
      fromBackendChange({
        seq: '12',
        collection: 'transactions',
        id: 'evt1',
        op: 'upsert',
        doc: { id: 'evt1', type: 'expense' },
      }, 'ws'),
    ).toMatchObject({
      seq: 12,
      op: 'upsert',
      record: { collection: 'events', id: 'evt1' },
    });
  });
});
