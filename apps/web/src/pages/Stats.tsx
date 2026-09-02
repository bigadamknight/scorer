import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchSync } from '../hooks/useMatchSync';
import { ActionLog, Scoreboard } from '../components/MatchChrome';
import { derivedGains } from '../lib/derive';
import { PENALTY_KINDS, TURNOVER_REASONS, type EventType, type Team } from '../lib/types';

export function StatsPage() {
  const { id, team: teamParam } = useParams();
  const team = (teamParam === 'away' ? 'away' : 'home') as Team;
  const { match, derived, append, online } = useMatchSync(id);
  const [turnoverOpen, setTurnoverOpen] = useState(false);
  const [player, setPlayer] = useState<string>('');
  const [extraName, setExtraName] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  if (!match || !derived) {
    return <div className="grid min-h-dvh place-items-center text-faint">Loading match…</div>;
  }

  const teamName = match.config[team];
  const stats = derived.stats[team];
  const shooters = match.config.shooters[team];
  const squad = Array.from(
    new Set([...(match.config.players?.[team] ?? []), ...shooters, ...added])
  );
  const cpTotals = Object.values(stats.cpByPeriod).reduce(
    (acc, q) => ({ conv: acc.conv + q.conv, total: acc.total + q.total }),
    { conv: 0, total: 0 }
  );

  const record = (type: EventType, payload: Record<string, unknown> = {}) => {
    append(type, { team, ...(player ? { player } : {}), ...payload });
  };

  const statBtn = (label: string, count: number, onTap: () => void, cls = 'bg-violet text-white') => (
    <button key={label} className={`tap relative py-3.5 text-base font-bold ${cls}`} onClick={onTap}>
      {label}
      <span className="absolute right-2 top-1 text-xs font-normal opacity-70 tabular-nums">{count}</span>
    </button>
  );

  return (
    <div className="min-h-dvh pb-16">
      <Scoreboard match={match} derived={derived} online={online} />
      <div className="mx-auto max-w-md px-4">
        <div className="mt-3 text-center text-sm font-bold uppercase tracking-widest text-violet-deep">
          Bench stats — {teamName}
        </div>

        {/* player attribution */}
        <section className="mt-3">
          <div className="flex items-baseline justify-between">
            <h3 className="label mb-1">Recording for</h3>
            <span className="text-xs text-faint">tap a player to attribute stats, or leave on team</span>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                player === '' ? 'bg-violet-deep text-white' : 'bg-violet-wash text-violet-deep'
              }`}
              onClick={() => setPlayer('')}
            >
              Team
            </button>
            {squad.map((n) => (
              <button
                key={n}
                className={`tap shrink-0 rounded-full px-4 py-2 text-sm font-bold normal-case tracking-normal ${
                  player === n ? 'bg-violet-deep text-white' : 'bg-violet-wash text-violet-deep'
                }`}
                onClick={() => setPlayer(player === n ? '' : n)}
              >
                {n}
              </button>
            ))}
            <input
              className="field w-28 shrink-0 py-1 text-sm"
              placeholder="+ player"
              value={extraName}
              onChange={(e) => setExtraName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const n = extraName.trim();
                  if (n) setAdded((a) => (a.includes(n) ? a : a.concat(n)));
                  setExtraName('');
                }
              }}
            />
          </div>
        </section>

        {/* shooting */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <h3 className="label">Shooting</h3>
          {shooters.length === 0 && added.length === 0 && (
            <p className="text-sm text-faint">No shooters listed — add players above.</p>
          )}
          <div className="flex flex-col gap-2">
            {Array.from(new Set([...shooters, ...added])).map((name) => {
              const s = stats.shots[name] ?? { made: 0, att: 0 };
              return (
                <div key={name} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <div>
                    <span className="font-bold">{name}</span>{' '}
                    <span className="text-sm tabular-nums text-faint">
                      {s.made}/{s.att}
                    </span>
                  </div>
                  <button
                    className="tap bg-made px-6 py-3.5 text-xl font-extrabold text-white"
                    onClick={() => append('shot', { team, player: name, made: true })}
                  >
                    ✓
                  </button>
                  <button
                    className="tap bg-missed px-6 py-3.5 text-xl font-extrabold text-white"
                    onClick={() => append('shot', { team, player: name, made: false })}
                  >
                    ✗
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* attacking involvement */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <h3 className="label">Attack</h3>
          <div className="grid grid-cols-3 gap-2">
            {statBtn('Feed', stats.counts.feed, () => record('feed'))}
            {statBtn('Assist', stats.counts.goalAssist, () => record('goal_assist'))}
            {statBtn('CP rec.', stats.counts.cpReceive, () => record('cp_receive'))}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <h3 className="label mb-0">Our centre passes</h3>
            <span className="text-sm tabular-nums text-faint">
              {cpTotals.conv}/{cpTotals.total} converted
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {statBtn('CP scored', cpTotals.conv, () => record('cp_result', { converted: true }), 'bg-made text-white')}
            {statBtn(
              'CP lost',
              cpTotals.total - cpTotals.conv,
              () => record('cp_result', { converted: false }),
              'bg-missed text-white'
            )}
          </div>
        </section>

        {/* defensive gains */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="label">Defence</h3>
            <span className="text-sm tabular-nums text-faint">{derivedGains(stats)} gains</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {statBtn('Intercept', stats.counts.intercept, () => record('intercept'))}
            {statBtn('Defl. gain', stats.counts.deflectionGain, () => record('deflection', { gain: true }))}
            {statBtn('Defl. lost', stats.counts.deflectionNoGain, () => record('deflection', { gain: false }), 'bg-violet-wash text-violet-deep')}
            {statBtn('Pickup', stats.counts.pickup, () => record('pickup'))}
            {statBtn('Reb. def', stats.counts.reboundDef, () => record('rebound', { kind: 'def' }))}
            {statBtn('Reb. att', stats.counts.reboundOff, () => record('rebound', { kind: 'off' }), 'bg-violet-wash text-violet-deep')}
          </div>
        </section>

        {/* errors + penalties */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="label">Errors</h3>
            <span className="text-sm tabular-nums text-faint">{stats.counts.turnover} turnovers</span>
          </div>
          <button
            className={`tap w-full py-3.5 text-lg font-bold ${
              turnoverOpen ? 'bg-violet-deep text-white' : 'bg-missed text-white'
            }`}
            onClick={() => setTurnoverOpen((v) => !v)}
          >
            Turnover…
          </button>
          {turnoverOpen && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {TURNOVER_REASONS.map((r) => (
                <button
                  key={r}
                  className="tap bg-ground py-2.5 text-sm font-bold text-ink"
                  onClick={() => {
                    record('turnover', { reason: r });
                    setTurnoverOpen(false);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PENALTY_KINDS.map((k) =>
              statBtn(
                `Pen. ${k.toLowerCase()}`,
                stats.penalties[k] ?? 0,
                () => record('penalty', { kind: k }),
                'bg-violet-wash text-violet-deep'
              )
            )}
          </div>
        </section>

        <ActionLog match={match} events={derived.live} onUndo={(seq) => append('undo', { target: seq })} />
      </div>
    </div>
  );
}
