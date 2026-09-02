import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMatchSync } from '../hooks/useMatchSync';
import { ActionLog, Scoreboard } from '../components/MatchChrome';
import { PENALTY_KINDS, TURNOVER_REASONS, type Team } from '../lib/types';

export function StatsPage() {
  const { id, team: teamParam } = useParams();
  const team = (teamParam === 'away' ? 'away' : 'home') as Team;
  const { match, derived, append, online } = useMatchSync(id);
  const [turnoverOpen, setTurnoverOpen] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [extraShooter, setExtraShooter] = useState('');
  const [added, setAdded] = useState<string[]>([]);

  if (!match || !derived) {
    return <div className="grid min-h-dvh place-items-center text-faint">Loading match…</div>;
  }

  const teamName = match.config[team];
  const stats = derived.stats[team];
  const shooters = match.config.shooters[team].concat(added.filter((n) => !match.config.shooters[team].includes(n)));
  const cpTotals = Object.values(stats.cpByPeriod).reduce(
    (acc, q) => ({ conv: acc.conv + q.conv, total: acc.total + q.total }),
    { conv: 0, total: 0 }
  );

  return (
    <div className="min-h-dvh pb-16">
      <Scoreboard match={match} derived={derived} online={online} />
      <div className="mx-auto max-w-md px-4">
        <div className="mt-3 text-center text-sm font-bold uppercase tracking-widest text-violet-deep">
          Bench stats — {teamName}
        </div>

        {/* shooting */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <h3 className="label">Shooting</h3>
          {shooters.length === 0 && (
            <p className="text-sm text-faint">No shooters listed yet — add one below.</p>
          )}
          <div className="flex flex-col gap-2">
            {shooters.map((name) => {
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
          <div className="mt-3 flex gap-2">
            <input
              className="field py-1.5 text-sm"
              placeholder="Add shooter mid-match"
              value={extraShooter}
              onChange={(e) => setExtraShooter(e.target.value)}
            />
            <button
              className="tap bg-violet-wash px-3 text-sm font-bold text-violet-deep"
              onClick={() => {
                const n = extraShooter.trim();
                if (n) setAdded((a) => (a.includes(n) ? a : a.concat(n)));
                setExtraShooter('');
              }}
            >
              Add
            </button>
          </div>
        </section>

        {/* centre pass conversion */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="label">Our centre passes</h3>
            <span className="text-sm tabular-nums text-faint">
              {cpTotals.conv}/{cpTotals.total} converted
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="tap bg-made py-4 text-lg font-bold text-white"
              onClick={() => append('cp_result', { team, converted: true })}
            >
              CP scored
            </button>
            <button
              className="tap bg-missed py-4 text-lg font-bold text-white"
              onClick={() => append('cp_result', { team, converted: false })}
            >
              CP lost
            </button>
          </div>
        </section>

        {/* possession */}
        <section className="mt-4 rounded-md border border-hairline bg-surface p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="label">Possession</h3>
            <span className="text-sm tabular-nums text-faint">
              {stats.gains} gains · {stats.turnovers} turnovers
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="tap bg-violet py-4 text-lg font-bold text-white" onClick={() => append('gain', { team })}>
              Gain
            </button>
            <button
              className={`tap py-4 text-lg font-bold ${turnoverOpen ? 'bg-violet-deep text-white' : 'bg-violet-wash text-violet-deep'}`}
              onClick={() => {
                setTurnoverOpen((v) => !v);
                setPenaltyOpen(false);
              }}
            >
              Turnover…
            </button>
          </div>
          {turnoverOpen && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {TURNOVER_REASONS.map((r) => (
                <button
                  key={r}
                  className="tap bg-ground py-2.5 text-sm font-bold text-ink"
                  onClick={() => {
                    append('turnover', { team, reason: r });
                    setTurnoverOpen(false);
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}
          <button
            className={`tap mt-2 w-full py-3 text-sm font-bold ${penaltyOpen ? 'bg-violet-deep text-white' : 'bg-ground text-faint'}`}
            onClick={() => {
              setPenaltyOpen((v) => !v);
              setTurnoverOpen(false);
            }}
          >
            Penalty against us…
          </button>
          {penaltyOpen && (
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {PENALTY_KINDS.map((k) => (
                <button
                  key={k}
                  className="tap bg-ground py-2.5 text-sm font-bold text-ink"
                  onClick={() => {
                    append('penalty', { team, kind: k });
                    setPenaltyOpen(false);
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
          )}
        </section>

        <ActionLog match={match} events={derived.live} onUndo={(seq) => append('undo', { target: seq })} />
      </div>
    </div>
  );
}
