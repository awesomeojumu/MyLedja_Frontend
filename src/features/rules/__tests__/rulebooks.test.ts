import { buildRulebookRule, resolveBucketCategories, RULEBOOK_TEMPLATES } from '../rulebooks';
import type { Category } from '@/data/workspace/model';
import type { Snapshot } from '@/data/workspace/repository';

describe('Personal Rulebooks & Inflow Earmarking', () => {
  const categories: Category[] = [
    { id: 'cat-groceries', name: 'Groceries & Food', kind: 'expense' },
    { id: 'cat-invest', name: 'Investments', kind: 'expense' },
    { id: 'cat-family', name: 'Family Support', kind: 'expense' },
    { id: 'cat-tithe', name: 'Tithe & Charity', kind: 'expense' },
  ] as unknown as Category[];

  it('provides curated templates: Nigerian Balanced, 50/30/20, and 70/20/10', () => {
    expect(RULEBOOK_TEMPLATES.length).toBe(3);
    const nigerian = RULEBOOK_TEMPLATES.find((t) => t.id === 'nigerian_balanced')!;
    expect(nigerian.splits.reduce((s, p) => s + p.pct, 0)).toBe(100);

    const rule503020 = RULEBOOK_TEMPLATES.find((t) => t.id === '50_30_20')!;
    expect(rule503020.splits.reduce((s, p) => s + p.pct, 0)).toBe(100);
  });

  it('resolves bucket categories against user workspace categories', () => {
    const nigerian = RULEBOOK_TEMPLATES.find((t) => t.id === 'nigerian_balanced')!;
    const resolved = resolveBucketCategories(nigerian.splits, categories);
    expect(resolved).toHaveLength(4);
    expect(resolved.find((r) => r.bucketKey === 'living')?.categoryId).toBe('cat-groceries');
    expect(resolved.find((r) => r.bucketKey === 'investment')?.categoryId).toBe('cat-invest');
    expect(resolved.find((r) => r.bucketKey === 'family')?.categoryId).toBe('cat-family');
    expect(resolved.find((r) => r.bucketKey === 'faith')?.categoryId).toBe('cat-tithe');
  });

  it('builds a split rule from template for income inflows', () => {
    const mockSnapshot = {
      categories,
    } as unknown as Snapshot;

    const nigerian = RULEBOOK_TEMPLATES.find((t) => t.id === 'nigerian_balanced')!;
    const ruleDraft = buildRulebookRule(nigerian, mockSnapshot);

    expect(ruleDraft.stage).toBe('first');
    expect(ruleDraft.conditions[0]?.field).toBe('money');
    expect(ruleDraft.conditions[0]?.op).toBe('isIn');
    expect(ruleDraft.conditions[0]?.value).toBe('in');
    expect(ruleDraft.actions[0]?.kind).toBe('split');
    expect(ruleDraft.actions[0]?.value).toContain('pct:');
    expect(ruleDraft.actions[0]?.value).toContain('cat-groceries=60');
    expect(ruleDraft.actions[0]?.value).toContain('cat-invest=20');
  });
});
