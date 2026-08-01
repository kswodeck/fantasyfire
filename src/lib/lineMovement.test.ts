import { describe, it, expect } from 'vitest';
import { lineMovement, lineForKind, movementLabel } from './lineMovement';
import type { ProvidedVariant } from './types';

function rung(line: number, oddsType: string | null = 'standard'): ProvidedVariant {
  return { source: 'prizepicks', line, oddsType, multiplier: null, overOdds: null, underOdds: null };
}

describe('lineForKind', () => {
  it('picks the median line of the requested kind only', () => {
    const ladder = [rung(1.5), rung(2.5), rung(0.5, 'goblin'), rung(3.5, 'demon')];
    expect(lineForKind(ladder, 'normal')).toBe(2);
    expect(lineForKind(ladder, 'goblin')).toBe(0.5);
    expect(lineForKind(ladder, 'demon')).toBe(3.5);
  });

  it('returns null when the kind is absent', () => {
    expect(lineForKind([rung(1.5)], 'demon')).toBeNull();
  });
});

describe('lineMovement', () => {
  it('says nothing when the line is unchanged', () => {
    expect(lineMovement({ line: 1.5, side: 'over' }, [rung(1.5)])).toBeNull();
  });

  it('says nothing when the ladder is empty (feature off / no lines yet)', () => {
    // An empty ladder is not evidence the book pulled the prop — never cry wolf.
    expect(lineMovement({ line: 1.5, side: 'over' }, [])).toBeNull();
  });

  it('flags an over as unfavorable when the number goes up', () => {
    const m = lineMovement({ line: 1.5, side: 'over' }, [rung(2.5)]);
    expect(m).toMatchObject({ status: 'moved', currentLine: 2.5, delta: 1, favorable: false });
  });

  it('flags an over as favorable when the number comes down', () => {
    const m = lineMovement({ line: 2.5, side: 'over' }, [rung(1.5)]);
    expect(m).toMatchObject({ delta: -1, favorable: true });
  });

  it('inverts the verdict for an under', () => {
    expect(lineMovement({ line: 1.5, side: 'under' }, [rung(2.5)])?.favorable).toBe(true);
    expect(lineMovement({ line: 2.5, side: 'under' }, [rung(1.5)])?.favorable).toBe(false);
  });

  it('compares a goblin save against today’s goblin, not the standard line', () => {
    // The standard rung moved to 2.5 but the goblin the user saved is unchanged.
    const ladder = [rung(2.5, 'standard'), rung(0.5, 'goblin')];
    expect(lineMovement({ line: 0.5, side: 'over', oddsType: 'goblin' }, ladder)).toBeNull();
    // …and a goblin that DID move is reported against the goblin rung.
    const moved = [rung(2.5, 'standard'), rung(1.5, 'goblin')];
    expect(lineMovement({ line: 0.5, side: 'over', oddsType: 'goblin' }, moved)).toMatchObject({
      currentLine: 1.5,
      favorable: false,
    });
  });

  it('reports unlisted when the ladder exists but lost that rung kind', () => {
    const m = lineMovement({ line: 3.5, side: 'over', oddsType: 'demon' }, [rung(1.5)]);
    expect(m).toMatchObject({ status: 'unlisted', currentLine: null });
    expect(movementLabel(m!)).toBe('no longer listed');
  });

  it('formats a move as saved → current', () => {
    expect(movementLabel(lineMovement({ line: 1.5, side: 'over' }, [rung(2.5)])!)).toBe('1.5 → 2.5');
  });
});
