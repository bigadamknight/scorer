export type Team = 'home' | 'away';

export type EventType =
  | 'goal'
  | 'centre_pass'
  | 'period'
  | 'clock'
  | 'shot'
  | 'cp_result'
  | 'gain'
  | 'turnover'
  | 'penalty'
  | 'undo';

export interface MatchEvent {
  seq: number;
  clientId: string | null;
  ts: string;
  device: string;
  type: EventType;
  payload: Record<string, unknown>;
  pending?: boolean;
}

export interface MatchConfig {
  venue: string;
  competition: string;
  home: string;
  away: string;
  umpire1: string;
  umpire2: string;
  periods: number;
  periodMinutes: number;
  firstCentrePass: Team;
  shooters: { home: string[]; away: string[] };
}

export interface MatchSummary {
  id: string;
  createdAt: string;
  status: 'active' | 'completed';
  config: MatchConfig;
  seq: number;
}

export interface Match extends MatchSummary {
  events: MatchEvent[];
}

export const TURNOVER_REASONS = [
  'Bad pass',
  'Held ball',
  'Footwork',
  'Offside',
  'Contact',
  'Obstruction',
  'Intercepted',
  'Break',
] as const;

export const PENALTY_KINDS = ['Contact', 'Obstruction', 'Footwork', 'Offside'] as const;
