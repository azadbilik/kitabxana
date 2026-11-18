import { describe, expect, it } from 'vitest';
import { isGenericTitle } from './BookCover';

describe('isGenericTitle', () => {
  it('knows titles that name a kind of writing', () => {
    expect(isGenericTitle('Şeirlər')).toBe(true);
    expect(isGenericTitle(' qəzəllər ')).toBe(true);
    expect(isGenericTitle('Газели')).toBe(true);
  });
  it('leaves real titles alone', () => {
    expect(isGenericTitle('Leyli və Məcnun')).toBe(false);
    expect(isGenericTitle('Vətən')).toBe(false);
  });
});
