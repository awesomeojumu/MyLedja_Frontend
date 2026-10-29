import { pathHighlightKeys } from '../Sankey';

const sources = ['income:salary', 'in:borrowed'];
const sinks = ['group:group.food', 'left_over'];

describe('D22-20 whole-path highlight', () => {
  it('lights nothing when nothing is active', () => {
    expect(pathHighlightKeys(null, sources, sinks)).toBeNull();
  });

  it('hovering a sink lights every source, middle, and that sink', () => {
    const lit = pathHighlightKeys('group:group.food', sources, sinks)!;
    expect([...lit].sort()).toEqual(['group:group.food', 'in:borrowed', 'income:salary', 'middle'].sort());
    expect(lit.has('left_over')).toBe(false);
  });

  it('hovering a source lights that source, middle, and every sink', () => {
    const lit = pathHighlightKeys('income:salary', sources, sinks)!;
    expect([...lit].sort()).toEqual(['group:group.food', 'income:salary', 'left_over', 'middle'].sort());
    expect(lit.has('in:borrowed')).toBe(false);
  });
});
