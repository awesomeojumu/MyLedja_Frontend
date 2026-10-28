import { v7 as uuidv7 } from 'uuid';

import { buildReversal, type Chart } from './builders';
import { checkEvent } from './checks';
import { fail, ok, type LedgerResult, type MoneyEvent } from './types';

export type PostOutcome = { status: 'applied' | 'duplicate'; event: MoneyEvent };

export type NewEvent = Omit<MoneyEvent, 'id' | 'status'> & { id?: string };

/**
 * The app's own copy of posted events. It runs the same checks as the server so the
 * screen can show a saved change at once; server results replace it on sync.
 */
export class Journal {
  private readonly events = new Map<string, MoneyEvent>();
  private readonly byOperation = new Map<string, string>();

  constructor(
    private readonly chart: Chart,
    initial: MoneyEvent[] = [],
    private readonly newId: () => string = uuidv7,
  ) {
    for (const e of initial) this.remember(e);
  }

  list(): MoneyEvent[] {
    return [...this.events.values()];
  }

  get(id: string): MoneyEvent | undefined {
    return this.events.get(id);
  }

  post(input: NewEvent): LedgerResult<PostOutcome> {
    const seen = this.byOperation.get(input.operationId);
    if (seen) return ok({ status: 'duplicate', event: this.events.get(seen)! });
    const event: MoneyEvent = { ...input, id: input.id ?? this.newId(), status: 'posted' };
    const checked = checkEvent(this.chart, event, this.events);
    if (!checked.ok) return checked;
    this.remember(event);
    if (event.type === 'reversal' && event.reversalOf) {
      const original = this.events.get(event.reversalOf)!;
      this.events.set(original.id, { ...original, status: 'reversed', reversedBy: event.id });
    }
    return ok({ status: 'applied', event });
  }

  /** "Delete": a reversal only (TECH-SPEC 6.3). */
  reverse(id: string, operationId: string, date: string): LedgerResult<PostOutcome> {
    const original = this.events.get(id);
    if (!original) return fail('missing_lines');
    return this.post({ operationId, type: 'reversal', date, lines: buildReversal(original), reversalOf: id });
  }

  /** "Edit" of a money field: a reversal plus the corrected event, both or neither. */
  correct(id: string, reversalOperationId: string, replacement: NewEvent): LedgerResult<{ reversal: MoneyEvent; event: MoneyEvent }> {
    const original = this.events.get(id);
    if (!original) return fail('missing_lines');
    if (original.status === 'reversed') return fail('already_reversed');
    const draft: MoneyEvent = { ...replacement, id: replacement.id ?? this.newId(), status: 'posted' };
    const checked = checkEvent(this.chart, draft, this.events);
    if (!checked.ok) return checked;
    const reversal = this.reverse(id, reversalOperationId, replacement.date);
    if (!reversal.ok) return reversal;
    const posted = this.post(draft);
    if (!posted.ok) return posted;
    return ok({ reversal: reversal.value.event, event: posted.value.event });
  }

  private remember(event: MoneyEvent) {
    this.events.set(event.id, event);
    this.byOperation.set(event.operationId, event.id);
  }
}
