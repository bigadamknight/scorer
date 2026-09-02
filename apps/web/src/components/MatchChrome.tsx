import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { DerivedState } from '../lib/derive';
import { clockNow, fmtClock } from '../lib/derive';
import type { Match, MatchEvent } from '../lib/types';

export function Scoreboard({
  match,
  derived,
  online,
}: {
  match: Match;
  derived: DerivedState;
  online: boolean;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, []);

  const secs = clockNow(derived.clock);
  const periodName =
    match.config.periods === 4 ? `Q${derived.currentPeriod}` : `P${derived.currentPeriod}`;

  return (
    <div className="bg-violet-deep px-4 pb-3 pt-4 text-white">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Link to="/" className="text-xs uppercase tracking-widest text-white/60">
          ← Matches
        </Link>
        <span className="text-xs uppercase tracking-widest text-white/60">
          {online ? 'synced' : 'offline — capturing locally'}
        </span>
      </div>
      <div className="mx-auto mt-1 grid max-w-md grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="text-right">
          <div className="truncate font-display text-lg font-bold uppercase leading-tight">
            {match.config.home}
          </div>
          <div className="font-display text-6xl font-extrabold leading-none tabular-nums">
            {derived.score.home}
          </div>
        </div>
        <div className="px-2 text-center">
          <div className="font-display text-xl font-bold text-white/70">{periodName}</div>
          <div
            className={`font-display text-3xl font-bold tabular-nums ${
              derived.clock.running ? 'text-clock' : 'text-white/50'
            }`}
          >
            {fmtClock(secs)}
          </div>
        </div>
        <div>
          <div className="truncate font-display text-lg font-bold uppercase leading-tight">
            {match.config.away}
          </div>
          <div className="font-display text-6xl font-extrabold leading-none tabular-nums">
            {derived.score.away}
          </div>
        </div>
      </div>
    </div>
  );
}

const describe = (e: MatchEvent, match: Match): string => {
  const p = e.payload as Record<string, unknown>;
  const team = p.team === 'home' || p.team === 'away' ? match.config[p.team as 'home' | 'away'] : '';
  switch (e.type) {
    case 'goal':
      return `${Number(p.delta) < 0 ? 'Goal removed' : 'Goal'} — ${team}`;
    case 'centre_pass':
      return `Centre pass → ${team}`;
    case 'period':
      return `${p.action === 'start' ? 'Started' : 'Ended'} period ${p.period}`;
    case 'clock':
      return p.action === 'play' ? 'Clock started' : 'Clock paused';
    case 'shot':
      return `${p.made ? 'Goal made' : 'Missed shot'} — ${String(p.player)} (${team})`;
    case 'cp_result':
      return `Centre pass ${p.converted ? 'converted' : 'lost'} — ${team}`;
    case 'gain':
      return `Gain — ${team}`;
    case 'turnover':
      return `Turnover (${String(p.reason)}) — ${team}`;
    case 'penalty':
      return `Penalty (${String(p.kind)})${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'feed':
      return `Feed${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'goal_assist':
      return `Goal assist${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'cp_receive':
      return `CP receive${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'intercept':
      return `Intercept${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'deflection':
      return `Deflection ${p.gain ? 'with gain' : 'no gain'}${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'pickup':
      return `Pickup${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    case 'rebound':
      return `Rebound (${p.kind === 'off' ? 'att.' : 'def.'})${p.player ? ` — ${String(p.player)}` : ''} (${team})`;
    default:
      return e.type;
  }
};

export function ActionLog({
  match,
  events,
  filterDevice,
  onUndo,
}: {
  match: Match;
  events: MatchEvent[];
  filterDevice?: string;
  onUndo: (seq: number) => void;
}) {
  const shown = events
    .filter((e) => (filterDevice ? e.device === filterDevice : true))
    .slice(-8)
    .reverse();
  if (shown.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="label">Recent</h3>
      <div className="flex flex-col">
        {shown.map((e) => (
          <div key={e.clientId ?? e.seq} className="flex items-center justify-between border-b border-hairline py-2 text-sm">
            <span className={e.pending ? 'text-faint' : ''}>
              {describe(e, match)}
              {e.pending && ' · syncing'}
            </span>
            {!e.pending && (
              <button className="tap px-2 py-1 text-xs font-bold text-missed" onClick={() => onUndo(e.seq)}>
                UNDO
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
