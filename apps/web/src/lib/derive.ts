import type { Match, MatchEvent, Team } from './types';

// Countable per-player/team stats beyond shooting, following the Champion Data
// category set: attacking involvement, defensive gains, errors, penalties.
export type CountStat =
  | 'feed'
  | 'goalAssist'
  | 'cpReceive'
  | 'intercept'
  | 'deflectionGain'
  | 'deflectionNoGain'
  | 'pickup'
  | 'reboundOff'
  | 'reboundDef'
  | 'turnover'
  | 'penalty';

export interface TeamStats {
  shots: Record<string, { made: number; att: number }>;
  cpByPeriod: Record<number, { conv: number; total: number }>;
  counts: Record<CountStat, number>;
  // per-player attribution — 'Team' collects unattributed taps
  players: Record<string, Partial<Record<CountStat, number>>>;
  manualGains: number;
  turnoverReasons: Record<string, number>;
  penalties: Record<string, number>;
}

export const STAT_LABELS: Record<CountStat, string> = {
  feed: 'Feeds',
  goalAssist: 'Goal assists',
  cpReceive: 'CP receives',
  intercept: 'Intercepts',
  deflectionGain: 'Deflections (gain)',
  deflectionNoGain: 'Deflections (no gain)',
  pickup: 'Pickups',
  reboundOff: 'Rebounds (att.)',
  reboundDef: 'Rebounds (def.)',
  turnover: 'Turnovers',
  penalty: 'Penalties',
};

export const derivedGains = (s: TeamStats): number =>
  s.counts.intercept + s.counts.deflectionGain + s.counts.pickup + s.manualGains;

export interface DerivedState {
  score: Record<Team, number>;
  periodScores: { period: number; home: number; away: number }[];
  currentPeriod: number;
  periodLive: boolean;
  nextCentrePass: Team;
  clock: { remaining: number; running: boolean; asOf: number };
  stats: Record<Team, TeamStats>;
  live: MatchEvent[];
}

const emptyCounts = (): Record<CountStat, number> => ({
  feed: 0,
  goalAssist: 0,
  cpReceive: 0,
  intercept: 0,
  deflectionGain: 0,
  deflectionNoGain: 0,
  pickup: 0,
  reboundOff: 0,
  reboundDef: 0,
  turnover: 0,
  penalty: 0,
});

const emptyTeamStats = (): TeamStats => ({
  shots: {},
  cpByPeriod: {},
  counts: emptyCounts(),
  players: {},
  manualGains: 0,
  turnoverReasons: {},
  penalties: {},
});

function bump(ts: TeamStats, payload: Record<string, unknown>, stat: CountStat) {
  ts.counts[stat] += 1;
  const player = typeof payload['player'] === 'string' && payload['player'] ? String(payload['player']) : 'Team';
  const rec = (ts.players[player] ??= {});
  rec[stat] = (rec[stat] ?? 0) + 1;
}

export function derive(match: Match): DerivedState {
  const undone = new Set<number>();
  for (const e of match.events) {
    if (e.type === 'undo') undone.add(Number(e.payload.target));
  }
  const live = match.events.filter((e) => e.type !== 'undo' && !undone.has(e.seq));

  const score: Record<Team, number> = { home: 0, away: 0 };
  const periodScores: DerivedState['periodScores'] = [];
  let currentPeriod = 1;
  let periodLive = false;
  let nextCentrePass: Team = match.config.firstCentrePass;
  let clock = { remaining: match.config.periodMinutes * 60, running: false, asOf: Date.now() };
  const stats: Record<Team, TeamStats> = { home: emptyTeamStats(), away: emptyTeamStats() };

  for (const e of live) {
    const p = e.payload as Record<string, never>;
    const team = p['team'] as Team;
    switch (e.type) {
      case 'goal':
        score[team] += Number(p['delta'] ?? 1);
        break;
      case 'centre_pass':
        nextCentrePass = team;
        break;
      case 'period':
        if (p['action'] === 'start') {
          currentPeriod = Number(p['period']);
          periodLive = true;
          clock = { remaining: match.config.periodMinutes * 60, running: false, asOf: Date.parse(e.ts) };
        } else {
          periodLive = false;
          periodScores.push({ period: Number(p['period']), home: score.home, away: score.away });
        }
        break;
      case 'clock':
        clock = {
          remaining: Number(p['remaining']),
          running: p['action'] === 'play',
          asOf: Date.parse(e.ts),
        };
        break;
      case 'shot': {
        const name = String(p['player']);
        const s = (stats[team].shots[name] ??= { made: 0, att: 0 });
        s.att += 1;
        if (p['made']) s.made += 1;
        break;
      }
      case 'cp_result': {
        const cp = (stats[team].cpByPeriod[currentPeriod] ??= { conv: 0, total: 0 });
        cp.total += 1;
        if (p['converted']) cp.conv += 1;
        break;
      }
      case 'gain':
        stats[team].manualGains += 1;
        break;
      case 'turnover': {
        bump(stats[team], p, 'turnover');
        const r = String(p['reason'] ?? 'Other');
        stats[team].turnoverReasons[r] = (stats[team].turnoverReasons[r] ?? 0) + 1;
        break;
      }
      case 'penalty': {
        bump(stats[team], p, 'penalty');
        const k = String(p['kind'] ?? 'Other');
        stats[team].penalties[k] = (stats[team].penalties[k] ?? 0) + 1;
        break;
      }
      case 'feed':
        bump(stats[team], p, 'feed');
        break;
      case 'goal_assist':
        bump(stats[team], p, 'goalAssist');
        break;
      case 'cp_receive':
        bump(stats[team], p, 'cpReceive');
        break;
      case 'intercept':
        bump(stats[team], p, 'intercept');
        break;
      case 'deflection':
        bump(stats[team], p, p['gain'] ? 'deflectionGain' : 'deflectionNoGain');
        break;
      case 'pickup':
        bump(stats[team], p, 'pickup');
        break;
      case 'rebound':
        bump(stats[team], p, p['kind'] === 'off' ? 'reboundOff' : 'reboundDef');
        break;
    }
  }

  return { score, periodScores, currentPeriod, periodLive, nextCentrePass, clock, stats, live };
}

export function clockNow(clock: DerivedState['clock']): number {
  if (!clock.running) return Math.max(0, Math.round(clock.remaining));
  return Math.max(0, Math.round(clock.remaining - (Date.now() - clock.asOf) / 1000));
}

export function fmtClock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
