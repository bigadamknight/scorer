export type EventSource = {
  deviceId: string;
  scorerId?: string;
  platform?: 'mobile' | 'web' | 'desktop';
};

export type MatchEventBase<TType extends string, TPayload extends object = object> = {
  matchId: string;
  eventId: string;
  createdAt: string; // ISO timestamp
  source: EventSource;
  type: TType;
  payload: TPayload;
  sequence: number;
  matchVersion: number;
  metadata?: Record<string, unknown>;
};

export type MatchCreatedEvent = MatchEventBase<'match_created', {
  competitionId?: string;
  templateId: string;
  matchName: string;
  scheduledStart?: string;
}>;

export type MatchSettingsUpdatedEvent = MatchEventBase<'match_settings_updated', {
  templateId: string;
  overrides?: Record<string, unknown>;
}>;

export type PeriodTransitionEvent = MatchEventBase<'period_transition', {
  periodIndex: number;
  periodLabel: string;
  reason: 'start' | 'end' | 'extra_time_start' | 'extra_time_end';
}>;

export type ClockEvent = MatchEventBase<'clock', {
  action: 'start' | 'stop' | 'adjust';
  periodIndex: number;
  elapsedSeconds: number;
  adjustmentSeconds?: number;
  note?: string;
}>;

export type GoalScoredEvent = MatchEventBase<'goal_scored', {
  teamId: string;
  playerId?: string;
  position?: string;
  locationZone?: string;
  points: number;
  periodIndex: number;
  clockTimeSeconds: number;
}>;

export type GoalRemovedEvent = MatchEventBase<'goal_removed', {
  replacedEventId: string;
  reason: 'manual' | 'official_correction';
}>;

export type TurnoverRecordedEvent = MatchEventBase<'turnover_recorded', {
  teamId: string;
  periodIndex: number;
  clockTimeSeconds: number;
  cause: 'intercept' | 'held_ball' | 'offside' | 'contact' | 'obstruction' | 'break';
  note?: string;
}>;

export type TimeoutCalledEvent = MatchEventBase<'timeout_called', {
  teamId?: string;
  periodIndex: number;
  clockTimeSeconds: number;
  category: 'team' | 'injury' | 'official';
}>;

export type SubstitutionMadeEvent = MatchEventBase<'substitution_made', {
  periodIndex: number;
  clockTimeSeconds: number;
  teamId: string;
  playerOutId: string;
  playerInId: string;
  positionOut?: string;
  positionIn?: string;
}>;

export type NoteAddedEvent = MatchEventBase<'note_added', {
  periodIndex: number;
  clockTimeSeconds: number;
  message: string;
}>;

export type SyncCheckpointEvent = MatchEventBase<'sync_checkpoint', {
  projectionVersion: number;
}>;

export type MatchEvent =
  | MatchCreatedEvent
  | MatchSettingsUpdatedEvent
  | PeriodTransitionEvent
  | ClockEvent
  | GoalScoredEvent
  | GoalRemovedEvent
  | TurnoverRecordedEvent
  | TimeoutCalledEvent
  | SubstitutionMadeEvent
  | NoteAddedEvent
  | SyncCheckpointEvent;

export type EventLog = MatchEvent[];

export type PeriodDefinition = {
  label: string;
  durationSeconds: number;
  breakSeconds?: number;
  isExtraTime?: boolean;
};

export type ScoreZoneDefinition = {
  id: string;
  label: string;
  points: number;
  restrictedToRoles?: string[];
};

export type ClockAlert = {
  secondsRemaining: number;
  tone: string;
  vibrate?: boolean;
};

export type RuleTemplate = {
  id: string;
  sport: string;
  name: string;
  version: string;
  description?: string;
  defaults: {
    periods: PeriodDefinition[];
    centrePassAlternates?: boolean;
    allowDraw?: boolean;
  };
  scoring: {
    zones: ScoreZoneDefinition[];
    allowedScorers?: string[];
    minEventGapSeconds?: number;
  };
  clock: {
    autoStartOnCentrePass?: boolean;
    stoppageCategories: string[];
    alerts?: ClockAlert[];
  };
  substitutions?: {
    mode: 'traditional' | 'rolling';
    maxPerPeriod?: number;
  };
  metadata?: Record<string, unknown>;
};
