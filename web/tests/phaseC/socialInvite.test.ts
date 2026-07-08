import { describe, expect, it, beforeEach } from 'vitest';
import { setPendingInvite, takePendingInvite } from '../../src/features/social/SocialContext';

/** Phase C — the pending-invite spine: a code captured while logged out must
 *  survive to first login exactly once, then be consumed. */
describe('Phase C — pending invite redemption', () => {
  beforeEach(() => localStorage.clear());

  it('stores and takes a pending code exactly once', () => {
    expect(takePendingInvite()).toBeNull();
    setPendingInvite('abc123');
    expect(takePendingInvite()).toBe('abc123');
    // Second take is empty — consumed, so it can't be redeemed twice.
    expect(takePendingInvite()).toBeNull();
  });

  it('overwrites an older pending code with the newest one', () => {
    setPendingInvite('first');
    setPendingInvite('second');
    expect(takePendingInvite()).toBe('second');
  });
});
