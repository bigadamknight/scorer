import { useNavigate, useParams } from 'react-router-dom';
import { useMatchSync } from '../hooks/useMatchSync';
import { ActionLog, Scoreboard } from '../components/MatchChrome';
import { clockNow } from '../lib/derive';
import { api } from '../lib/api';
import type { Team } from '../lib/types';
import { buildReportText } from '../lib/report';

export function ScorePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { match, derived, append, online } = useMatchSync(id);

  if (!match || !derived) {
    return <div className="grid min-h-dvh place-items-center text-faint">Loading match…</div>;
  }

  const periodStarted = derived.periodLive;
  const lastPeriodDone = !periodStarted && derived.periodScores.length >= match.config.periods;
  const nextPeriod = derived.periodScores.length + 1;
  const secs = clockNow(derived.clock);

  const handleGoal = (team: Team) => {
    append('goal', { team, delta: 1 });
    // centre pass alternates after every goal
    append('centre_pass', { team: derived.nextCentrePass === 'home' ? 'away' : 'home' });
  };

  const handleEndMatch = async () => {
    append('clock', { action: 'pause', remaining: secs });
    if (periodStarted) append('period', { action: 'end', period: derived.currentPeriod });
    try {
      await api.post(`/api/matches/${match.id}/complete`, {
        subject: `Match report: ${match.config.home} v ${match.config.away}`,
        text: buildReportText(match, derived),
      });
    } catch {
      /* report page offers a resend */
    }
    navigate(`/match/${match.id}/report`);
  };

  return (
    <div className="min-h-dvh pb-16">
      <Scoreboard match={match} derived={derived} online={online} />

      <div className="mx-auto max-w-md px-4">
        {/* period + clock controls */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {!periodStarted && !lastPeriodDone && (
            <button
              className="tap col-span-3 bg-violet py-4 text-2xl font-bold text-white"
              onClick={() => {
                append('period', { action: 'start', period: nextPeriod });
              }}
            >
              Start {match.config.periods === 4 ? `quarter ${nextPeriod}` : `period ${nextPeriod}`}
            </button>
          )}
          {periodStarted && (
            <>
              <button
                className={`tap py-3 text-lg font-bold ${
                  derived.clock.running ? 'bg-clock text-ink' : 'bg-violet text-white'
                }`}
                onClick={() =>
                  append('clock', {
                    action: derived.clock.running ? 'pause' : 'play',
                    remaining: secs,
                  })
                }
              >
                {derived.clock.running ? 'Pause' : 'Play'}
              </button>
              <button
                className="tap bg-violet-wash py-3 text-lg font-bold text-violet-deep"
                onClick={() => append('clock', { action: 'pause', remaining: secs })}
              >
                Time off
              </button>
              <button
                className="tap bg-violet-wash py-3 text-lg font-bold text-violet-deep"
                onClick={() => {
                  append('clock', { action: 'pause', remaining: secs });
                  append('period', { action: 'end', period: derived.currentPeriod });
                }}
              >
                End {match.config.periods === 4 ? `Q${derived.currentPeriod}` : 'period'}
              </button>
            </>
          )}
        </div>

        {/* centre pass */}
        <div className="mt-4 flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3">
          <div>
            <div className="label mb-0">Next centre pass</div>
            <div className="font-display text-xl font-bold uppercase">
              {match.config[derived.nextCentrePass]}
            </div>
          </div>
          <button
            className="tap bg-violet-wash px-4 py-2 font-bold text-violet-deep"
            onClick={() =>
              append('centre_pass', { team: derived.nextCentrePass === 'home' ? 'away' : 'home' })
            }
          >
            ⇄ Switch
          </button>
        </div>

        {/* goals */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(['home', 'away'] as Team[]).map((team) => (
            <div key={team} className="rounded-md border border-hairline bg-surface p-4 text-center">
              <div className="truncate font-display text-lg font-bold uppercase">{match.config[team]}</div>
              <button
                className="tap mt-3 w-full bg-violet py-8 text-3xl font-extrabold text-white"
                disabled={!periodStarted}
                onClick={() => handleGoal(team)}
              >
                + Goal
              </button>
              <button
                className="tap mt-2 w-full py-2 text-sm font-bold text-missed disabled:opacity-30"
                disabled={derived.score[team] === 0}
                onClick={() => append('goal', { team, delta: -1 })}
              >
                − remove goal
              </button>
            </div>
          ))}
        </div>

        {lastPeriodDone && (
          <button className="tap mt-6 w-full bg-made py-4 text-2xl font-bold text-white" onClick={handleEndMatch}>
            End match &amp; send report
          </button>
        )}

        <ActionLog match={match} events={derived.live} onUndo={(seq) => append('undo', { target: seq })} />

        <p className="mt-8 text-center text-xs text-faint">
          Match {match.id} — the stats phone joins from the home screen.
        </p>
      </div>
    </div>
  );
}
