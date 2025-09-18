import type { GoalScoredEvent, MatchEvent, RuleTemplate } from '@scorer/schema';

type ValidationResult = {
  ok: boolean;
  reason?: string;
};

const NETBALL_TEMPLATE: RuleTemplate = {
  id: 'netball-standard-1',
  sport: 'netball',
  name: 'Netball (World Netball Standard)',
  version: '0.1.0',
  defaults: {
    periods: [
      { label: 'Q1', durationSeconds: 15 * 60, breakSeconds: 3 * 60 },
      { label: 'Q2', durationSeconds: 15 * 60, breakSeconds: 12 * 60 },
      { label: 'Q3', durationSeconds: 15 * 60, breakSeconds: 3 * 60 },
      { label: 'Q4', durationSeconds: 15 * 60 }
    ],
    centrePassAlternates: true,
    allowDraw: false
  },
  scoring: {
    zones: [
      { id: 'circle', label: 'Goal Circle', points: 1, restrictedToRoles: ['GA', 'GS'] }
    ]
  },
  clock: {
    autoStartOnCentrePass: false,
    stoppageCategories: ['team', 'injury', 'official'],
    alerts: [
      { secondsRemaining: 60, tone: 'period_warning' },
      { secondsRemaining: 0, tone: 'period_end' }
    ]
  },
  substitutions: {
    mode: 'rolling'
  }
};

const FAST5_TEMPLATE: RuleTemplate = {
  ...NETBALL_TEMPLATE,
  id: 'netball-fast5-1',
  name: 'Netball Fast5',
  defaults: {
    periods: [
      { label: 'Q1', durationSeconds: 6 * 60, breakSeconds: 2 * 60 },
      { label: 'Q2', durationSeconds: 6 * 60, breakSeconds: 6 * 60 },
      { label: 'Q3', durationSeconds: 6 * 60, breakSeconds: 2 * 60 },
      { label: 'Q4', durationSeconds: 6 * 60 }
    ],
    centrePassAlternates: true,
    allowDraw: false
  },
  scoring: {
    zones: [
      { id: 'inner', label: 'Inner Circle', points: 1, restrictedToRoles: ['GA', 'GS'] },
      { id: 'outer', label: 'Outer Circle', points: 2, restrictedToRoles: ['GA', 'GS'] },
      { id: 'super', label: 'Super Shot', points: 3, restrictedToRoles: ['GA', 'GS'] }
    ]
  }
};

export const ruleTemplates: RuleTemplate[] = [NETBALL_TEMPLATE, FAST5_TEMPLATE];

export function validateGoalEvent(event: GoalScoredEvent, template: RuleTemplate = NETBALL_TEMPLATE): ValidationResult {
  if (!template.scoring.allowedScorers && template.scoring.zones.length === 0) {
    return { ok: true };
  }

  if (template.scoring.allowedScorers && event.payload.position && !template.scoring.allowedScorers.includes(event.payload.position)) {
    return {
      ok: false,
      reason: `Position ${event.payload.position} is not permitted to score in this rule set.`
    };
  }

  if (!event.payload.locationZone) {
    return { ok: true };
  }

  const zone = template.scoring.zones.find((z) => z.id === event.payload.locationZone);
  if (!zone) {
    return {
      ok: false,
      reason: `Zone ${event.payload.locationZone} is not configured.`
    };
  }

  if (zone.restrictedToRoles && event.payload.position && !zone.restrictedToRoles.includes(event.payload.position)) {
    return {
      ok: false,
      reason: `Role ${event.payload.position} cannot score from zone ${zone.label}.`
    };
  }

  if (zone.points !== event.payload.points) {
    return {
      ok: false,
      reason: `Expected ${zone.points} point(s) for zone ${zone.label} but received ${event.payload.points}.`
    };
  }

  return { ok: true };
}

export function isMatchEvent(value: unknown): value is MatchEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<MatchEvent>;
  return (
    typeof event.matchId === 'string' &&
    typeof event.eventId === 'string' &&
    typeof event.type === 'string' &&
    typeof event.createdAt === 'string'
  );
}
