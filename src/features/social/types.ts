/** Social (Phase C) — web-only feature types. */

export interface Friend {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  weekly_xp: number;
  tasks_completed: number;
  is_self: boolean;
  rank: number;
}

export type InviteKind = 'friend' | 'workspace' | 'pact';

export interface InviteResult {
  code: string;
  kind: InviteKind;
  url: string;
}
