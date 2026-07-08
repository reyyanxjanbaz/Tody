import { describe, expect, it } from 'vitest';
import { quorumParticipants, pactProgress, myParticipation, type Pact, type PactParticipant } from '../../src/features/pacts/types';

function participant(user_id: string, state: PactParticipant['state']): PactParticipant {
  return { user_id, state, done_at: null, display_name: user_id, avatar_url: null };
}

function pact(participants: PactParticipant[]): Pact {
  return {
    id: 'p', creator_id: 'a', title: 'Ship it', description: '', deadline: null,
    status: 'active', completed_at: null, created_at: '', updated_at: '', participants,
  };
}

/** Phase E — the quorum/progress math that decides how a pact renders and when
 *  it should complete. Declined/left members must NOT count toward the total. */
describe('Phase E — pact quorum + progress', () => {
  it('excludes declined and left participants from the quorum', () => {
    const p = pact([
      participant('a', 'done'),
      participant('b', 'accepted'),
      participant('c', 'declined'),
      participant('d', 'left'),
    ]);
    expect(quorumParticipants(p).map((x) => x.user_id)).toEqual(['a', 'b']);
  });

  it('progress is [done, quorum-total]', () => {
    expect(pactProgress(pact([
      participant('a', 'done'),
      participant('b', 'done'),
      participant('c', 'accepted'),
    ]))).toEqual([2, 3]);

    // Declined member shrinks the denominator.
    expect(pactProgress(pact([
      participant('a', 'done'),
      participant('b', 'declined'),
    ]))).toEqual([1, 1]);
  });

  it('is fully done only when every quorum member is done', () => {
    const almost = pact([participant('a', 'done'), participant('b', 'accepted')]);
    const [d1, t1] = pactProgress(almost);
    expect(d1 === t1).toBe(false);

    const complete = pact([participant('a', 'done'), participant('b', 'done'), participant('c', 'declined')]);
    const [d2, t2] = pactProgress(complete);
    expect(d2 === t2).toBe(true);
  });

  it('finds my participation row (and nothing for a non-participant)', () => {
    const p = pact([participant('a', 'accepted'), participant('b', 'done')]);
    expect(myParticipation(p, 'b')?.state).toBe('done');
    expect(myParticipation(p, 'zzz')).toBeUndefined();
    expect(myParticipation(p, undefined)).toBeUndefined();
  });
});
