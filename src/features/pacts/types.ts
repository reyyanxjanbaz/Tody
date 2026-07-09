/** Pacts (Phase E) — web-only feature types. */

export type PactStatus = 'active' | 'completed' | 'expired' | 'cancelled';
export type PactParticipantState = 'invited' | 'accepted' | 'done' | 'declined' | 'left';

export interface PactParticipant {
  user_id: string;
  state: PactParticipantState;
  done_at: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

export interface Pact {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  deadline: string | null;
  status: PactStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  participants: PactParticipant[];
  invite_code?: string | null;
}

/** Participants that count toward the quorum (excludes declined/left). */
export function quorumParticipants(p: Pact): PactParticipant[] {
  return p.participants.filter((x) => x.state !== 'declined' && x.state !== 'left');
}

/** Progress as [done, total] over the quorum. */
export function pactProgress(p: Pact): [number, number] {
  const q = quorumParticipants(p);
  return [q.filter((x) => x.state === 'done').length, q.length];
}

/** This user's participant row, if any. */
export function myParticipation(p: Pact, userId: string | undefined): PactParticipant | undefined {
  return userId ? p.participants.find((x) => x.user_id === userId) : undefined;
}
