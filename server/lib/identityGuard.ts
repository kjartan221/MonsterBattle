export class IdentityMismatchError extends Error {
  constructor(message = 'Identity key does not match the authenticated user') {
    super(message);
    this.name = 'IdentityMismatchError';
  }
}

/** No-op when the claimed key is absent or equals userId; throws otherwise. */
export function assertOwnIdentityKey(claimed: string | undefined | null, userId: string): void {
  if (claimed != null && claimed !== userId) {
    throw new IdentityMismatchError();
  }
}
