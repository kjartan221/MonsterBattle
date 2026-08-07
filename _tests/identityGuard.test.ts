import { assertOwnIdentityKey, IdentityMismatchError } from '@server/lib/identityGuard';

describe('assertOwnIdentityKey', () => {
  it('throws IdentityMismatchError when a claimed key differs from userId', () => {
    expect(() => assertOwnIdentityKey('02aaa', '02bbb')).toThrow(IdentityMismatchError);
  });
  it('is a no-op when the keys match', () => {
    expect(() => assertOwnIdentityKey('02aaa', '02aaa')).not.toThrow();
  });
  it('is a no-op when no key is claimed (null/undefined)', () => {
    expect(() => assertOwnIdentityKey(undefined, '02aaa')).not.toThrow();
    expect(() => assertOwnIdentityKey(null, '02aaa')).not.toThrow();
  });
});
