import { describe, it, expect } from 'vitest';
import {
  classifyDesignation,
  injuryDesignation,
  injuryTooltip,
  type InjuryLike,
} from './injury';

const like = (over: Partial<InjuryLike>): InjuryLike => ({
  status: 'out',
  fantasyStatus: null,
  detail: null,
  returnDate: null,
  ...over,
});

describe('classifyDesignation', () => {
  it('reads the fine fantasyStatus first', () => {
    expect(
      classifyDesignation(
        like({ status: 'questionable', fantasyStatus: 'Game Time Decision' }),
      ),
    ).toBe('gtd');
    expect(classifyDesignation(like({ status: 'out', fantasyStatus: 'Probable' }))).toBe(
      'probable',
    );
    expect(
      classifyDesignation(
        like({ status: 'questionable', fantasyStatus: 'Questionable' }),
      ),
    ).toBe('questionable');
    expect(
      classifyDesignation(like({ status: 'doubtful', fantasyStatus: 'Doubtful' })),
    ).toBe('doubtful');
  });

  it('separates IL / suspension / day-to-day from a flat Out', () => {
    expect(classifyDesignation(like({ fantasyStatus: '15-Day IL' }))).toBe('il');
    expect(classifyDesignation(like({ fantasyStatus: 'Suspension' }))).toBe('suspended');
    expect(classifyDesignation(like({ fantasyStatus: 'Day-To-Day' }))).toBe('day-to-day');
    expect(classifyDesignation(like({ fantasyStatus: 'Out' }))).toBe('out');
  });

  it('does not let the IL day-number check swallow Day-To-Day', () => {
    // "Day-To-Day" contains "day" but must not match the `\d+-day` IL heuristic.
    expect(
      classifyDesignation(like({ status: 'day-to-day', fantasyStatus: 'Day-To-Day' })),
    ).toBe('day-to-day');
  });

  it('falls back to the normalized bucket when fantasyStatus is missing (e.g. NFL)', () => {
    expect(
      classifyDesignation(like({ status: 'questionable', fantasyStatus: null })),
    ).toBe('questionable');
    expect(classifyDesignation(like({ status: 'doubtful', fantasyStatus: null }))).toBe(
      'doubtful',
    );
    expect(classifyDesignation(like({ status: 'out', fantasyStatus: null }))).toBe('out');
  });
});

describe('injuryDesignation', () => {
  it('maps to the expected abbreviations', () => {
    expect(injuryDesignation(like({ fantasyStatus: 'Game Time Decision' })).abbr).toBe(
      'GTD',
    );
    expect(injuryDesignation(like({ fantasyStatus: 'Probable' })).abbr).toBe('P');
    expect(
      injuryDesignation(like({ status: 'questionable', fantasyStatus: 'Questionable' }))
        .abbr,
    ).toBe('Q');
    expect(
      injuryDesignation(like({ status: 'doubtful', fantasyStatus: 'Doubtful' })).abbr,
    ).toBe('D');
    expect(injuryDesignation(like({ fantasyStatus: '15-Day IL' })).abbr).toBe('IL');
    expect(injuryDesignation(like({ fantasyStatus: 'Out' })).abbr).toBe('OUT');
  });
});

describe('injuryTooltip', () => {
  it('assembles label, injury, and expected return', () => {
    const tip = injuryTooltip(
      like({
        status: 'out',
        fantasyStatus: 'Out',
        detail: 'Right Ankle Sprain',
        returnDate: '2026-06-30',
      }),
    );
    expect(tip).toBe('Out · Right Ankle Sprain · Est. return Jun 30, 2026');
  });

  it('omits missing parts', () => {
    expect(
      injuryTooltip(like({ status: 'questionable', fantasyStatus: 'Questionable' })),
    ).toBe('Questionable');
  });
});
